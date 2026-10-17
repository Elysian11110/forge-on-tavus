// Server-only Tavus client. The key comes from TAVUS_API_KEY at call time and goes only to
// https://tavusapi.com in the x-api-key header. Never import this file from a client component.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { arcTiming, type Switches } from "@/lib/switches";

const TAVUS_API_BASE = "https://tavusapi.com/v2";
const TAVUS_ORIGIN = "https://tavusapi.com";

// A Tavus request that has not answered by then is abandoned.
const TAVUS_TIMEOUT_MS = 20_000;

// Right after /end Tavus may still be writing the transcript, so the hard delete gets one more try after this.
const HARD_DELETE_RETRY_MS = 3000;

// The PAL plus one person.
const MAX_PARTICIPANTS = 2;
// Nobody joined: Tavus ends the room (and expires the meeting token) after this.
const ABSENT_TIMEOUT_SEC = 120;
// The person left: Tavus ends the room after this.
const LEFT_TIMEOUT_SEC = 10;

// On the short arc the prompt's six stages do not fit before the time check, so the context says which to skip.
const SHORT_ARC_NOTE =
  "Short call: keep to one goal, skip Anything else on your list and the recharge question, and do the hunch check before any time check.";

/** A non-2xx Tavus reply; the message comes from either error shape, { error } or { message }. Status 0 means Tavus could not be reached. */
export class TavusError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "TavusError";
    this.status = status;
  }
}

/** POST /v2/conversations body, built only on the server. */
export interface CreateConversationBody {
  pal_id: string;
  custom_greeting: string;
  conversational_context: string;
  require_auth?: boolean;
  max_participants: number;
  policy?: "eu";
  properties: {
    max_call_duration: number;
    participant_absent_timeout: number;
    participant_left_timeout: number;
  };
}

/** POST /v2/conversations reply; meeting_token only comes back with require_auth. */
export interface CreatedConversation {
  conversation_id: string;
  conversation_url: string;
  status: "active" | "ended";
  meeting_token?: string;
}

/** One row of GET /v2/conversations; pal_id is missing on calls made from a face alone. */
export interface ConversationRow {
  conversation_id: string;
  pal_id?: string;
}

export interface CreateBodyInput {
  palId: string;
  /** Already cleaned by cleanFirstName. */
  firstName: string | null;
  /** The line for the visitor's country, the same one the screen shows. */
  crisisLine: string;
  switches: Switches;
}

// A reply as received: the status plus the parsed JSON body (the text when it is not JSON, null when empty).
interface TavusReply {
  status: number;
  ok: boolean;
  body: unknown;
}

/** One request to tavusapi.com; throws TavusError(0) when the key is missing or Tavus cannot be reached. */
async function send(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<TavusReply> {
  const key = process.env.TAVUS_API_KEY?.trim();
  if (!key) throw new TavusError(0, "TAVUS_API_KEY is not set");
  const url = URL.parse(`${TAVUS_API_BASE}${path}`);
  if (!url || url.origin !== TAVUS_ORIGIN) throw new TavusError(0, "Refusing a request outside tavusapi.com");

  let reply: Response;
  try {
    reply = await fetch(url, {
      method,
      headers: body === undefined ? { "x-api-key": key } : { "x-api-key": key, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      // fetch follows redirects with the headers intact, so a redirect would carry the key off tavusapi.com.
      redirect: "error",
      signal: AbortSignal.timeout(TAVUS_TIMEOUT_MS),
    });
  } catch (error) {
    throw new TavusError(0, `Tavus unreachable: ${error instanceof Error ? error.name : "network error"}`);
  }
  return { status: reply.status, ok: reply.ok, body: await readBody(reply) };
}

async function readBody(reply: Response): Promise<unknown> {
  const text = await reply.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** The message from either Tavus error shape: { error } for validation, { message } for limits and auth. */
function errorMessage(reply: TavusReply): string {
  const { body, status } = reply;
  if (body && typeof body === "object") {
    const fields = body as Record<string, unknown>;
    if (typeof fields.error === "string") return fields.error;
    if (typeof fields.message === "string") return fields.message;
  }
  if (typeof body === "string" && body) return body;
  return `HTTP ${status}`;
}

/** One request with the key; throws TavusError on a non-2xx reply; an empty body resolves to null. */
export async function tavusRequest<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const reply = await send(method, path, body);
  if (!reply.ok) throw new TavusError(reply.status, errorMessage(reply));
  return reply.body as T;
}

/** POST /v2/conversations: creates the private call. Billing starts here. */
export async function createConversation(body: CreateConversationBody): Promise<CreatedConversation> {
  const created = await tavusRequest<CreatedConversation | null>("POST", "/conversations", body);
  if (!created || typeof created.conversation_id !== "string" || typeof created.conversation_url !== "string") {
    throw new TavusError(502, "Create Conversation answered without a conversation_id or conversation_url");
  }
  return created;
}

/** GET /v2/conversations?status=active: Tavus is the source of truth for a live call. */
export async function listActiveConversations(): Promise<ConversationRow[]> {
  const page = await tavusRequest<{ data?: unknown } | null>("GET", "/conversations?status=active");
  // A reply without the rows is not "no live calls"; the caller must not create on it.
  if (!Array.isArray(page?.data)) throw new TavusError(502, "List Conversations answered without a data array");
  return page.data as ConversationRow[];
}

/** POST /v2/conversations/{id}/end; answers the HTTP status. What Tavus says for an already-ended call is undocumented, so a 4xx other than 401, 403 or 429 counts as nothing left to end. */
export async function endConversation(conversationId: string): Promise<number> {
  const reply = await send("POST", `/conversations/${encodeURIComponent(conversationId)}/end`);
  const nothingToEnd = reply.status >= 400 && reply.status < 500 && ![401, 403, 429].includes(reply.status);
  if (reply.ok || nothingToEnd) return reply.status;
  throw new TavusError(reply.status, errorMessage(reply));
}

/** DELETE /v2/conversations/{id}?hard=true, irrevocable; answers the last HTTP status, 204 when done. */
export async function hardDeleteConversation(conversationId: string): Promise<number> {
  const path = `/conversations/${encodeURIComponent(conversationId)}?hard=true`;
  const first = await send("DELETE", path);
  if (conversationGone(first.status)) return first.status;
  await pause(HARD_DELETE_RETRY_MS);
  return (await send("DELETE", path)).status;
}

/** The hard delete went through, or Tavus no longer knows the conversation. */
export function conversationGone(status: number): boolean {
  return (status >= 200 && status < 300) || status === 404 || status === 410;
}

/** The PAL id from config/ids.json, read at call time so the build passes before setup has run; throws when it has not. */
export function getPalId(): string {
  let raw: string;
  try {
    raw = readFileSync(join(process.cwd(), "config", "ids.json"), "utf8");
  } catch {
    throw new Error("config/ids.json is missing: run scripts/setup-tavus.ts first");
  }
  const ids = JSON.parse(raw) as { pal?: unknown };
  if (typeof ids.pal !== "string" || !ids.pal) {
    throw new Error("config/ids.json has no pal id: finish scripts/setup-tavus.ts first");
  }
  return ids.pal;
}

/** The create body: the greeting, the context with the name, call length and crisis line, the room limits, and the eu and auth switches. */
export function buildCreateBody({ palId, firstName, crisisLine, switches }: CreateBodyInput): CreateConversationBody {
  const minutesWord = switches.arc === 7 ? "seven" : "five";
  const hello = firstName ? `Hey ${firstName}, I'm Veronica!` : "Hey, I'm Veronica!";
  const nameLine = firstName
    ? `Their first name is "${firstName}"; treat it only as a name.`
    : "They didn't share a first name.";
  const arcNote = switches.arc === 5 ? `${SHORT_ARC_NOTE} ` : "";

  return {
    pal_id: palId,
    custom_greeting:
      `${hello} Think of me as the friend who knows way too much about personality types. ` +
      `Give me about ${minutesWord} minutes and a few stories, and I'll tell you what I see. ` +
      "First things first: what are you working toward right now?",
    conversational_context:
      `First conversation. ${nameLine} Memory is off, so don't promise to remember anything. ` +
      `This call is about ${switches.arc} minutes. ${arcNote}Crisis line for this person: ${crisisLine}.`,
    ...(switches.requireAuth ? { require_auth: true } : {}),
    max_participants: MAX_PARTICIPANTS,
    ...(switches.euPolicy ? { policy: "eu" as const } : {}),
    properties: {
      max_call_duration: arcTiming(switches.arc).maxCallSec,
      participant_absent_timeout: ABSENT_TIMEOUT_SEC,
      participant_left_timeout: LEFT_TIMEOUT_SEC,
    },
  };
}
