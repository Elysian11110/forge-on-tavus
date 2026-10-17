"use client";

import { useEffect, useRef } from "react";
import { fixtureEvents } from "@/lib/client/fixture";

/** Fixture events replay this far apart, so the chips pop one at a time. */
const REPLAY_STEP_MS = 450;

interface TestModeStageProps {
  presenter: boolean;
  /** The real event handler, so the replay takes exactly the live path. */
  onEvent: (event: unknown) => void;
  log: (line: string) => void;
}

/** Test mode: Tavus created the call as already ended, so there is no face to join. */
export function TestModeStage({ presenter, onEvent, log }: TestModeStageProps) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const replay = () => {
    log("replaying fixture events");
    fixtureEvents().forEach((event, index) => {
      timers.current.push(setTimeout(() => onEvent(event), index * REPLAY_STEP_MS));
    });
  };

  return (
    <div className="flex aspect-[9/12] flex-col justify-end gap-5 p-6 sm:aspect-video sm:p-10">
      <p className="stamp">Test mode</p>
      <p className="max-w-md text-lg text-ink-body">
        Tavus created this call as already ended, so there&apos;s no face to join and no minutes are spent.
      </p>
      {presenter && (
        <button type="button" onClick={replay} className="line-btn self-start">
          Replay fixture events
        </button>
      )}
    </div>
  );
}
