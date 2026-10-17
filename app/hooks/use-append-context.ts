"use client";

import { useCallback } from "react";
import { useSendAppMessage } from "@/app/components/cvi/hooks/cvi-events-hooks";

/**
 * Sends a conversation.append_llm_context message to the live call, the one way the browser talks
 * to Veronica mid-call. Returns false when nothing went out: before the join or after the leave
 * there is nobody to send to.
 */
export function useAppendContext(conversationId: string, live: boolean): (context: string) => boolean {
  const sendAppMessage = useSendAppMessage();
  return useCallback(
    (context: string) => {
      if (!live) return false;
      try {
        sendAppMessage({
          message_type: "conversation",
          event_type: "conversation.append_llm_context",
          conversation_id: conversationId,
          properties: { context },
        });
        return true;
      } catch {
        return false;
      }
    },
    [conversationId, live, sendAppMessage],
  );
}
