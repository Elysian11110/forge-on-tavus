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

/**
 * Behind ?presenter=1: raw events, timings and the Debug record, as plain text, pinned under the
 * screen so the face and the log share one view. No polish on purpose.
 */
export function PresenterLog({ timing, clock, testMode, lines, debug }: PresenterLogProps) {
  const box = useRef<HTMLPreElement>(null);
  // Keeps the newest line in view as it lands.
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines]);

  const header = [
    "presenter log",
    timing
      ? `arc ${timing.arc} min · cap ${timing.maxCallSec}s · time check T0+${timing.timeCheckSec}s · watchdog T0+${timing.watchdogSec}s`
      : "no call yet",
    clock > 1 ? `clock x${clock}` : null,
    testMode ? "test mode" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const text = [header, "", ...lines, "", `Debug record: ${debug ? JSON.stringify(debug, null, 2) : "none yet"}`].join("\n");

  return (
    <section aria-label="Presenter log" className="fixed inset-x-0 bottom-0 z-30 border-t border-forge-border bg-forge-code">
      <pre
        ref={box}
        className="mx-auto max-h-[32vh] w-full max-w-6xl overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs leading-relaxed text-forge-muted sm:px-6"
      >
        {text}
      </pre>
    </section>
  );
}
