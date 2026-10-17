"use client";

import { useCallback, useRef } from "react";
import { postEvent, withRetries, type SessionRef } from "@/lib/client/api";
import type { EventsRequest } from "@/lib/types";

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
        await withRetries(() => postEvent(session, event));
      });
    },
    [session],
  );

  const relayCrisis = useCallback(
    async (reason: string | null) => {
      const event: EventsRequest = { conversationId: session.conversationId, kind: "crisis", data: { reason } };
      // The server refuses a reading only once the flag has landed, so this one is not queued behind the turns.
      await withRetries(() => postEvent(session, event));
    },
    [session],
  );

  return { relay, relayCrisis };
}
