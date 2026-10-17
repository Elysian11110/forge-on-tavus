// What happened in this visit, as one reducer: which screen is up, the call's session, and the
// facts the call screen learns from Tavus events that the result screen still needs.

import type { CreateSessionResponse, Goal } from "@/lib/types";
import { mergeGoals } from "@/lib/client/goals";

/** The create response plus what the device check found. */
export type ActiveSession = CreateSessionResponse & { voiceOnly: boolean };

export type Screen = "consent" | "call" | "result";

/** Who ended the call; it decides what the result screen says when no reading came. */
export type CallEnding = "pal" | "person" | "never_connected";

export interface ForgeState {
  screen: Screen;
  session: ActiveSession | null;
  /** From save_goal app messages, newest per slot. */
  goals: Goal[];
  /** The guardrail fired: no more type talk, no reading. */
  crisis: boolean;
  /** Veronica said her "putting it all together" line. */
  synthesizing: boolean;
  /** The watchdog fired before any reading arrived. */
  noReading: boolean;
  ended: { at: number; by: CallEnding } | null;
}

export type ForgeAction =
  | { type: "started"; session: ActiveSession }
  | { type: "goal"; goal: Goal }
  | { type: "crisis" }
  | { type: "synthesizing" }
  | { type: "watchdog" }
  | { type: "ended"; at: number; by: CallEnding };

export const initialForgeState: ForgeState = {
  screen: "consent",
  session: null,
  goals: [],
  crisis: false,
  synthesizing: false,
  noReading: false,
  ended: null,
};

export function forgeReducer(state: ForgeState, action: ForgeAction): ForgeState {
  switch (action.type) {
    case "started":
      return { ...initialForgeState, screen: "call", session: action.session };
    case "goal":
      return { ...state, goals: mergeGoals(state.goals, [action.goal]) };
    case "crisis":
      return { ...state, crisis: true };
    case "synthesizing":
      return state.synthesizing ? state : { ...state, synthesizing: true };
    case "watchdog":
      return { ...state, noReading: true };
    case "ended":
      return state.ended ? state : { ...state, screen: "result", ended: { at: action.at, by: action.by } };
  }
}
