"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchReport, withRetries, type SessionRef } from "@/lib/client/api";
import type { ReportPreview } from "@/lib/report/site";

/** The last turns relayed before the reveal can still be landing, so the build waits this long first. */
const START_DELAY_MS = 3000;
/** The pause between the three quiet tries, before the screen asks the person. */
const RETRY_DELAY_MS = 4000;

export type ReportBuild =
  | { kind: "idle" }
  | { kind: "building" }
  | { kind: "ready"; url: string; preview: ReportPreview }
  | { kind: "not_enough" }
  | { kind: "hidden" }
  | { kind: "failed" };

/**
 * The full Forge report, started the moment the reading exists (usually during the call, while
 * Veronica walks the rundown), so most of its minute or three is over before the result page opens.
 */
export function useFullReport(session: SessionRef | null, ready: boolean): { build: ReportBuild; retry: () => void } {
  const [build, setBuild] = useState<ReportBuild>({ kind: "idle" });
  const started = useRef(false);

  const run = useCallback(async () => {
    if (!session) return;
    setBuild({ kind: "building" });
    const reply = await withRetries(() => fetchReport(session), RETRY_DELAY_MS);
    if (reply.ok) setBuild({ kind: "ready", url: reply.data.url, preview: reply.data.preview });
    else if (reply.status === 422) setBuild({ kind: "not_enough" });
    else if (reply.error === "withheld") setBuild({ kind: "hidden" });
    else setBuild({ kind: "failed" });
  }, [session]);

  useEffect(() => {
    if (!ready || !session || started.current) return;
    started.current = true;
    // No cleanup on purpose: ForgeApp stays mounted for the whole visit, and a cleared timer here
    // would never be set again once started is true.
    setTimeout(() => void run(), START_DELAY_MS);
  }, [ready, session, run]);

  return { build, retry: () => void run() };
}
