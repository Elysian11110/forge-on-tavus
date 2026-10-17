"use client";

import { useEffect, useState } from "react";
import { useMeetingState, useParticipantProperty } from "@daily-co/daily-react";
import { useReplicaIDs } from "@/app/components/cvi/hooks/use-replica-ids";
import type { CallEnding } from "@/lib/client/forge-state";

/** No room this long after the screen opened: nothing to pay for, so the call is ended. */
const JOIN_TIMEOUT_MS = 30_000;
/** Forge not in the room this long after we joined: ended too, since the minutes are billing. */
const FORGE_NO_SHOW_MS = 45_000;
/** Forge gone from the room this long, after being there, means the call is over. */
const FORGE_GONE_MS = 4000;

type OnEnd = (by: CallEnding, reason: string) => void;

export interface RoomWatch {
  /** When the browser joined the room; in test mode, when the screen opened. */
  joinedAt: number | null;
  /** Forge is in the room (always, in test mode). */
  forgeHere: boolean;
}

/** Ends the call when nobody shows; returns the cancel. */
function endIfNobodyShows(openedAt: number, joinedAt: number | null, onEnd: OnEnd): () => void {
  const due = joinedAt === null ? openedAt + JOIN_TIMEOUT_MS : joinedAt + FORGE_NO_SHOW_MS;
  const why = joinedAt === null ? "the room never joined" : "Forge never joined";
  const noShow = setTimeout(() => onEnd("never_connected", why), Math.max(0, due - Date.now()));
  return () => clearTimeout(noShow);
}

/**
 * Watches the Daily room and ends the call when it is over or never started: the room closing,
 * Forge leaving (end_call, or the server's time cap), or nobody showing up. Test mode has no
 * room, so the screen opening stands in for the join and the no-show timers stay off.
 */
export function useForgeInRoom(testMode: boolean, onEnd: OnEnd, log: (line: string) => void): RoomWatch {
  const meetingState = useMeetingState();
  const [openedAt] = useState(() => Date.now());
  const [joinedAt, setJoinedAt] = useState<number | null>(() => (testMode ? Date.now() : null));
  const [forgeSeen, setForgeSeen] = useState(testMode);
  const forgeId = useReplicaIDs()[0] ?? null;
  const forgeHere = testMode || forgeId !== null;
  // Reads null until Forge is in the room; the smoke call writes the real user_id to the log.
  const forgeUserId = useParticipantProperty(forgeId ?? "", "user_id");

  // The join, noted once: the clock and the no-show timer count from it.
  useEffect(() => {
    if (meetingState !== "joined-meeting") return;
    setJoinedAt((at) => at ?? Date.now());
    log("joined the room");
  }, [meetingState, log]);

  // The room closing: Tavus ending the call ejects us, and leaving from the call controls lands here too.
  useEffect(() => {
    if (meetingState !== "left-meeting" && meetingState !== "error") return;
    onEnd(forgeSeen ? "forge" : "never_connected", `room ${meetingState}`);
  }, [meetingState, forgeSeen, onEnd]);

  // The docs and the CLI disagree on Forge's user_id; the log settles it on the first real call.
  useEffect(() => {
    if (forgeUserId) log(`Forge is in the room as ${forgeUserId}`);
  }, [forgeUserId, log]);

  // Forge leaving after being here is the call ending.
  useEffect(() => {
    if (testMode) return;
    if (forgeHere) {
      setForgeSeen(true);
      return;
    }
    if (!forgeSeen) return;
    const gone = setTimeout(() => onEnd("forge", "Forge left the room"), FORGE_GONE_MS);
    return () => clearTimeout(gone);
  }, [testMode, forgeHere, forgeSeen, onEnd]);

  // Nobody to pay for: no room in 30 s, or no Forge within 45 s of joining, ends the call long before the cap would.
  useEffect(() => {
    if (testMode || forgeSeen) return;
    return endIfNobodyShows(openedAt, joinedAt, onEnd);
  }, [testMode, forgeSeen, openedAt, joinedAt, onEnd]);

  return { joinedAt, forgeHere };
}
