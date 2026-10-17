"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusLine } from "@/app/components/brand";
import { fetchReport, type SessionRef } from "@/lib/client/api";

/** The last relayed turns can still be in flight when the call ends, so the build waits this long first. */
const START_DELAY_MS = 3000;

type Build = { kind: "building" } | { kind: "ready"; url: string } | { kind: "failed"; message: string };

/** The full seven-system Forge report, built after the call by the Forge site's own engine. */
export function FullReport({ session }: { session: SessionRef }) {
  const [build, setBuild] = useState<Build>({ kind: "building" });

  const start = useCallback(async () => {
    setBuild({ kind: "building" });
    const reply = await fetchReport(session);
    if (reply.ok) {
      setBuild({ kind: "ready", url: reply.data.url });
      return;
    }
    setBuild({
      kind: "failed",
      message: reply.status === 422 ? "There wasn't enough of your stories for the full report this time." : "Couldn't build your full report just now.",
    });
  }, [session]);

  useEffect(() => {
    const timer = setTimeout(() => void start(), START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [start]);

  return (
    <section aria-live="polite" className="frame p-6 sm:p-8">
      <p className="stamp">Your full Forge report</p>
      <p className="mt-4 text-lg text-ink-body">Seven systems, read from everything you told Veronica.</p>
      <div className="mt-6">
        {build.kind === "building" && <StatusLine text="Building it now. This takes about a minute and a half." />}
        {build.kind === "ready" && (
          <a href={build.url} target="_blank" rel="noreferrer" className="cut-btn">
            Open your full report
            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75" />
            </svg>
          </a>
        )}
        {build.kind === "failed" && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className="text-ink">{build.message}</p>
            <button type="button" onClick={() => void start()} className="line-btn">
              Try again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
