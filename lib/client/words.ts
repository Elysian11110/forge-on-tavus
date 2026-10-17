// Lines keyed by a code or filled in by code: the refusal lines by trigger, and the time check the
// browser sends Veronica. One-off screen copy lives in its component. Words the server also uses
// (confidence, glosses, pattern labels, instincts) come from the corpus through
// lib/synth, so screen and voice match.

import type { TriggerId } from "@/lib/types";

/** "What I can't call yet", one line per refusal trigger. */
export const TRIGGER_LINES: Record<TriggerId, string> = {
  F01: "Your type: your stories didn't point the same way often enough yet.",
  F04: "Enneagram: no thought pattern repeated enough.",
  F05: "Not enough stories yet to call anything honestly.",
};

/** The context message Veronica gets at the time check, with the minutes since T0. */
export function timeCheckText(elapsedMinutes: number): string {
  return `Time check: about ${elapsedMinutes} minutes in. No new topics: let them finish, ask at most one more quick question, then call synthesize_profile.`;
}

/** The context message just before Tavus's hard cap, so the call ends on a goodbye and not mid-sentence. */
export const WRAP_UP_TEXT =
  "Wrap up now: under 30 seconds left. Finish your sentence, say a quick warm bye, then call end_call. No new questions.";
