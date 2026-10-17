"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { timeCheckText } from "@/lib/client/words";
import type { SessionTiming } from "@/lib/types";

/** T0 falls back to join plus this, if Forge has not spoken by then. */
const T0_FALLBACK_MS = 15_000;
/** The tool call times out at 20 s, so a watchdog that lands mid-filler waits this much longer, once. */
const WATCHDOG_GRACE_MS = 25_000;

export interface CallClockInput {
  /** Seconds from T0 for the time check and the watchdog, from the session response. */
  timing: SessionTiming;
  /** Test-mode speed-up (?clock=10 runs ten times faster); 1 on every real call. */
  clock: number;
  /** When the browser joined the room (test mode: when the screen opened). */
  joinedAt: number | null;
  /** Appends a context message to the live call; false when nothing was sent. */
  sendContext: (text: string) => boolean;
  /** True while a time check still makes sense: no crisis, no reading, not already synthesizing. */
  shouldNudge: () => boolean;
  hasReading: () => boolean;
  /** Forge has said its filler, so a reading is on its way. */
  isSynthesizing: () => boolean;
  onWatchdog: () => void;
  log: (line: string) => void;
}

type Latest = { current: CallClockInput };

/** Milliseconds from now until T0 plus the given seconds, on this clock. */
function msUntil(t0: number, seconds: number, clock: number): number {
  return Math.max(0, t0 + (seconds * 1000) / clock - Date.now());
}

function sendTimeCheck(latest: Latest, t0: number): void {
  const { shouldNudge, sendContext, clock, log } = latest.current;
  if (!shouldNudge()) {
    log("time check skipped (crisis, reading or synthesis already under way)");
    return;
  }
  const minutes = Math.round(((Date.now() - t0) * clock) / 60_000);
  const text = timeCheckText(minutes);
  log(sendContext(text) ? `time check sent: ${text}` : `time check not sent (no live room): ${text}`);
}

/** Arms the watchdog; returns the cancel. Mid-filler it waits once more, since the reading may land seconds later. */
function armWatchdog(latest: Latest, t0: number): () => void {
  const { clock, timing } = latest.current;
  let timer: ReturnType<typeof setTimeout>;
  const bark = (grace: boolean) => {
    const { hasReading, isSynthesizing, onWatchdog, log } = latest.current;
    if (hasReading()) return;
    if (grace && isSynthesizing()) {
      log("watchdog: Forge is mid-reading, waiting 25 s more");
      timer = setTimeout(() => bark(false), WATCHDOG_GRACE_MS / clock);
      return;
    }
    log("watchdog: no reading this time, goals kept");
    onWatchdog();
  };
  timer = setTimeout(() => bark(true), msUntil(t0, timing.watchdogSec, clock));
  return () => clearTimeout(timer);
}

/**
 * The call's clock. T0 is Forge's first started_speaking, else join plus 15 s. From T0 it sends
 * the time check once (2:45 on the 5-minute arc, 4:15 on 7) and fires the watchdog (4:00 or 6:30).
 */
export function useCallClock(input: CallClockInput): { markPalSpeaking: () => void } {
  const latest = useRef(input);
  useEffect(() => {
    latest.current = input;
  });

  const [t0, setT0] = useState<number | null>(null);
  const t0Ref = useRef<number | null>(null);
  const startClock = useCallback((at: number, why: string) => {
    if (t0Ref.current !== null) return;
    t0Ref.current = at;
    setT0(at);
    latest.current.log(`T0 set (${why})`);
  }, []);

  const markPalSpeaking = useCallback(() => startClock(Date.now(), "first pal started_speaking"), [startClock]);

  const { joinedAt, clock, timing } = input;

  // If Forge has not spoken 15 s after the join, the clock starts anyway.
  useEffect(() => {
    if (joinedAt === null || t0 !== null) return;
    const due = joinedAt + T0_FALLBACK_MS / clock;
    const fallback = setTimeout(() => startClock(due, "join plus 15 s, Forge had not spoken"), Math.max(0, due - Date.now()));
    return () => clearTimeout(fallback);
  }, [joinedAt, t0, clock, startClock]);

  // One nudge to wrap up, at the arc's time-check mark.
  useEffect(() => {
    if (t0 === null) return;
    const timeCheck = setTimeout(() => sendTimeCheck(latest, t0), msUntil(t0, timing.timeCheckSec, clock));
    return () => clearTimeout(timeCheck);
  }, [t0, clock, timing]);

  // "No reading this time" if nothing has landed by the arc's watchdog mark.
  useEffect(() => {
    if (t0 === null) return;
    return armWatchdog(latest, t0);
  }, [t0, clock, timing]);

  return { markPalSpeaking };
}
