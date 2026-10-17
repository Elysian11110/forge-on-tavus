// POST /api/report: after the call, the full seven-system Forge report, hosted by the Forge site
// and pinned to the reading the person already saw. Their turns go to the site's free-text
// extractor; the life phase it returns goes to the site's unified scorer along with the reading
// from the call, the goals and their own words; then lib/report/compose rewrites the scorer's
// Jungian, Socionics and Enneagram to the screen's and keeps the rest of its narrative only where
// it contradicts nothing. The result is the site's own shared-report link (the report lives in
// the link, nothing is kept on the Forge site).

import { apiError, isConversationId, isRecord, json, logFailure, openStore, readJsonBody, tokenError } from "@/lib/server/http";
import type { StoredSession, SynthesisContext } from "@/lib/store";
import { MIN_TEXT_CHARS, callOnlyReport, enginePhase, pinReport, storyText } from "@/lib/report/compose";
import { FORGE_SITE, decodeReport, encodedFromUrl, previewOf, readSiteReport, reportUrl, type SiteReport } from "@/lib/report/site";
import { SESSION_HEADER, type Profile, type ReportResponse } from "@/lib/types";

// The unified scorer takes about a minute and a half, over three minutes on a long call.
export const maxDuration = 300;

// The extractor answers in 10 to 25 seconds. The scorer gets whatever is left of a budget that ends
// before the function is cut, so a slow scorer becomes the call-only report instead of a dead request.
const EXTRACT_TIMEOUT_MS = 40_000;
const BUDGET_MS = 285_000;
const MIN_SCORE_MS = 60_000;

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

/** The extractor's life phase, or nothing: on a long call it can answer "Failed to parse extraction", and the scorer reads the raw words fine without it. */
async function extractPhase(context: SynthesisContext): Promise<unknown> {
  try {
    const { extracted } = await postToForge("/api/enneagram-extract", { text: storyText(context) }, EXTRACT_TIMEOUT_MS);
    return extracted;
  } catch (error) {
    logFailure("report: extractor, scoring the words without it", error);
    return null;
  }
}

/** The site's engine run on their words and pinned to the screen's reading; complete is false when the engine failed and the report comes from the call alone. */
async function buildReport(context: SynthesisContext & { profile: Profile }): Promise<{ report: SiteReport; complete: boolean }> {
  const started = Date.now();
  try {
    const phase = enginePhase(await extractPhase(context), context);
    const scoreMs = Math.max(MIN_SCORE_MS, BUDGET_MS - (Date.now() - started));
    const { result } = await postToForge("/api/unified-score", { method: "phases", phases: [phase] }, scoreMs);
    const engine = readSiteReport(result);
    if (!engine) throw new Error("unified-score sent no result");
    return { report: pinReport(engine, context.profile, context.goals), complete: true };
  } catch (error) {
    logFailure("report: Forge engine, sending the call-only report", error);
    return { report: callOnlyReport(context.profile, context.goals), complete: false };
  }
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
  if (context.crisis || context.profile?.status === "withheld_for_safety") return apiError("forbidden", 403);
  const cachedReport = cached ? decodeReport(encodedFromUrl(cached) ?? "") : null;
  if (cached && cachedReport) return json<ReportResponse>({ url: cached, preview: previewOf(cachedReport) });

  // The full report is the reading from the call, read wider: with no reading, or when Veronica
  // said there wasn't enough to go on, there is nothing for it to agree with.
  const { profile } = context;
  if (!profile || profile.status === "insufficient") return apiError("report_failed", 422);
  if (storyText(context).length < MIN_TEXT_CHARS) return apiError("report_failed", 422);

  const { report, complete } = await buildReport({ ...context, profile });
  const url = reportUrl(report);
  // Only the engine's report is kept, so asking again after a call-only report tries the engine again.
  if (complete) {
    try {
      await store.setReportUrl(conversationId, url);
    } catch (error) {
      logFailure("report: store write", error);
    }
  }
  return json<ReportResponse>({ url, preview: previewOf(report) });
}
