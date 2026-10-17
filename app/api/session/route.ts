// POST /api/session creates the private call; GET /api/session?c= is the browser's 3 s poll, one
// pipelined store read checked against the session token.

import { setTimeout as pause } from "node:timers/promises";
import { cleanFirstName, crisisLineFor } from "@/lib/safety";
import { newSessionToken } from "@/lib/server/auth";
import {
  apiError,
  isConversationId,
  isRecord,
  json,
  logFailure,
  openStore,
  readJsonBody,
  tokenError,
} from "@/lib/server/http";
import type { ForgeStore, StoredSession } from "@/lib/store";
import { arcTiming, readSwitches, type Switches } from "@/lib/switches";
import {
  buildCreateBody,
  createConversation,
  endConversation,
  getPalId,
  listActiveConversations,
  TavusError,
  type CreatedConversation,
} from "@/lib/tavus";
import { SESSION_HEADER, type CreateSessionResponse, type GetSessionResponse } from "@/lib/types";

// How long a create that timed out gets to land on Tavus's side before the orphan check lists it.
const ORPHAN_SETTLE_MS = 3000;

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  if (!isRecord(body)) return apiError("bad_request", 400);
  const store = openStore();
  if (store instanceof Response) return store;

  // Everything that can fail without spending minutes comes before the create.
  if (body.consent !== true) return apiError("consent_required", 400);

  let palId: string;
  try {
    palId = getPalId();
  } catch (error) {
    logFailure("session: no PAL", error);
    return apiError("not_configured", 503);
  }

  try {
    if ((await listActiveConversations()).length > 0) return apiError("call_live", 409);
  } catch (error) {
    logFailure("session: live-call check", error);
    return apiError("tavus", 502);
  }

  const switches = readSwitches();
  const createBody = buildCreateBody({
    palId,
    firstName: cleanFirstName(body.firstName),
    crisisLine: crisisLineFor(request.headers.get("x-vercel-ip-country")),
    switches,
  });

  let created: CreatedConversation;
  try {
    created = await createConversation(createBody);
  } catch (error) {
    logFailure("session: create", error);
    // Tavus answers its concurrency limit with a 400 message: a live call by another name.
    if (error instanceof TavusError && /concurrent/i.test(error.message)) return apiError("call_live", 409);
    if (mayHaveCreated(error)) await endOrphans(palId);
    return apiError("tavus", 502);
  }
  return handOver(store, created, switches);
}

export async function GET(request: Request): Promise<Response> {
  const conversationId = new URL(request.url).searchParams.get("c");
  if (!isConversationId(conversationId)) return apiError("bad_request", 400);
  const token = request.headers.get(SESSION_HEADER);
  if (!token) return apiError("forbidden", 403);
  const store = openStore();
  if (store instanceof Response) return store;

  let stored: StoredSession | null;
  try {
    stored = await store.getSession(conversationId);
  } catch (error) {
    logFailure("session: poll", error);
    return apiError("store_unavailable", 503);
  }
  const denied = tokenError(token, stored?.sessionToken ?? null);
  if (denied || !stored) return denied ?? apiError("not_found", 404);
  return json<GetSessionResponse>(stored.view);
}

/** Hands the created call to the browser once the store has its session; a call the browser could not use is ended first, so it stops billing. */
async function handOver(store: ForgeStore, created: CreatedConversation, switches: Switches): Promise<Response> {
  const conversationId = created.conversation_id;
  const unusable = unusableReason(created, switches);
  if (unusable) {
    console.error(`session: ${unusable}; ending ${conversationId}`);
    await endQuietly(conversationId);
    return apiError("tavus", 502);
  }

  const sessionToken = newSessionToken();
  try {
    await store.createSession(conversationId, sessionToken);
  } catch (error) {
    logFailure("session: store write", error);
    await endQuietly(conversationId);
    return apiError("store_unavailable", 503);
  }
  return json<CreateSessionResponse>({
    conversationId,
    conversationUrl: created.conversation_url,
    meetingToken: created.meeting_token || null,
    sessionToken,
    timing: arcTiming(switches.arc),
  });
}

/** Why a created call cannot be handed to the browser: a private room must come with its token. */
function unusableReason(created: CreatedConversation, switches: Switches): string | null {
  if (switches.requireAuth && !created.meeting_token) return "require_auth call came back without a meeting_token";
  return null;
}

/** A timeout or a 5xx can arrive after Tavus accepted the create, so the call may exist and bill. */
function mayHaveCreated(error: unknown): boolean {
  return error instanceof TavusError && (error.status === 0 || error.status >= 500);
}

/** The live-call check found nothing a moment ago, so any live call of Forge's PAL now is the one nobody will join. */
async function endOrphans(palId: string): Promise<void> {
  await pause(ORPHAN_SETTLE_MS);
  try {
    for (const row of await listActiveConversations()) {
      if (row.pal_id === palId) await endQuietly(row.conversation_id);
    }
  } catch (error) {
    logFailure("session: orphan check", error);
  }
}

/** Ends a call this route cannot hand over, so it stops billing; a failure is only logged. */
async function endQuietly(conversationId: string): Promise<void> {
  try {
    await endConversation(conversationId);
    console.info(`session: ended ${conversationId}`);
  } catch (error) {
    logFailure(`session: could not end ${conversationId}`, error);
  }
}
