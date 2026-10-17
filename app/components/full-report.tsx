"use client";

import { useEffect, useState } from "react";
import type { ReportBuild } from "@/app/hooks/use-full-report";
import { FORGE_SITE } from "@/lib/report/site";

/** The lines that take turns while the report builds, a few seconds each. */
const BUILDING_LINES = ["Building your report", "Almost there", "Hang in tight"] as const;
const LINE_MS = 3500;

function Arrow() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

/** Three ember circles breathing in and out, one after the other, with the line under them taking turns. */
function Building() {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setLine((current) => (current + 1) % BUILDING_LINES.length), LINE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div aria-hidden className="flex items-center gap-3">
        {[0, 1, 2].map((index) => (
          <span key={index} className="size-4 animate-pulse-ring rounded-full bg-ember" style={{ animationDelay: `${index * 180}ms` }} />
        ))}
      </div>
      <p role="status" aria-live="polite" className="mt-8 text-xl text-ink">
        {BUILDING_LINES[line]}
      </p>
      <p className="mt-2 text-quiet">Your full Forge report, from everything you told Veronica.</p>
    </div>
  );
}

/** The report inside the page: the headline, the summary, the three type codes and a few lines, opening the full one on Forge. */
function Ready({ build }: { build: Extract<ReportBuild, { kind: "ready" }> }) {
  const { url, preview } = build;
  return (
    <div className="animate-rise">
      <p className="stamp">Your Forge report</p>
      <a href={url} target="_blank" rel="noreferrer" className="group mt-5 block">
        <h2 className="text-3xl font-medium leading-[1.1] tracking-[-0.03em] text-ink group-hover:text-ember-hot sm:text-4xl">
          {preview.headline}
        </h2>
      </a>
      {preview.types.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {preview.types.map((type) => (
            <li key={type.label} className="type-label border border-rule px-3 py-2 normal-case tracking-[0.06em] text-ink">
              <span className="text-quiet">{type.label} </span>
              {type.code}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 max-w-prose text-lg text-ink-body">{preview.summary}</p>
      {preview.bullets.length > 0 && (
        <ul className="mt-6 max-w-prose space-y-3 text-ink-body">
          {preview.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-3">
              <span aria-hidden className="mt-2.5 size-1.5 shrink-0 bg-ember" />
              {bullet}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
        <a href={url} target="_blank" rel="noreferrer" className="cut-btn">
          Read your full report on Forge
          <Arrow />
        </a>
        <a href={FORGE_SITE} target="_blank" rel="noreferrer" className="type-label text-quiet underline decoration-rule underline-offset-6 hover:text-ink">
          Explore Forge
        </a>
      </div>
    </div>
  );
}

/** The full Forge report on the result page: building, then the report inside the page, or a gentle note. */
export function FullReport({ build, onRetry }: { build: ReportBuild; onRetry: () => void }) {
  if (build.kind === "hidden") return null;
  return (
    <section aria-label="Your full Forge report" className="frame p-6 sm:p-8">
      {(build.kind === "idle" || build.kind === "building") && <Building />}
      {build.kind === "ready" && <Ready build={build} />}
      {build.kind === "not_enough" && (
        <p className="text-lg text-ink-body">
          Veronica needs a few more of your stories to build your full report. Come back and talk to her again any time.
        </p>
      )}
      {build.kind === "failed" && (
        <div className="flex flex-col items-start gap-5">
          <p className="text-xl text-ink">Oh no! Your report got a little stuck. Can you try again?</p>
          <button type="button" onClick={onRetry} className="line-btn">
            Try again
          </button>
        </div>
      )}
    </section>
  );
}
