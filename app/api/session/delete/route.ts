// POST /api/session/delete: "Delete my data". Ends a live call first, since hard-deleting an
// active one is undocumented, then clears what Forge kept, then hard-deletes the Tavus
// conversation. The token goes last, once Tavus confirms, so the same request can be sent again
// until it does.

import { apiError, isConversationId, isRecord, json, logFailure, openStore, readJsonBody, tokenError } from "@/lib/server/http";
import { conversationGone, endConversation, hardDeleteConversation } from "@/lib/tavus";
import { SESSION_HEADER, type DeleteSessionResponse } from "@/lib/types";

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  if (!isRecord(body) || !isConversationId(body.conversationId)) return apiError("bad_request", 400);
  const conversationId = body.conversationId;
  const token = typeof body.sessionToken === "string" ? body.sessionToken : request.headers.get(SESSION_HEADER);
  if (!token) return apiError("forbidden", 403);
  const store = openStore();
  if (store instanceof Response) return store;

  try {
    const denied = tokenError(token, await store.getSessionToken(conversationId));
    if (denied) return denied;
  } catch (error) {
    logFailure("delete: store read", error);
    return apiError("store_unavailable", 503);
  }

  try {
    // Nothing has changed yet, so a failure here leaves the whole request safe to retry.
    await endConversation(conversationId);
  } catch (error) {
    logFailure("delete: Tavus end", error);
    return apiError("tavus", 502);
  }

  try {
    await store.clearSessionData(conversationId);
  } catch (error) {
    logFailure("delete: store clear", error);
    return apiError("store_unavailable", 503);
  }

  let tavusStatus: number | null = null;
  try {
    tavusStatus = await hardDeleteConversation(conversationId);
  } catch (error) {
    logFailure("delete: Tavus hard delete", error);
  }
  if (tavusStatus === null || !conversationGone(tavusStatus)) {
    console.error(`delete: Tavus hard delete answered ${tavusStatus ?? "nothing"}; token kept for a retry`);
    return json<DeleteSessionResponse>({ deleted: true, tavusStatus });
  }

  try {
    await store.deleteSession(conversationId);
  } catch (error) {
    logFailure("delete: store delete", error);
    return apiError("store_unavailable", 503);
  }
  return json<DeleteSessionResponse>({ deleted: true, tavusStatus });
}
