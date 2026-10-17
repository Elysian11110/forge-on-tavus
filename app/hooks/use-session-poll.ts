"use client";

import { useEffect, useState } from "react";
import { fetchSessionView, type SessionRef } from "@/lib/client/api";
import type { SessionView } from "@/lib/types";

const POLL_MS = 3000;

export interface SessionPollInput {
  enabled: boolean;
  /** Once the call has ended, the poll stops at this time, or as soon as a reading is in. */
  until: number | null;
  log: (line: string) => void;
}

/**
 * Polls GET /api/session every 3 s while enabled. A view that did not change does not re-render;
 * a 403 or 404 means the server no longer knows the session, so the poll stops for good.
 */
export function useSessionPoll(session: SessionRef | null, input: SessionPollInput): SessionView | null {
  const { enabled, until, log } = input;
  const [view, setView] = useState<SessionView | null>(null);
  const [gone, setGone] = useState(false);

  // One chain of timeouts per enabled stretch; the cleanup breaks the chain.
  useEffect(() => {
    if (!session || !enabled || gone) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = "";

    const tick = async () => {
      const reply = await fetchSessionView(session);
      if (stopped) return;
      if (!reply.ok && (reply.status === 403 || reply.status === 404)) {
        setGone(true);
        log("poll stopped: the server no longer knows this session");
        return;
      }
      const next = reply.ok ? JSON.stringify(reply.data) : last;
      if (reply.ok && next !== last) {
        last = next;
        setView(reply.data);
        if (reply.data.profile) log(`reading in: ${reply.data.profile.status}, triggers [${reply.data.profile.triggers.join(", ")}]`);
      }
      // After the call, the first reading or the end of the window is the last word.
      if (until !== null && ((reply.ok && reply.data.profile) || Date.now() >= until)) return;
      // Network blips and 5xx keep polling: the next tick may land.
      timer = setTimeout(tick, POLL_MS);
    };

    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [session, enabled, until, gone, log]);

  return view;
}
