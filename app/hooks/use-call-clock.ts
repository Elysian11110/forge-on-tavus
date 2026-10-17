"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { timeCheckText, WRAP_UP_TEXT } from "@/lib/client/words";
import type { SessionTiming } from "@/lib/types";

/** T0 falls back to join plus this, if Veronica has not spoken by then. */
const T0_FALLBACK_MS = 15_000;
/** The tool call times out at 20 s, so a watchdog that lands mid-filler waits this much longer, once. */
const WATCHDOG_GRACE_MS = 25_000;

export interface CallClockInput {
  /** Seconds from T0 for the time check and the watchdog, from the session response. */
  timing: SessionTiming;
  /** When the browser joined the room. */
  joinedAt: number | null;
  /** Appends a context message to the live call; false when nothing was sent. */
  sendContext: (text: string) => boolean;
  /** True while a time check still makes sense: no crisis, no reading, not already synthesizing. */
  shouldNudge: () => boolean;
  /** True unless a crisis is under way: then the call ends only when they want it to. */
  shouldWrapUp: () => boolean;
  hasReading: () => boolean;
  /** Veronica has said her filler, so a reading is on its way. */
  isSynthesizing: () => boolean;
  onWatchdog: () => void;
}

type Latest = { current: CallClockInput };

/** Milliseconds from now until T0 plus the given seconds. */
function msUntil(t0: number, seconds: number): number {
  return Math.max(0, t0 + seconds * 1000 - Date.now());
}

function sendTimeCheck(latest: Latest, t0: number): void {
  const { shouldNudge, sendContext } = latest.current;
  if (!shouldNudge()) return;
  sendContext(timeCheckText(Math.round((Date.now() - t0) / 60_000)));
}

/** Arms the watchdog; returns the cancel. Mid-filler it waits once more, since the reading may land seconds later. */
function armWatchdog(latest: Latest, t0: number): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const bark = (grace: boolean) => {
    const { hasReading, isSynthesizing, onWatchdog } = latest.current;
    if (hasReading()) return;
    if (grace && isSynthesizing()) {
      timer = setTimeout(() => bark(false), WATCHDOG_GRACE_MS);
      return;
    }
    onWatchdog();
  };
  timer = setTimeout(() => bark(true), msUntil(t0, latest.current.timing.watchdogSec));
  return () => clearTimeout(timer);
}

/**
 * The call's clock. T0 is Veronica's first started_speaking, else join plus 15 s. From T0 it sends
 * the time check once (3:15 on the speed round, 27:00 on an open call), fires the watchdog (4:15 or
 * 28:30) and sends the wrap-up note (4:25 or 29:20), since Tavus ends the call at the cap without a warning.
 */
export function useCallClock(input: CallClockInput): { markPalSpeaking: () => void } {
  const latest = useRef(input);
  useEffect(() => {
    latest.current = input;
  });

  const [t0, setT0] = useState<number | null>(null);
  const t0Ref = useRef<number | null>(null);
  const startClock = useCallback((at: number) => {
    if (t0Ref.current !== null) return;
    t0Ref.current = at;
    setT0(at);
  }, []);

  const markPalSpeaking = useCallback(() => startClock(Date.now()), [startClock]);

  const { joinedAt, timing } = input;

  // If Veronica has not spoken 15 s after the join, the clock starts anyway.
  useEffect(() => {
    if (joinedAt === null || t0 !== null) return;
    const due = joinedAt + T0_FALLBACK_MS;
    const fallback = setTimeout(() => startClock(due), Math.max(0, due - Date.now()));
    return () => clearTimeout(fallback);
  }, [joinedAt, t0, startClock]);

  // One nudge to wrap up, at the arc's time-check mark.
  useEffect(() => {
    if (t0 === null) return;
    const timeCheck = setTimeout(() => sendTimeCheck(latest, t0), msUntil(t0, timing.timeCheckSec));
    return () => clearTimeout(timeCheck);
  }, [t0, timing]);

  // "No reading this time" if nothing has landed by the arc's watchdog mark.
  useEffect(() => {
    if (t0 === null) return;
    return armWatchdog(latest, t0);
  }, [t0, timing]);

  // A goodbye before the cap, so the call never ends mid-sentence.
  useEffect(() => {
    if (t0 === null) return;
    const wrapUp = setTimeout(() => {
      if (latest.current.shouldWrapUp()) latest.current.sendContext(WRAP_UP_TEXT);
    }, msUntil(t0, timing.wrapUpSec));
    return () => clearTimeout(wrapUp);
  }, [t0, timing]);

  return { markPalSpeaking };
}
