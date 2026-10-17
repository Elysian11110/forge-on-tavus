// POST /api/report: after the call, the full seven-system Forge report, built by the Forge site's own
// engine from what the person said. Their turns go to the site's free-text extractor, the life
// phase it returns goes to its unified scorer, and the result comes back as the site's own
// shared-report link (the report lives in the link, nothing is kept on the Forge site).

import { apiError, isConversationId, isRecord, json, logFailure, openStore, readJsonBody, tokenError } from "@/lib/server/http";
import type { StoredSession, SynthesisContext } from "@/lib/store";
import { SESSION_HEADER, type ReportResponse } from "@/lib/types";

// The unified scorer takes about a minute and a half, longer on a long call.
export const maxDuration = 300;

const FORGE_SITE = "https://forge-jet.vercel.app";
// The extractor's own input cap.
const MAX_TEXT_CHARS = 10_000;
// Below this there isn't enough of their own words to read anything from.
const MIN_TEXT_CHARS = 200;
const EXTRACT_TIMEOUT_MS = 60_000;
const SCORE_TIMEOUT_MS = 280_000;

/** Their own words in the order they said them, goals first. */
function storyText({ goals, turns }: SynthesisContext): string {
  const goalLines = goals.map((goal) => `Working toward: ${goal.user_quote || goal.goal}`);
  return [...goalLines, ...turns.map((turn) => turn.speech)].join("\n").slice(0, MAX_TEXT_CHARS);
}

async function postToForge(path: string, body: unknown, timeoutMs: number): Promise<Record<string, unknown>> {
  const reply = await fetch(`${FORGE_SITE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const parsed: unknown = await reply.json().catch(() => null);
  if (!reply.ok || !isRecord(parsed) || "error" in parsed) throw new Error(`${path} answered ${reply.status}`);
  return parsed;
}

/** The Forge site's shared-report link: the slim report as base64url JSON in ?d=. */
function reportUrl(result: Record<string, unknown>): string {
  const { headline, summary, summaryBullets, method, systems } = result;
  const encoded = Buffer.from(JSON.stringify({ headline, summary, summaryBullets, method, systems }), "utf-8").toString("base64url");
  return `${FORGE_SITE}/r?d=${encoded}`;
}

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  if (!isRecord(body) || !isConversationId(body.conversationId)) return apiError("bad_request", 400);
  const conversationId = body.conversationId;
  const token = request.headers.get(SESSION_HEADER);
  if (!token) return apiError("forbidden", 403);
  const store = openStore();
  if (store instanceof Response) return store;

  let stored: StoredSession | null;
  let context: SynthesisContext;
  let cached: string | null;
  try {
    [stored, context, cached] = await Promise.all([
      store.getSession(conversationId),
      store.getSynthesisContext(conversationId),
      store.getReportUrl(conversationId),
    ]);
  } catch (error) {
    logFailure("report: store read", error);
    return apiError("store_unavailable", 503);
  }
  const denied = tokenError(token, stored?.sessionToken ?? null);
  if (denied || !stored) return denied ?? apiError("not_found", 404);
  // After a crisis no reading is given, and that includes this one.
  if (context.crisis) return apiError("forbidden", 403);
  if (cached) return json<ReportResponse>({ url: cached });

  const text = storyText(context);
  if (text.length < MIN_TEXT_CHARS) return apiError("report_failed", 422);

  let url: string;
  try {
    const { extracted } = await postToForge("/api/enneagram-extract", { text }, EXTRACT_TIMEOUT_MS);
    const { result } = await postToForge("/api/unified-score", { method: "phases", phases: [extracted] }, SCORE_TIMEOUT_MS);
    if (!isRecord(result)) throw new Error("unified-score sent no result");
    url = reportUrl(result);
  } catch (error) {
    logFailure("report: Forge site", error);
    return apiError("report_failed", 502);
  }

  try {
    await store.setReportUrl(conversationId, url);
  } catch (error) {
    logFailure("report: store write", error);
  }
  return json<ReportResponse>({ url });
}
