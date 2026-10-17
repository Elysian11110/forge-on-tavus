// POST /api/events: the browser relays a save_goal call, the text of a user turn, or the crisis
// guardrail. Checked against the session token; a repeat is stored once.

import { z } from "zod";
import { apiError, isConversationId, isRecord, json, logFailure, openStore, readJsonBody, tokenError } from "@/lib/server/http";
import type { ForgeStore } from "@/lib/store";
import { GOAL_IDS, SESSION_HEADER, type EventsResponse } from "@/lib/types";

// Generous caps: a goal a few characters over the tool's limit still counts, abuse does not.
const CAP = { id: 256, goal: 500, by_when: 200, user_quote: 1000, speech: 5000, reason: 1000 };

const relayId = z.string().max(CAP.id).nullable().optional();

const relaySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("goal"),
    data: z.object({
      goal_id: z.enum(GOAL_IDS),
      goal: z.string().max(CAP.goal).refine((goal) => goal.trim().length > 0),
      by_when: z.string().max(CAP.by_when).optional(),
      user_quote: z.string().max(CAP.user_quote).optional(),
      tool_call_id: relayId,
    }),
  }),
  z.object({
    kind: z.literal("user_turn"),
    data: z.object({ speech: z.string().max(CAP.speech), inference_id: relayId }),
  }),
  z.object({
    kind: z.literal("crisis"),
    data: z.object({ reason: z.string().max(CAP.reason).nullable().optional() }).optional(),
  }),
]);

type Relay = z.output<typeof relaySchema>;

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  if (!isRecord(body) || !isConversationId(body.conversationId)) return apiError("bad_request", 400);
  const conversationId = body.conversationId;
  const token = request.headers.get(SESSION_HEADER);
  if (!token) return apiError("forbidden", 403);
  const store = openStore();
  if (store instanceof Response) return store;

  try {
    const denied = tokenError(token, await store.getSessionToken(conversationId));
    if (denied) return denied;
    const relay = relaySchema.safeParse(body);
    if (!relay.success) return apiError("bad_request", 400);
    await keep(store, conversationId, relay.data);
  } catch (error) {
    logFailure("events", error);
    return apiError("store_unavailable", 503);
  }
  return json<EventsResponse>({ ok: true });
}

/** Stores one relayed event; the store itself drops a repeated tool_call_id or inference_id. */
async function keep(store: ForgeStore, conversationId: string, relay: Relay): Promise<void> {
  switch (relay.kind) {
    case "goal": {
      const { goal_id, goal, by_when, user_quote, tool_call_id } = relay.data;
      await store.addGoal(conversationId, { goal_id, goal, by_when: by_when ?? "not said", user_quote: user_quote ?? "" }, tool_call_id ?? null);
      return;
    }
    case "user_turn": {
      // An empty turn has nothing to match a quote against.
      if (!relay.data.speech.trim()) return;
      await store.addUserTurn(conversationId, relay.data.speech, relay.data.inference_id ?? null);
      return;
    }
    case "crisis":
      await store.setCrisis(conversationId);
  }
}
