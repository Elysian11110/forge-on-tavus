// The signed synthesize_profile route, called directly: the Sam envelope, signed with a test
// secret over its exact bytes, against the memory store. 200 text/plain with the expected words,
// the same text on a repeated tool_call_id, one reading per call, 401 on a bad signature, the calm
// line under the crisis flag, nothing stored for a call Forge does not know.

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/tools/synthesize-profile/route";
import { getStore } from "@/lib/store";
import { SPOKEN_CRISIS, f01Reveal, spokenError, spokenF05 } from "@/lib/synth/templates";
import { STORE_HEADER } from "@/lib/types";
import { SAM_CONVERSATION_ID, SAM_EXPECTED_REVEAL, SAM_TOOL_CALL_ID, samArguments, samGoals, samTurns } from "./fixtures/sam";

/** A throwaway secret for this file only; the real one stays in .env.local. */
const TEST_SECRET = "route-test-secret-not-a-real-one";

/** Raw request bytes; an ArrayBuffer-backed view, which is what a Request body accepts. */
type Bytes = Uint8Array<ArrayBuffer>;

/** The fixture's exact bytes, the same bytes the production curl signs and posts. */
const ENVELOPE: Bytes = new Uint8Array(readFileSync(fileURLToPath(new URL("./fixtures/envelope.json", import.meta.url))));

/** Hex HMAC-SHA256 of the raw bytes, as Tavus sends it in X-Tavus-Signature. */
function sign(body: Bytes, secret = TEST_SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function post(body: Bytes, signature: string | null): Promise<Response> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (signature !== null) headers.set("X-Tavus-Signature", signature);
  return POST(new Request("http://localhost/api/tools/synthesize-profile", { method: "POST", headers, body }));
}

/** The Sam envelope with some fields changed, compact as Tavus sends it. */
function envelopeWith(changes: Record<string, unknown>): Bytes {
  const envelope = JSON.parse(new TextDecoder().decode(ENVELOPE)) as Record<string, unknown>;
  return new TextEncoder().encode(JSON.stringify({ ...envelope, ...changes }));
}

/** What the browser relays during Sam's call: the session, both goals and every user turn. */
async function seedSam(turns = samTurns): Promise<void> {
  const store = getStore();
  await store.createSession(SAM_CONVERSATION_ID, "session-token-for-the-route-test");
  for (const goal of samGoals) await store.addGoal(SAM_CONVERSATION_ID, goal, null);
  for (const turn of turns) await store.addUserTurn(SAM_CONVERSATION_ID, turn.speech, turn.inference_id);
}

async function storedView() {
  return (await getStore().getSession(SAM_CONVERSATION_ID))?.view ?? null;
}

// Rejected signatures and unreadable bodies are logged on purpose; the tests keep that off the console.
const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => {
  vi.stubEnv("TOOL_HMAC_SECRET", TEST_SECRET);
  // The memory store, whatever the shell has set: no Upstash pair, not on Vercel.
  for (const name of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "VERCEL"]) {
    vi.stubEnv(name, "");
  }
});

afterAll(() => {
  vi.unstubAllEnvs();
  quiet.mockRestore();
});

beforeEach(async () => {
  await getStore().deleteSession(SAM_CONVERSATION_ID);
});

afterEach(() => {
  quiet.mockClear();
});

describe("POST /api/tools/synthesize-profile", () => {
  it("answers the signed Sam envelope with 200 text/plain and the expected words, and stores the reading", async () => {
    await seedSam();
    const reply = await post(ENVELOPE, sign(ENVELOPE));
    expect(reply.status).toBe(200);
    expect(reply.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(reply.headers.get(STORE_HEADER)).toBe("memory");
    expect(await reply.text()).toBe(SAM_EXPECTED_REVEAL);

    const view = await storedView();
    expect(view?.profile).toMatchObject({
      status: "partial",
      triggers: ["F04"],
      trc: "RNT",
      callsign: "Planning",
      spoken_reveal: SAM_EXPECTED_REVEAL,
    });
    expect(view?.debug).toEqual({
      evidence_sent: 6,
      evidence_matched: 6,
      unmatched: [],
      triggers: [{ id: "F04", count: 0 }],
      replaced: [],
    });
  });

  it("gives a repeated tool_call_id the same text, from the store rather than a second reading", async () => {
    await seedSam();
    const first = await (await post(ENVELOPE, sign(ENVELOPE))).text();
    expect(first).toBe(SAM_EXPECTED_REVEAL);

    const again = await post(ENVELOPE, sign(ENVELOPE));
    expect(again.status).toBe(200);
    expect(again.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(await again.text()).toBe(first);

    // Recomputed, trc_code none would refuse the type (F01); the retry still gets the first words.
    const changed = envelopeWith({ arguments: JSON.stringify({ ...samArguments, trc_code: "none" }) });
    expect(await (await post(changed, sign(changed))).text()).toBe(first);
    expect(await getStore().getSpokenText(SAM_CONVERSATION_ID, SAM_TOOL_CALL_ID)).toBe(first);
  });

  it("gives one reading per call: a second call with a new tool_call_id gets the first reveal back, not a new one", async () => {
    await seedSam();
    const first = await (await post(ENVELOPE, sign(ENVELOPE))).text();
    const second = envelopeWith({ tool_call_id: "call_forge_fixture_sam_2", arguments: JSON.stringify({ ...samArguments, trc_code: "none" }) });
    expect(await (await post(second, sign(second))).text()).toBe(first);
    expect((await storedView())?.profile?.trc).toBe("RNT");
    expect(await getStore().getSpokenText(SAM_CONVERSATION_ID, "call_forge_fixture_sam_2")).toBe(first);
  });

  it("waits for the turn that triggered the call when the browser's relay lands a moment late", async () => {
    const lastTurn = samTurns[samTurns.length - 1];
    await seedSam(samTurns.slice(0, -1));
    const late = pause(500).then(() => getStore().addUserTurn(SAM_CONVERSATION_ID, lastTurn.speech, lastTurn.inference_id));
    const reply = post(ENVELOPE, sign(ENVELOPE));
    await late;
    // Without that turn only two answers back the lens, and the reveal would be the F01 line.
    expect(await (await reply).text()).toBe(SAM_EXPECTED_REVEAL);
    expect((await storedView())?.debug?.evidence_matched).toBe(6);
    expect(f01Reveal("")).not.toBe(SAM_EXPECTED_REVEAL);
  });

  it("answers 401 to a bad, missing or wrong-secret signature, or changed bytes, and stores nothing", async () => {
    await seedSam();
    // One extra newline byte, the change curl -d instead of --data-binary would make.
    const changedBytes: Bytes = new Uint8Array([...ENVELOPE, 0x0a]);
    const attempts: [Bytes, string | null][] = [
      [ENVELOPE, "bad"],
      [ENVELOPE, null],
      [ENVELOPE, sign(ENVELOPE, "some-other-secret")],
      [changedBytes, sign(ENVELOPE)],
    ];
    for (const [body, signature] of attempts) {
      const reply = await post(body, signature);
      expect(reply.status).toBe(401);
      expect(await reply.text()).toBe("Invalid signature");
    }
    expect(quiet).toHaveBeenCalledTimes(attempts.length);
    expect(await getStore().getSpokenText(SAM_CONVERSATION_ID, SAM_TOOL_CALL_ID)).toBeNull();
    expect((await storedView())?.profile).toBeNull();
  });

  it("speaks the calm line under the crisis flag and keeps no reading", async () => {
    await seedSam();
    await getStore().setCrisis(SAM_CONVERSATION_ID);
    const reply = await post(ENVELOPE, sign(ENVELOPE));
    expect(reply.status).toBe(200);
    expect(reply.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(await reply.text()).toBe(SPOKEN_CRISIS);
    const view = await storedView();
    expect(view?.crisis).toBe(true);
    expect(view?.profile).toBeNull();
  });

  it("answers a call Forge never stored with the F05 line and writes nothing, as the production curl expects", async () => {
    const reply = await post(ENVELOPE, sign(ENVELOPE));
    expect(reply.status).toBe(200);
    expect(reply.headers.get(STORE_HEADER)).toBe("memory");
    expect(await reply.text()).toBe(spokenF05(false));
    expect(await getStore().getSession(SAM_CONVERSATION_ID)).toBeNull();
    expect(await getStore().getSpokenText(SAM_CONVERSATION_ID, SAM_TOOL_CALL_ID)).toBeNull();
  });

  it("answers a signed body it cannot read with the error line, never a status Tavus would retry", async () => {
    const garbled = new TextEncoder().encode("{not json");
    const reply = await post(garbled, sign(garbled));
    expect(reply.status).toBe(200);
    expect(await reply.text()).toBe(spokenError(false));
    expect(quiet).toHaveBeenCalledWith("synthesize-profile: SyntaxError in the body");
  });
});
