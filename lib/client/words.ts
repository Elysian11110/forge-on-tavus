// Lines filled in by code: the time check and the wrap-up note the browser sends Veronica. One-off
// screen copy lives in its component; words the server also uses come from the corpus through lib/synth.

/** The context message Veronica gets at the time check, with the minutes since T0. */
export function timeCheckText(elapsedMinutes: number): string {
  return `Time check: about ${elapsedMinutes} minutes in. No new topics: let them finish, ask at most one more quick question, then use the synthesize_profile tool. Never say a tool's name out loud.`;
}

/** The context message just before Tavus's hard cap, so the call ends on a goodbye and not mid-sentence. */
export const WRAP_UP_TEXT =
  "Wrap up now: under 30 seconds left. Finish your sentence, say a quick warm bye, then use the end_call tool without saying its name. No new questions.";
