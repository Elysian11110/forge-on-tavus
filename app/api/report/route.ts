// POST /api/report: after the call, the full seven-system Forge report, hosted by the Forge site
// and pinned to the reading the person already saw. Their turns go to the site's free-text
// extractor; the life phase it returns goes to the site's unified scorer along with the reading
// from the call, the goals and their own words; then lib/report/compose rewrites the scorer's
// Jungian, Socionics and Enneagram to the screen's and keeps the rest of its narrative only where
// it contradicts nothing. The result is the site's own shared-report link (the report lives in
// the link, nothing is kept on the Forge site).

import { apiError, isConversationId, isRecord, json, logFailure, openStore, readJsonBody, tokenError } from "@/lib/server/http";
import type { StoredSession, SynthesisContext } from "@/lib/store";
import { MIN_TEXT_CHARS, enginePhase, pinReport, storyText } from "@/lib/report/compose";
import { FORGE_SITE, readSiteReport, reportUrl } from "@/lib/report/site";
import { SESSION_HEADER, type ReportResponse } from "@/lib/types";

// The unified scorer takes about a minute and a half, longer on a long call.
export const maxDuration = 300;

const EXTRACT_TIMEOUT_MS = 60_000;
const SCORE_TIMEOUT_MS = 280_000;

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

/** The report link for a call: the site's engine run on their words, then pinned to the screen's reading. */
async function buildReportUrl(context: SynthesisContext): Promise<string> {
  const text = storyText(context);
  const { extracted } = await postToForge("/api/enneagram-extract", { text }, EXTRACT_TIMEOUT_MS);
  const phase = enginePhase(extracted, context);
  const { result } = await postToForge("/api/unified-score", { method: "phases", phases: [phase] }, SCORE_TIMEOUT_MS);
  const engine = readSiteReport(result);
  if (!engine) throw new Error("unified-score sent no result");
  return reportUrl(pinReport(engine, context.profile, context.goals));
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
  if (cached) return json<ReportResponse>({ url: cached });

  // The full report is the reading from the call, read wider: with no reading, or when Veronica
  // said there wasn't enough to go on, there is nothing for it to agree with.
  if (!context.profile || context.profile.status === "insufficient") return apiError("report_failed", 422);
  if (storyText(context).length < MIN_TEXT_CHARS) return apiError("report_failed", 422);

  let url: string;
  try {
    url = await buildReportUrl(context);
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
