// The memory backend, the one the tests and local dev run on: a repeat is stored once, the turn
// cap holds, a call is forgotten after 24 hours, and Delete my data keeps the token until Tavus
// confirms. The Upstash backend speaks the same interface against a live store, so it is checked
// by the production curl instead.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_USER_TURNS, STORE_TTL_SECONDS, getStore } from "@/lib/store";
import { synthesize } from "@/lib/synthesize";
import { SAM_CONVERSATION_ID, samGoals, samInput, samTurns } from "./fixtures/sam";

const CALL = SAM_CONVERSATION_ID;
const TOKEN = "session-token-for-the-store-test";

beforeAll(() => {
  for (const name of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "VERCEL"]) {
    vi.stubEnv(name, "");
  }
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

beforeEach(async () => {
  vi.useRealTimers();
  const store = getStore();
  await store.deleteSession(CALL);
});

describe("the memory store", () => {
  it("reports itself as memory when no Upstash pair is set", () => {
    expect(getStore().kind).toBe("memory");
  });

  it("stores a goal once per tool_call_id, newest per slot, and a turn once per inference_id", async () => {
    const store = getStore();
    await store.createSession(CALL, TOKEN);
    expect(await store.addGoal(CALL, samGoals[0], "call_goal_1")).toBe(true);
    expect(await store.addGoal(CALL, samGoals[0], "call_goal_1")).toBe(false);
    expect(await store.addGoal(CALL, { ...samGoals[0], goal: "Open my pottery shop, properly" }, "call_goal_2")).toBe(true);
    expect(await store.addUserTurn(CALL, samTurns[0].speech, "inf_1")).toBe(true);
    expect(await store.addUserTurn(CALL, samTurns[0].speech, "inf_1")).toBe(false);
    expect(await store.addUserTurn(CALL, samTurns[1].speech, null)).toBe(true);

    const context = await store.getSynthesisContext(CALL);
    expect(context.goals.map((goal) => goal.goal)).toEqual(["Open my pottery shop, properly"]);
    expect(context.turns.map((turn) => [turn.n, turn.inference_id])).toEqual([[1, "inf_1"], [2, null]]);
    expect(context).toMatchObject({ crisis: false, profile: null });
  });

  it("keeps at most 200 turns", async () => {
    const store = getStore();
    await store.createSession(CALL, TOKEN);
    for (let n = 1; n <= MAX_USER_TURNS; n += 1) expect(await store.addUserTurn(CALL, `turn ${n}`, null)).toBe(true);
    expect(await store.addUserTurn(CALL, "one too many", null)).toBe(false);
    expect((await store.getSynthesisContext(CALL)).turns).toHaveLength(MAX_USER_TURNS);
  });

  it("checks the token on the poll and hands the reading back with its Debug record", async () => {
    const store = getStore();
    await store.createSession(CALL, TOKEN);
    const reading = synthesize(samInput());
    await store.setProfile(CALL, reading.profile, reading.debug);
    await store.setSpokenText(CALL, "call_1", reading.spokenText);
    const session = await store.getSession(CALL);
    expect(session?.sessionToken).toBe(TOKEN);
    expect(session?.view).toMatchObject({ state: "live", crisis: false, profile: reading.profile, debug: reading.debug });
    expect((await store.getSynthesisContext(CALL)).profile).toEqual(reading.profile);
    expect(await store.getSpokenText(CALL, "call_1")).toBe(reading.spokenText);
    await store.endSession(CALL);
    expect((await store.getSession(CALL))?.view.state).toBe("ended");
  });

  it("forgets a call 24 hours after its last write", async () => {
    vi.useFakeTimers();
    const store = getStore();
    await store.createSession(CALL, TOKEN);
    vi.advanceTimersByTime(STORE_TTL_SECONDS * 1000 - 1);
    expect(await store.getSessionToken(CALL)).toBe(TOKEN);
    vi.advanceTimersByTime(1);
    expect(await store.getSessionToken(CALL)).toBeNull();
    expect(await store.getSession(CALL)).toBeNull();
  });

  it("clears the call's data but keeps the token, so Delete my data can be sent again; deleteSession drops the token too", async () => {
    const store = getStore();
    await store.createSession(CALL, TOKEN);
    await store.addGoal(CALL, samGoals[0], null);
    await store.addUserTurn(CALL, samTurns[0].speech, "inf_1");
    await store.setCrisis(CALL);
    await store.endSession(CALL);
    await store.clearSessionData(CALL);
    expect(await store.getSessionToken(CALL)).toBe(TOKEN);
    expect(await store.getSynthesisContext(CALL)).toEqual({ turns: [], goals: [], crisis: false, profile: null });
    expect((await store.getSession(CALL))?.view.state).toBe("ended");
    await store.deleteSession(CALL);
    expect(await store.getSessionToken(CALL)).toBeNull();
  });
});
