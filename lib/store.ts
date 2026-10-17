// Forge's short-lived store: Upstash for Redis when a URL and token pair is set, process memory
// for local dev. On Vercel with neither pair, a store-backed route fails when it runs, never at
// import, so pages still load before Upstash is connected; a silent memory fallback there would
// split Tavus's request and the browser's poll across instances.

import { Redis } from "@upstash/redis";
import { GOAL_IDS } from "@/lib/types";
import type { Debug, Goal, GoalId, Profile, SessionView, StoreKind, UserTurn } from "@/lib/types";

/** Every key of a call expires after 24 hours. */
export const STORE_TTL_SECONDS = 60 * 60 * 24;

/** At most this many user turns are kept per call. */
export const MAX_USER_TURNS = 200;

/** One call as the poll reads it, with the session token for the 403 check. */
export interface StoredSession {
  sessionToken: string;
  view: SessionView;
}

/** What the synthesize route reads; a reading already given comes back as profile. */
export interface SynthesisContext {
  turns: UserTurn[];
  goals: Goal[];
  crisis: boolean;
  profile: Profile | null;
}

/** Thrown by getStore() on Vercel when neither Upstash pair is set; routes answer 503 store_unavailable. */
export class StoreUnavailableError extends Error {
  constructor() {
    super(
      "No Upstash store is connected: set KV_REST_API_URL and KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
    this.name = "StoreUnavailableError";
  }
}

/** What the routes need from a backend; every write refreshes the 24-hour expiry. */
export interface ForgeStore {
  /** Backend name, sent as the x-forge-store header. */
  readonly kind: StoreKind;
  createSession(conversationId: string, sessionToken: string): Promise<void>;
  /** The session token, or null for a call the store does not know. */
  getSessionToken(conversationId: string): Promise<string | null>;
  /** The 3 s poll as one pipelined read. */
  getSession(conversationId: string): Promise<StoredSession | null>;
  /** Upserts a goal by goal_id; false when this tool_call_id was already stored. */
  addGoal(conversationId: string, goal: Goal, toolCallId: string | null): Promise<boolean>;
  /** Appends a text-only user turn; false for a repeated inference_id or past MAX_USER_TURNS. */
  addUserTurn(conversationId: string, speech: string, inferenceId: string | null): Promise<boolean>;
  /** After the crisis flag no reading is given. */
  setCrisis(conversationId: string): Promise<void>;
  getSynthesisContext(conversationId: string): Promise<SynthesisContext>;
  setProfile(conversationId: string, profile: Profile, debug: Debug): Promise<void>;
  /** The text already returned for this tool_call_id, or null; Tavus retries a 5xx once with the same id. */
  getSpokenText(conversationId: string, toolCallId: string): Promise<string | null>;
  setSpokenText(conversationId: string, toolCallId: string, text: string): Promise<void>;
  /** The full Forge report link built after the call, or null before it exists. */
  getReportUrl(conversationId: string): Promise<string | null>;
  setReportUrl(conversationId: string, url: string): Promise<void>;
  /** Marks the call ended; ending twice is fine. */
  endSession(conversationId: string): Promise<void>;
  /** Removes what Forge kept of the call but keeps the token. */
  clearSessionData(conversationId: string): Promise<void>;
  /** Removes every key of the call, token included. */
  deleteSession(conversationId: string): Promise<void>;
}

// A user turn as stored; n is its position in arrival order, added on read.
interface StoredTurn {
  speech: string;
  inference_id: string | null;
}

function numberTurns(turns: StoredTurn[]): UserTurn[] {
  return turns.map((turn, index) => ({ n: index + 1, speech: turn.speech, inference_id: turn.inference_id }));
}

function sortGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => GOAL_IDS.indexOf(a.goal_id) - GOAL_IDS.indexOf(b.goal_id));
}

function isGoal(value: unknown): value is Goal {
  if (!value || typeof value !== "object") return false;
  const goal = value as Record<string, unknown>;
  return (
    GOAL_IDS.includes(goal.goal_id as GoalId) &&
    typeof goal.goal === "string" &&
    typeof goal.by_when === "string" &&
    typeof goal.user_quote === "string"
  );
}

function isStoredTurn(value: unknown): value is StoredTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as Record<string, unknown>;
  return typeof turn.speech === "string" && (turn.inference_id === null || typeof turn.inference_id === "string");
}

// Upstash: one Redis key per field, named forge:<conversationId>:<field>, plus one counter per address.

const SESSION_FIELDS = ["token", "state"] as const;
const DATA_FIELDS = ["crisis", "goals", "goal_calls", "turns", "turn_ids", "profile", "debug", "spoken", "report"] as const;
type Field = (typeof SESSION_FIELDS)[number] | (typeof DATA_FIELDS)[number];

function key(conversationId: string, field: Field): string {
  return `forge:${conversationId}:${field}`;
}

// Automatic deserialization is off, so values come back as the strings that were stored; a stored
// turn of "123" would otherwise come back as a number.
function parseJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// With deserialization off, HGETALL answers a flat [field, value, ...] array, not the object its type says.
function hashValues(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw.filter((_, index) => index % 2 === 1);
  if (raw && typeof raw === "object") return Object.values(raw);
  return [];
}

function parseGoals(raw: unknown): Goal[] {
  return sortGoals(hashValues(raw).map(parseJson).filter(isGoal));
}

function parseTurns(raw: unknown): UserTurn[] {
  const list = Array.isArray(raw) ? raw : [];
  return numberTurns(list.map(parseJson).filter(isStoredTurn));
}

function parseProfile(raw: unknown): Profile | null {
  return (parseJson(raw) as Profile | null) ?? null;
}

class UpstashStore implements ForgeStore {
  readonly kind = "upstash" as const;

  constructor(private readonly redis: Redis) {}

  async createSession(conversationId: string, sessionToken: string): Promise<void> {
    const pipe = this.redis.pipeline();
    pipe.set(key(conversationId, "token"), sessionToken, { ex: STORE_TTL_SECONDS });
    pipe.set(key(conversationId, "state"), "live", { ex: STORE_TTL_SECONDS });
    await pipe.exec();
  }

  async getSessionToken(conversationId: string): Promise<string | null> {
    const token = await this.redis.get(key(conversationId, "token"));
    return typeof token === "string" && token ? token : null;
  }

  async getSession(conversationId: string): Promise<StoredSession | null> {
    const pipe = this.redis.pipeline();
    pipe.get(key(conversationId, "token"));
    pipe.get(key(conversationId, "state"));
    pipe.get(key(conversationId, "crisis"));
    pipe.hgetall(key(conversationId, "goals"));
    pipe.get(key(conversationId, "profile"));
    pipe.get(key(conversationId, "debug"));
    const [token, state, crisis, goals, profile, debug] = (await pipe.exec()) as unknown[];
    if (typeof token !== "string" || !token) return null;
    return {
      sessionToken: token,
      view: {
        state: state === "ended" ? "ended" : "live",
        crisis: crisis !== null && crisis !== undefined,
        goals: parseGoals(goals),
        profile: parseProfile(profile),
        debug: (parseJson(debug) as Debug | null) ?? null,
      },
    };
  }

  async addGoal(conversationId: string, goal: Goal, toolCallId: string | null): Promise<boolean> {
    const callsKey = key(conversationId, "goal_calls");
    if (toolCallId) {
      // SADD answers 0 when the member was already there, so a repeat is caught in one step.
      const added = await this.redis.sadd(callsKey, toolCallId);
      if (Number(added) === 0) return false;
    }
    const goalsKey = key(conversationId, "goals");
    const pipe = this.redis.pipeline();
    pipe.hset(goalsKey, { [goal.goal_id]: JSON.stringify(goal) });
    pipe.expire(goalsKey, STORE_TTL_SECONDS);
    if (toolCallId) pipe.expire(callsKey, STORE_TTL_SECONDS);
    await pipe.exec();
    return true;
  }

  async addUserTurn(conversationId: string, speech: string, inferenceId: string | null): Promise<boolean> {
    const turnsKey = key(conversationId, "turns");
    const idsKey = key(conversationId, "turn_ids");
    const check = this.redis.pipeline();
    check.llen(turnsKey);
    if (inferenceId) {
      check.sadd(idsKey, inferenceId);
      check.expire(idsKey, STORE_TTL_SECONDS);
    }
    const [length, added] = (await check.exec()) as unknown[];
    if (inferenceId && Number(added) === 0) return false;
    if (Number(length) >= MAX_USER_TURNS) return false;
    const write = this.redis.pipeline();
    write.rpush(turnsKey, JSON.stringify({ speech, inference_id: inferenceId } satisfies StoredTurn));
    write.expire(turnsKey, STORE_TTL_SECONDS);
    await write.exec();
    return true;
  }

  async setCrisis(conversationId: string): Promise<void> {
    await this.redis.set(key(conversationId, "crisis"), "1", { ex: STORE_TTL_SECONDS });
  }

  async getSynthesisContext(conversationId: string): Promise<SynthesisContext> {
    const pipe = this.redis.pipeline();
    pipe.lrange(key(conversationId, "turns"), 0, -1);
    pipe.hgetall(key(conversationId, "goals"));
    pipe.get(key(conversationId, "crisis"));
    pipe.get(key(conversationId, "profile"));
    const [turns, goals, crisis, profile] = (await pipe.exec()) as unknown[];
    return {
      turns: parseTurns(turns),
      goals: parseGoals(goals),
      crisis: crisis !== null && crisis !== undefined,
      profile: parseProfile(profile),
    };
  }

  async setProfile(conversationId: string, profile: Profile, debug: Debug): Promise<void> {
    const pipe = this.redis.pipeline();
    pipe.set(key(conversationId, "profile"), JSON.stringify(profile), { ex: STORE_TTL_SECONDS });
    pipe.set(key(conversationId, "debug"), JSON.stringify(debug), { ex: STORE_TTL_SECONDS });
    await pipe.exec();
  }

  async getSpokenText(conversationId: string, toolCallId: string): Promise<string | null> {
    const text = await this.redis.hget(key(conversationId, "spoken"), toolCallId);
    return typeof text === "string" ? text : null;
  }

  async setSpokenText(conversationId: string, toolCallId: string, text: string): Promise<void> {
    const spokenKey = key(conversationId, "spoken");
    const pipe = this.redis.pipeline();
    pipe.hset(spokenKey, { [toolCallId]: text });
    pipe.expire(spokenKey, STORE_TTL_SECONDS);
    await pipe.exec();
  }

  async getReportUrl(conversationId: string): Promise<string | null> {
    const url = await this.redis.get(key(conversationId, "report"));
    return typeof url === "string" ? url : null;
  }

  async setReportUrl(conversationId: string, url: string): Promise<void> {
    await this.redis.set(key(conversationId, "report"), url, { ex: STORE_TTL_SECONDS });
  }

  async endSession(conversationId: string): Promise<void> {
    await this.redis.set(key(conversationId, "state"), "ended", { ex: STORE_TTL_SECONDS });
  }

  async clearSessionData(conversationId: string): Promise<void> {
    await this.redis.del(...DATA_FIELDS.map((field) => key(conversationId, field)));
  }

  async deleteSession(conversationId: string): Promise<void> {
    await this.redis.del(...[...SESSION_FIELDS, ...DATA_FIELDS].map((field) => key(conversationId, field)));
  }
}

// Memory: one record per call, kept on globalThis so dev reloads and every route share them.

interface MemoryRecord {
  expiresAt: number;
  token: string | null;
  state: "live" | "ended";
  crisis: boolean;
  goals: Map<GoalId, Goal>;
  goalCalls: Set<string>;
  turns: StoredTurn[];
  turnIds: Set<string>;
  profile: Profile | null;
  debug: Debug | null;
  spoken: Map<string, string>;
  report: string | null;
}

interface MemoryTables {
  sessions: Map<string, MemoryRecord>;
}

function emptyRecord(): MemoryRecord {
  return {
    expiresAt: 0,
    token: null,
    state: "live",
    crisis: false,
    goals: new Map(),
    goalCalls: new Set(),
    turns: [],
    turnIds: new Set(),
    profile: null,
    debug: null,
    spoken: new Map(),
    report: null,
  };
}

class MemoryStore implements ForgeStore {
  readonly kind = "memory" as const;

  constructor(private readonly tables: MemoryTables) {}

  private read(conversationId: string): MemoryRecord | null {
    const record = this.tables.sessions.get(conversationId);
    if (!record) return null;
    if (record.expiresAt <= Date.now()) {
      this.tables.sessions.delete(conversationId);
      return null;
    }
    return record;
  }

  private write(conversationId: string): MemoryRecord {
    const record = this.read(conversationId) ?? emptyRecord();
    record.expiresAt = Date.now() + STORE_TTL_SECONDS * 1000;
    this.tables.sessions.set(conversationId, record);
    return record;
  }

  async createSession(conversationId: string, sessionToken: string): Promise<void> {
    const record = this.write(conversationId);
    record.token = sessionToken;
    record.state = "live";
  }

  async getSessionToken(conversationId: string): Promise<string | null> {
    return this.read(conversationId)?.token ?? null;
  }

  async getSession(conversationId: string): Promise<StoredSession | null> {
    const record = this.read(conversationId);
    if (!record?.token) return null;
    return {
      sessionToken: record.token,
      view: {
        state: record.state,
        crisis: record.crisis,
        goals: sortGoals([...record.goals.values()].map((goal) => ({ ...goal }))),
        profile: record.profile ? structuredClone(record.profile) : null,
        debug: record.debug ? structuredClone(record.debug) : null,
      },
    };
  }

  async addGoal(conversationId: string, goal: Goal, toolCallId: string | null): Promise<boolean> {
    const record = this.write(conversationId);
    if (toolCallId) {
      if (record.goalCalls.has(toolCallId)) return false;
      record.goalCalls.add(toolCallId);
    }
    record.goals.set(goal.goal_id, { ...goal });
    return true;
  }

  async addUserTurn(conversationId: string, speech: string, inferenceId: string | null): Promise<boolean> {
    const record = this.write(conversationId);
    if (inferenceId) {
      if (record.turnIds.has(inferenceId)) return false;
      record.turnIds.add(inferenceId);
    }
    if (record.turns.length >= MAX_USER_TURNS) return false;
    record.turns.push({ speech, inference_id: inferenceId });
    return true;
  }

  async setCrisis(conversationId: string): Promise<void> {
    this.write(conversationId).crisis = true;
  }

  async getSynthesisContext(conversationId: string): Promise<SynthesisContext> {
    const record = this.read(conversationId);
    if (!record) return { turns: [], goals: [], crisis: false, profile: null };
    return {
      turns: numberTurns(record.turns),
      goals: sortGoals([...record.goals.values()].map((goal) => ({ ...goal }))),
      crisis: record.crisis,
      profile: record.profile ? structuredClone(record.profile) : null,
    };
  }

  async setProfile(conversationId: string, profile: Profile, debug: Debug): Promise<void> {
    const record = this.write(conversationId);
    record.profile = structuredClone(profile);
    record.debug = structuredClone(debug);
  }

  async getSpokenText(conversationId: string, toolCallId: string): Promise<string | null> {
    return this.read(conversationId)?.spoken.get(toolCallId) ?? null;
  }

  async setSpokenText(conversationId: string, toolCallId: string, text: string): Promise<void> {
    this.write(conversationId).spoken.set(toolCallId, text);
  }

  async getReportUrl(conversationId: string): Promise<string | null> {
    return this.read(conversationId)?.report ?? null;
  }

  async setReportUrl(conversationId: string, url: string): Promise<void> {
    this.write(conversationId).report = url;
  }

  async endSession(conversationId: string): Promise<void> {
    this.write(conversationId).state = "ended";
  }

  async clearSessionData(conversationId: string): Promise<void> {
    const record = this.read(conversationId);
    if (!record) return;
    const { token, state, expiresAt } = record;
    this.tables.sessions.set(conversationId, { ...emptyRecord(), token, state, expiresAt });
  }

  async deleteSession(conversationId: string): Promise<void> {
    this.tables.sessions.delete(conversationId);
  }
}

const forgeGlobal = globalThis as typeof globalThis & { __forgeMemory?: MemoryTables };

let upstash: { id: string; store: UpstashStore } | undefined;
let warnedHalfPair = false;

/** The first complete Upstash pair: the Vercel Marketplace KV_ names, then the Upstash console names. */
function upstashCredentials(env: NodeJS.ProcessEnv): { url: string; token: string } | null {
  const pairs = [
    ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
    ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  ] as const;
  for (const [urlName, tokenName] of pairs) {
    const url = env[urlName]?.trim();
    const token = env[tokenName]?.trim();
    if (url && token) return { url, token };
    if ((url || token) && !warnedHalfPair) {
      warnedHalfPair = true;
      console.warn(`Upstash is half configured: set both ${urlName} and ${tokenName}.`);
    }
  }
  return null;
}

/** The store for this environment; call it inside a handler, never at module scope. */
export function getStore(): ForgeStore {
  const credentials = upstashCredentials(process.env);
  if (credentials) {
    const id = `${credentials.url}\n${credentials.token}`;
    if (upstash?.id !== id) {
      const redis = new Redis({
        url: credentials.url,
        token: credentials.token,
        automaticDeserialization: false,
        enableTelemetry: false,
      });
      upstash = { id, store: new UpstashStore(redis) };
    }
    return upstash.store;
  }
  if (process.env.VERCEL) throw new StoreUnavailableError();
  forgeGlobal.__forgeMemory ??= { sessions: new Map() };
  return new MemoryStore(forgeGlobal.__forgeMemory);
}
