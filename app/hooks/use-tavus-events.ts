"use client";

import { useCallback, useEffect, useRef } from "react";
import { useObservableEvent } from "@/app/components/cvi/hooks/cvi-events-hooks";
import { parseGoalArgs } from "@/lib/client/goals";
import type { Goal } from "@/lib/types";

/** What Forge does with the Tavus events it cares about. */
export interface TavusEventListeners {
  /** save_goal fired: show the chip and relay it. */
  onGoal: (goal: Goal, toolCallId: string | null) => void;
  /** The person finished a turn: relay its text. */
  onUserTurn: (speech: string, inferenceId: string | null) => void;
  onCrisis: (reason: string | null) => void;
  /** Forge started speaking; the first one sets T0. */
  onPalSpeaking: () => void;
  /** Forge said its "putting it all together" filler. */
  onSynthesizing: () => void;
  /** Every event worth keeping, raw, for the presenter log. */
  onRaw: (event: unknown) => void;
}

/** The static_filler line of synthesize_profile in config/tools.json: hearing it means the call is on its way. */
const FILLER = /putting it all together/i;

/** Logged raw; streaming chunks and stopped_speaking are left out as noise. */
const LOGGED = new Set(["conversation.tool_call", "conversation.utterance", "conversation.started_speaking"]);

/** A string field, or null for anything else. */
function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function hear(raw: unknown, to: TavusEventListeners): void {
  if (!raw || typeof raw !== "object") return;
  const event = raw as Record<string, unknown>;
  const props = (event.properties && typeof event.properties === "object" ? event.properties : {}) as Record<string, unknown>;
  const kind = text(event.event_type);
  const role = text(props.role);
  const speech = text(props.speech) ?? "";

  // The guardrail message's event name is undocumented, so match on properties.guardrail. The PAL
  // carries one guardrail (crisis_self_harm); a missed crisis costs more than a spare card.
  if (typeof props.guardrail === "string") {
    to.onRaw(raw);
    to.onCrisis(text(props.reason));
    return;
  }

  // 'replica' is the legacy duplicate of 'pal': ignored everywhere so nothing counts twice.
  if (role === "replica") return;
  if (kind && LOGGED.has(kind)) to.onRaw(raw);

  switch (kind) {
    case "conversation.tool_call": {
      const goal = props.name === "save_goal" ? parseGoalArgs(props.arguments) : null;
      if (goal) to.onGoal(goal, text(props.tool_call_id));
      return;
    }
    case "conversation.utterance":
      if (role === "user" && speech.trim()) to.onUserTurn(speech, text(event.inference_id));
      if (role === "pal" && FILLER.test(speech)) to.onSynthesizing();
      return;
    case "conversation.utterance.streaming":
      if (role === "pal" && FILLER.test(speech)) to.onSynthesizing();
      return;
    case "conversation.started_speaking":
      if (role === "pal") to.onPalSpeaking();
      return;
  }
}

/**
 * Subscribes to Tavus app messages and turns them into Forge actions. Returns the handler too, so
 * test mode can replay fixture events through exactly the same path.
 */
export function useTavusEvents(listeners: TavusEventListeners): (event: unknown) => void {
  const latest = useRef(listeners);
  useEffect(() => {
    latest.current = listeners;
  });

  // Stable on purpose: useDailyEvent warns when its callback changes between renders.
  const handle = useCallback((raw: unknown) => hear(raw, latest.current), []);
  useObservableEvent<unknown>(handle);
  return handle;
}
