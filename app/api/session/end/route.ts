// POST /api/session/end: the End button, the room closing and the tab-close beacon all land here.
// A call already marked ended answers without asking Tavus again.

import { isRecord } from "@/lib/guards";
import { apiError, authorizedSession, isConversationId, json, logFailure, readJsonBody } from "@/lib/server/http";
import { endConversation } from "@/lib/tavus";
import { SESSION_HEADER, type EndSessionResponse } from "@/lib/types";

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  if (!isRecord(body) || !isConversationId(body.conversationId)) return apiError("bad_request", 400);
  const conversationId = body.conversationId;
  // The beacon cannot set headers, so the token rides in the body; the header works too.
  const token = typeof body.sessionToken === "string" ? body.sessionToken : request.headers.get(SESSION_HEADER);
  const session = await authorizedSession(request, conversationId, token);
  if (session instanceof Response) return session;
  const { store, stored } = session;
  if (stored.view.state === "ended") return json<EndSessionResponse>({ ended: true });

  try {
    await endConversation(conversationId);
  } catch (error) {
    // The call stays marked live so a retry ends it; the browser leaving also starts Tavus's 10 s left timeout.
    logFailure("end: Tavus end", error);
    return apiError("tavus", 502);
  }

  try {
    await store.endSession(conversationId);
  } catch (error) {
    logFailure("end: store write", error);
    return apiError("store_unavailable", 503);
  }
  return json<EndSessionResponse>({ ended: true });
}
