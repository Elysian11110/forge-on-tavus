// The browser's calls to Forge's own routes, same origin only: the Tavus key never reaches the
// browser, and every call after the create carries the session token.

import {
  SESSION_HEADER,
  type ApiErrorCode,
  type CreateSessionRequest,
  type CreateSessionResponse,
  type DeleteSessionResponse,
  type EndSessionRequest,
  type EndSessionResponse,
  type EventsRequest,
  type EventsResponse,
  type SessionView,
} from "@/lib/types";

/** What the browser keeps to talk about its own call. */
export interface SessionRef {
  conversationId: string;
  sessionToken: string;
}

/** A route reply: the body on 2xx; otherwise the HTTP status (0 when the network failed) and the error code. */
export type RouteReply<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: ApiErrorCode | null };

/** Relays and polls give up after this, so one hung request never holds back what is queued behind it. */
const QUICK_TIMEOUT_MS = 8000;

/** A network failure or a 5xx: the kind of miss a second try can fix. */
export function worthRetrying(reply: RouteReply<unknown>): boolean {
  return !reply.ok && (reply.status === 0 || reply.status >= 500);
}

function errorCode(body: unknown): ApiErrorCode | null {
  if (!body || typeof body !== "object" || !("error" in body)) return null;
  return typeof body.error === "string" ? (body.error as ApiErrorCode) : null;
}

async function request<T>(url: string, init: RequestInit): Promise<RouteReply<T>> {
  try {
    const response = await fetch(url, { ...init, cache: "no-store" });
    const body: unknown = await response.json().catch(() => null);
    if (response.ok) return { ok: true, data: body as T };
    return { ok: false, status: response.status, error: errorCode(body) };
  } catch {
    return { ok: false, status: 0, error: null };
  }
}

function postJson(body: unknown, sessionToken?: string): RequestInit {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionToken ? { [SESSION_HEADER]: sessionToken } : {}),
    },
    body: JSON.stringify(body),
  };
}

function endBody(session: SessionRef): EndSessionRequest {
  return { conversationId: session.conversationId, sessionToken: session.sessionToken };
}

/** POST /api/session: checks the passcode and creates the private call. Billing starts here. */
export function createSession(body: CreateSessionRequest): Promise<RouteReply<CreateSessionResponse>> {
  return request("/api/session", postJson(body));
}

/** GET /api/session?c=: the 3 s poll. */
export function fetchSessionView(session: SessionRef): Promise<RouteReply<SessionView>> {
  return request(`/api/session?c=${encodeURIComponent(session.conversationId)}`, {
    headers: { [SESSION_HEADER]: session.sessionToken },
    signal: AbortSignal.timeout(QUICK_TIMEOUT_MS),
  });
}

/** POST /api/events: relays a goal, the text of a user turn, or the crisis flag. */
export function postEvent(session: SessionRef, event: EventsRequest): Promise<RouteReply<EventsResponse>> {
  return request("/api/events", {
    ...postJson(event, session.sessionToken),
    signal: AbortSignal.timeout(QUICK_TIMEOUT_MS),
  });
}

/** POST /api/session/end, with keepalive so it still lands while the page changes. */
export function endSession(session: SessionRef): Promise<RouteReply<EndSessionResponse>> {
  return request("/api/session/end", { ...postJson(endBody(session), session.sessionToken), keepalive: true });
}

/**
 * The tab-close path: a beacon cannot set headers, so the token rides in the body. A string goes out
 * as text/plain, which every browser beacons; Chrome refuses a Blob typed application/json
 * (crbug.com/490015). The route parses the body as JSON whatever its type.
 */
export function sendEndBeacon(session: SessionRef): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return false;
  try {
    return navigator.sendBeacon("/api/session/end", JSON.stringify(endBody(session)));
  } catch {
    return false;
  }
}

/** POST /api/session/delete: ends a live call, wipes Forge's copy and hard-deletes the Tavus conversation. */
export function deleteSession(session: SessionRef): Promise<RouteReply<DeleteSessionResponse>> {
  return request("/api/session/delete", postJson(endBody(session), session.sessionToken));
}
