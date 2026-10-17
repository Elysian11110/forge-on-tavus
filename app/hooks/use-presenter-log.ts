"use client";

import { useCallback, useRef, useState } from "react";

const MAX_LOG_LINES = 400;

export interface PresenterLogLines {
  lines: string[];
  /** Adds a line stamped in seconds since the call was created; does nothing when the log is off. */
  log: (line: string) => void;
  /** Restarts the stamp clock, at the moment the call is created. */
  startClock: () => void;
}

/** The plain lines behind ?presenter=1. */
export function usePresenterLog(on: boolean): PresenterLogLines {
  const [lines, setLines] = useState<string[]>([]);
  const startedAt = useRef<number | null>(null);

  const log = useCallback(
    (line: string) => {
      if (!on) return;
      const since = (Date.now() - (startedAt.current ?? Date.now())) / 1000;
      const stamp = `+${since.toFixed(1)}s`.padStart(8);
      setLines((prev) => [...prev.slice(-(MAX_LOG_LINES - 1)), `${stamp}  ${line}`]);
    },
    [on],
  );

  const startClock = useCallback(() => {
    startedAt.current = Date.now();
  }, []);

  return { lines, log, startClock };
}
