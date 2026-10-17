// Shared by the API routes: JSON replies, the body read, the id check, the session lookup behind
// the token check, the store opener and the one log line per failure. Server only.

import { ZodError } from "zod";
import { safeEqual } from "@/lib/server/auth";
import { getStore, StoreUnavailableError, type ForgeStore, type StoredSession } from "@/lib/store";
import { TavusError } from "@/lib/tavus";
import { SESSION_HEADER, type ApiError, type ApiErrorCode } from "@/lib/types";

const NO_CACHE = { "Cache-Control": "no-store" };

// Error messages are cut to this before they are logged.
const MESSAGE_CUT = 200;

/** A JSON reply that no cache keeps. */
export function json<T>(body: T, status = 200): Response {
  return Response.json(body, { status, headers: NO_CACHE });
}

export function apiError(error: ApiErrorCode, status: number): Response {
  return json<ApiError>({ error }, status);
}

/** The body as JSON whatever its content type, since the tab-close beacon sends text/plain; undefined when it is not JSON. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text().catch(() => "");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Tavus conversation ids are short and alphanumeric; anything else never reaches a Tavus URL or a store key. */
export function isConversationId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

/** The store, or the 503 reply when Upstash is not connected on Vercel. */
export function openStore(): ForgeStore | Response {
  try {
    return getStore();
  } catch (error) {
    if (!(error instanceof StoreUnavailableError)) throw error;
    console.error(error.message);
    return apiError("store_unavailable", 503);
  }
}

/** 403 on a mismatch, 404 for a conversation the store does not know, null when the token matches. */
function tokenError(provided: string, stored: string | null): Response | null {
  if (stored === null) return apiError("not_found", 404);
  return safeEqual(provided, stored) ? null : apiError("forbidden", 403);
}

/** The store and the stored session once the token matches, else the reply to send. */
export interface AuthorizedSession {
  store: ForgeStore;
  stored: StoredSession;
}

/**
 * The session behind a conversation, checked against the token: 403 without a token or on a
 * mismatch, 404 for a call the store does not know, 503 when the store is down or unreachable.
 * The token is the session header unless the route read it from somewhere else.
 */
export async function authorizedSession(
  request: Request,
  conversationId: string,
  token: string | null = request.headers.get(SESSION_HEADER),
): Promise<AuthorizedSession | Response> {
  if (!token) return apiError("forbidden", 403);
  const store = openStore();
  if (store instanceof Response) return store;

  let stored: StoredSession | null;
  try {
    stored = await store.getSession(conversationId);
  } catch (error) {
    logFailure(`${new URL(request.url).pathname}: store read`, error);
    return apiError("store_unavailable", 503);
  }
  const denied = tokenError(token, stored?.sessionToken ?? null);
  if (denied || !stored) return denied ?? apiError("not_found", 404);
  return { store, stored };
}

/** One log line per failure, with nothing from the request in it. */
export function logFailure(where: string, error: unknown): void {
  console.error(`${where}: ${describeFailure(error)}`);
}

function describeFailure(error: unknown): string {
  if (error instanceof TavusError) return `Tavus ${error.status || "unreachable"}: ${error.message.slice(0, MESSAGE_CUT)}`;
  // A JSON or zod error quotes the text it choked on, which can be the person's own words.
  if (error instanceof SyntaxError || error instanceof ZodError) return `${error.name} in the body`;
  // UpstashError appends ", command was: [...]" with the keys and values sent (tokens, spoken words).
  if (error instanceof Error) return `${error.name}: ${error.message.split(", command was:")[0].slice(0, MESSAGE_CUT)}`;
  return "unknown error";
}
