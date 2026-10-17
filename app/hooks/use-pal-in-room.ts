"use client";

import { useEffect, useState } from "react";
import { useMeetingState } from "@daily-co/daily-react";
import { useReplicaIDs } from "@/app/components/cvi/hooks/use-replica-ids";
import type { CallEnding } from "@/lib/client/forge-state";

/** No room this long after the screen opened: nothing to pay for, so the call is ended. */
const JOIN_TIMEOUT_MS = 30_000;
/** Veronica not in the room this long after we joined: ended too, since the minutes are billing. */
const PAL_NO_SHOW_MS = 45_000;
/** Veronica gone from the room this long, after being there, means the call is over. */
const PAL_GONE_MS = 4000;

type OnEnd = (by: CallEnding) => void;

export interface RoomWatch {
  /** When the browser joined the room. */
  joinedAt: number | null;
  /** Veronica is in the room. */
  palHere: boolean;
}

/** Ends the call when nobody shows; returns the cancel. */
function endIfNobodyShows(openedAt: number, joinedAt: number | null, onEnd: OnEnd): () => void {
  const due = joinedAt === null ? openedAt + JOIN_TIMEOUT_MS : joinedAt + PAL_NO_SHOW_MS;
  const noShow = setTimeout(() => onEnd("never_connected"), Math.max(0, due - Date.now()));
  return () => clearTimeout(noShow);
}

/**
 * Watches the Daily room and ends the call when it is over or never started: the room closing,
 * Veronica leaving (end_call, or the server's time cap), or nobody showing up.
 */
export function usePalInRoom(onEnd: OnEnd): RoomWatch {
  const meetingState = useMeetingState();
  const [openedAt] = useState(() => Date.now());
  const [joinedAt, setJoinedAt] = useState<number | null>(null);
  const [palSeen, setPalSeen] = useState(false);
  const palHere = useReplicaIDs()[0] !== undefined;

  // The join, noted once: the clock and the no-show timer count from it.
  useEffect(() => {
    if (meetingState !== "joined-meeting") return;
    setJoinedAt((at) => at ?? Date.now());
  }, [meetingState]);

  // The room closing: Tavus ending the call ejects us, and leaving from the call controls lands here too.
  useEffect(() => {
    if (meetingState !== "left-meeting" && meetingState !== "error") return;
    onEnd(palSeen ? "pal" : "never_connected");
  }, [meetingState, palSeen, onEnd]);

  // Veronica leaving after being here is the call ending.
  useEffect(() => {
    if (palHere) {
      setPalSeen(true);
      return;
    }
    if (!palSeen) return;
    const gone = setTimeout(() => onEnd("pal"), PAL_GONE_MS);
    return () => clearTimeout(gone);
  }, [palHere, palSeen, onEnd]);

  // Nobody to pay for: no room in 30 s, or no Veronica within 45 s of joining, ends the call long before the cap would.
  useEffect(() => {
    if (palSeen) return;
    return endIfNobodyShows(openedAt, joinedAt, onEnd);
  }, [palSeen, openedAt, joinedAt, onEnd]);

  return { joinedAt, palHere };
}
