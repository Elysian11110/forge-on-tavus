"use client";

import { useCallback, useRef } from "react";
import { postEvent, worthRetrying, type SessionRef } from "@/lib/client/api";
import type { EventsRequest } from "@/lib/types";

/** The crisis flag gets this many tries: the server refuses a reading only once the flag has landed. */
const CRISIS_TRIES = 3;

/**
 * Relays to /api/events. Goals and turns go out one at a time, so they reach the store in the
 * order they were spoken. The crisis flag skips that queue: it has to land before Tavus's signed
 * synthesize call, whatever is still waiting in line.
 */
export function useRelay(session: SessionRef) {
  const queue = useRef<Promise<void>>(Promise.resolve());

  const relay = useCallback(
    (event: EventsRequest) => {
      queue.current = queue.current.then(async () => {
        const reply = await postEvent(session, event);
        if (worthRetrying(reply)) await postEvent(session, event);
      });
    },
    [session],
  );

  const relayCrisis = useCallback(
    async (reason: string | null) => {
      const event: EventsRequest = { conversationId: session.conversationId, kind: "crisis", data: { reason } };
      let reply = await postEvent(session, event);
      for (let tries = 1; tries < CRISIS_TRIES && worthRetrying(reply); tries++) reply = await postEvent(session, event);
    },
    [session],
  );

  return { relay, relayCrisis };
}
