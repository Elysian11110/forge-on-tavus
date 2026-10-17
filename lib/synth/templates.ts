// Everything Veronica says from code: the spoken lines, word for word, and the gloss templates that
// stand in for a model line that fails the lint or loses its anchor.

import type { Confidence, Fn, MoveKind, PatternId } from "@/lib/types";
import { fnGloss, patternDoing } from "@/lib/synth/corpus";
import type { EnneagramEntry, TrcRow } from "@/lib/synth/corpus";

/** The reveal Tavus speaks word for word may not run longer than this. */
export const REVEAL_MAX_WORDS = 60;

/** Spoken under the crisis flag instead of any reading. */
export const SPOKEN_CRISIS = "Let's leave the type stuff for today. You matter more than any of this.";

/** F05: fewer than three answers with matched evidence, so no type at all. */
export function spokenF05(goalsOnScreen: boolean): string {
  return (
    "Okay, honest answer: I don't have enough of your stories yet, and I'm not going to guess. Give me two more sometime and I'll call it." +
    (goalsOnScreen ? " Your goals are on your screen either way." : "")
  );
}

/** Spoken on any error in the route, so Tavus never voices a guess. */
export function spokenError(goalsOnScreen: boolean): string {
  return (
    "I couldn't put that together cleanly, so I'd rather not guess." +
    (goalsOnScreen ? " Your goals are on your screen." : "")
  );
}

/** Ends a line with a full stop unless it already ends a sentence. */
export function asSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** The type is called: how_you_work is the checked model line or its gloss template. */
export function calledReveal(howYouWork: string, callsign: string): string {
  return `Okay, here's what I'm seeing. ${asSentence(howYouWork)} That's the ${callsign} lens. What fits, and what doesn't?`;
}

/** F01: no type yet; ends on the hunch-bank question for the likeliest lens. */
export function f01Reveal(question: string): string {
  return `Okay, honest version: your stories didn't point one way often enough, so I won't guess a type yet. Here's the one question that would settle it: ${question}`;
}

// The hunch bank from the prompt, in general form: code cannot build the question on the person's
// own example, so the Si or Ni question loses "that call" and the rest are as written.
export const SETTLE_QUESTIONS = {
  perceiving_inner: "When you make a call, are you going off what you've seen work before, or where you can see it heading?",
  perceiving_outer: "Are you all in on what's happening right now, or already playing out five ways it could go?",
  thinking: "Does it have to make sense to you first, or is it enough that it works?",
  feeling: "Is it more where you stand with one person, or the mood of the whole room?",
} as const;

const QUESTION_FOR_LENS: Record<Fn, string> = {
  Si: SETTLE_QUESTIONS.perceiving_inner,
  Ni: SETTLE_QUESTIONS.perceiving_inner,
  Se: SETTLE_QUESTIONS.perceiving_outer,
  Ne: SETTLE_QUESTIONS.perceiving_outer,
  Ti: SETTLE_QUESTIONS.thinking,
  Te: SETTLE_QUESTIONS.thinking,
  Fi: SETTLE_QUESTIONS.feeling,
  Fe: SETTLE_QUESTIONS.feeling,
};

/** The settling question for the likeliest lens; with no lens at all, the bank's first question. */
export function settleQuestionFor(lens: Fn | null): string {
  return lens ? QUESTION_FOR_LENS[lens] : SETTLE_QUESTIONS.perceiving_inner;
}

export const MOVE_LABELS: Record<MoveKind, string> = {
  lean_on: "Lean on",
  guard: "Guard",
  refuel: "Refuel",
  bring_in: "Bring in",
};

/** Confidence in friend words, the same on the result screen and in the rundown. */
export function confidenceWord(confidence: Confidence): string {
  return { high: "clear", medium: "leaning", low: "faint", insufficient: "not called yet" }[confidence];
}

/** What a strength line stands on: the called row's lens or tool, or a matched pattern from P01 to P10. */
export type StrengthSource = { kind: "lens" | "tool"; fn: Fn } | { kind: "pattern"; pattern: PatternId };

export type WatchSource = "drain" | "enneagram_trap" | "P14";

function strengthDoing(source: StrengthSource): string {
  if (source.kind === "pattern") return patternDoing(source.pattern) ?? "";
  return fnGloss(source.fn).doing;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** how_you_work from the called TRC row. */
export function howYouWorkFromRow(row: TrcRow): string {
  return `You lead with ${fnGloss(row.lens).doing}, and you make it real by ${fnGloss(row.tool).doing}.`;
}

/** how_you_work under F01: the strongest matched pattern, or an honest blank. */
export function howYouWorkFromPattern(pattern: PatternId | null): string {
  const doing = pattern ? patternDoing(pattern) : null;
  return doing
    ? `Your stories kept coming back to ${doing}.`
    : "Your stories didn't point one way yet, so this stays open for now.";
}

/** The edge line for a goal; it sits under a "Your edge" heading, so it never repeats it. */
export function edgeTemplate(source: StrengthSource): string {
  const doing = capitalise(strengthDoing(source));
  if (source.kind === "tool") return `${doing}, the way you make things real, is your edge here.`;
  return `${doing} is your edge here.`;
}

/** The watch-for line for a goal; it sits under a "Watch for" heading, so it never repeats it. */
export function watchTemplate(source: WatchSource, row: TrcRow | null, enneagram: EnneagramEntry | null): string {
  if (source === "drain" && row) {
    return `${capitalise(fnGloss(row.drain).doing)} costs you the most energy, so plan around it here.`;
  }
  if (source === "enneagram_trap" && enneagram) {
    return `The ${enneagram.trap} loop can feel like the fix here and still keep you stuck.`;
  }
  return "What wipes you out costs you the most here, so plan around it.";
}

/** The lean_on move kept when every model move on a goal failed. */
export function leanOnTemplate(source: StrengthSource | null): string {
  return source
    ? `This week, take one small step on this goal by ${strengthDoing(source)}.`
    : "This week, pick one small step on this goal and get it done.";
}
