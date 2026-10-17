// POST /api/tools/synthesize-profile: Tavus's signed synthesize_profile call. The reply is
// text/plain and Tavus speaks it word for word, so every failure past the signature check answers
// 200 with the error line: a 5xx would make Tavus retry, a timeout would make the model improvise.

import { setTimeout as pause } from "node:timers/promises";
import { z } from "zod";
import { logFailure } from "@/lib/server/http";
import { describeSignature, tavusSignatureMatches } from "@/lib/server/signature";
import { getStore, type ForgeStore, type SynthesisContext } from "@/lib/store";
import { synthesize } from "@/lib/synthesize";
import { parseSynthesizeArgs } from "@/lib/synth/parse";
import { SPOKEN_CRISIS, spokenError, spokenF05 } from "@/lib/synth/templates";
import { SIGNATURE_HEADER, STORE_HEADER, type StoreKind } from "@/lib/types";

// The turn that triggered this call reaches the store through the browser, a different path from
// Tavus's call, so it can land a moment later: how long to wait for it, and how often to look.
const TURN_WAIT_MS = 8000;
const TURN_POLL_MS = 250;

const PLAIN_TEXT = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };

// The hmac-mode envelope; arguments is the model's JSON string.
const envelopeSchema = z.object({
  arguments: z.union([z.string(), z.record(z.string(), z.unknown())]),
  conversation_id: z.string().min(1).max(128),
  tool_call_id: z.string().max(256).nullable().optional(),
  inference_id: z.string().nullable().optional(),
  name: z.string().optional(),
  turn_idx: z.number().nullable().optional(),
});

/** The words Tavus speaks, with the store backend in x-forge-store once it is known. */
function spoken(text: string, storeKind: StoreKind | null): Response {
  const headers: Record<string, string> = { ...PLAIN_TEXT };
  if (storeKind) headers[STORE_HEADER] = storeKind;
  return new Response(text, { status: 200, headers });
}

export async function POST(request: Request): Promise<Response> {
  // Tavus signs the exact bytes it sent, so nothing is parsed before the signature passes.
  const raw = new Uint8Array(await request.arrayBuffer());
  const signature = request.headers.get(SIGNATURE_HEADER);
  if (!tavusSignatureMatches(raw, signature, process.env.TOOL_HMAC_SECRET)) {
    console.error(`synthesize-profile: signature rejected, ${describeSignature(signature)}`);
    return new Response("Invalid signature", { status: 401, headers: PLAIN_TEXT });
  }

  let storeKind: StoreKind | null = null;
  let goalsOnScreen = false;
  try {
    const envelope = envelopeSchema.parse(JSON.parse(new TextDecoder().decode(raw)));
    const store = getStore();
    storeKind = store.kind;
    const conversationId = envelope.conversation_id;
    const toolCallId = envelope.tool_call_id || null;

    // A call Forge never stored, or one deleted a moment ago, gets the refusal and leaves nothing behind.
    if ((await store.getSessionToken(conversationId)) === null) return spoken(spokenF05(false), storeKind);

    // Tavus retries a 5xx once with the same tool_call_id: the same words go back.
    const already = toolCallId ? await store.getSpokenText(conversationId, toolCallId) : null;
    if (already !== null) return spoken(already, storeKind);

    const context = await contextWithTurn(store, conversationId, envelope.inference_id ?? null);
    goalsOnScreen = context.goals.length > 0;
    const text = await spokenTextFor(store, conversationId, envelope.arguments, context);
    if (toolCallId) await store.setSpokenText(conversationId, toolCallId, text);
    return spoken(text, storeKind);
  } catch (error) {
    logFailure("synthesize-profile", error);
    return spoken(spokenError(goalsOnScreen), storeKind);
  }
}

/** Re-reads the call until a stored turn carries the envelope's inference_id, for at most 8 s; the static filler covers the wait. After a crisis, or once a reading exists, no turn is needed. */
async function contextWithTurn(store: ForgeStore, conversationId: string, inferenceId: string | null): Promise<SynthesisContext> {
  const deadline = Date.now() + TURN_WAIT_MS;
  const settled = (context: SynthesisContext) =>
    context.crisis || context.profile !== null || !inferenceId || context.turns.some((turn) => turn.inference_id === inferenceId);
  let context = await store.getSynthesisContext(conversationId);
  while (!settled(context) && Date.now() < deadline) {
    await pause(TURN_POLL_MS);
    context = await store.getSynthesisContext(conversationId);
  }
  return context;
}

/** The calm line after a crisis, the reveal already given (one reading per call), or a new reading, stored with its Debug record. */
async function spokenTextFor(store: ForgeStore, conversationId: string, rawArgs: unknown, context: SynthesisContext): Promise<string> {
  if (context.crisis) return SPOKEN_CRISIS;
  if (context.profile) return context.profile.spoken_reveal;
  const { args, report } = parseSynthesizeArgs(rawArgs);
  const reading = synthesize({ args, turns: context.turns, goals: context.goals, crisis: false }, report);
  await store.setProfile(conversationId, reading.profile, reading.debug);
  return reading.spokenText;
}
