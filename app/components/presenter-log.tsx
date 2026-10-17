"use client";

import { useEffect, useRef } from "react";
import type { Debug, SessionTiming } from "@/lib/types";

interface PresenterLogProps {
  timing: SessionTiming | null;
  clock: number;
  testMode: boolean;
  lines: string[];
  debug: Debug | null;
}

/** The Debug record as four plain lines: what the model sent, what matched, what refused, what got replaced. */
function debugLines(debug: Debug | null): [string, string][] {
  if (!debug) return [["Debug record", "none yet"]];
  const triggers = debug.triggers.map((trigger) => `${trigger.id} (${trigger.count})`).join(", ");
  return [
    ["Evidence matched", `${debug.evidence_matched} of ${debug.evidence_sent}`],
    ["Never said", debug.unmatched.length > 0 ? debug.unmatched.join(" / ") : "none"],
    ["Refusals", triggers || "none"],
    ["Lines replaced", debug.replaced.length > 0 ? debug.replaced.join(", ") : "none"],
  ];
}

/**
 * Behind ?presenter=1: what the call is doing under the face. Raw events and timings on the left,
 * the Debug record on the right, pinned under the screen so the face and the log share one view.
 */
export function PresenterLog({ timing, clock, testMode, lines, debug }: PresenterLogProps) {
  const box = useRef<HTMLPreElement>(null);
  // Keeps the newest line in view as it lands.
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines]);

  const tags = [
    timing ? `arc ${timing.arc} min` : "no call yet",
    timing ? `cap ${timing.maxCallSec}s` : null,
    timing ? `time check T0+${timing.timeCheckSec}s` : null,
    timing ? `watchdog T0+${timing.watchdogSec}s` : null,
    clock > 1 ? `clock x${clock}` : null,
    testMode ? "test mode" : null,
  ].filter((tag): tag is string => tag !== null);

  return (
    <section aria-label="Behind the scenes" className="fixed inset-x-0 bottom-0 z-30 max-h-[42vh] overflow-y-auto border-t border-rule bg-raised lg:max-h-none lg:overflow-visible">
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-8 lg:px-12">
        <header className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-line py-3">
          <p className="stamp text-ink">Behind the scenes</p>
          {tags.map((tag) => (
            <span key={tag} className="font-mono text-xs text-quiet">
              {tag}
            </span>
          ))}
        </header>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <pre
            ref={box}
            className="max-h-[22vh] overflow-auto whitespace-pre-wrap break-words py-3 font-mono text-xs leading-relaxed text-quiet"
          >
            {lines.length > 0 ? lines.join("\n") : "Events land here as the call runs."}
          </pre>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1.5 border-t border-line py-3 font-mono text-xs lg:border-t-0 lg:border-l lg:pl-6">
            {debugLines(debug).map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-quiet">{label}</dt>
                <dd className="text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
