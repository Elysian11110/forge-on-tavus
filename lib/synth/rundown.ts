// The checked rundown the browser appends to the call context once: the type lines with every
// code spelled out letter by letter ("Jungian: I, N, T, J"), because text-to-speech reads LIE or
// SEE as words, then each goal's edge, watch-for and moves. At most 1,500 bytes: second moves go
// first, then later goals.

import type { Confidence, Instinct } from "@/lib/types";
import { corpus, fnGloss } from "@/lib/synth/corpus";
import type { EnneagramEntry, TrcRow } from "@/lib/synth/corpus";
import { asSentence, confidenceWord } from "@/lib/synth/templates";

export const RUNDOWN_MAX_BYTES = 1500;

const HEADER =
  "Checked rundown from Forge's server. The reveal is already spoken. Walk this in your own words in three short turns, add no type facts, and say type names only as they are spelled here.";

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** Under F05 there is no reading to walk; Veronica only points to the goals, if any, and closes. */
export function f05Rundown(goalsOnScreen: boolean): string {
  return (
    "Checked rundown from Forge's server: no reading this time, since there weren't enough of their stories to go on. Name no type. " +
    (goalsOnScreen ? "Say their goals are on their screen, then close warmly." : "Close warmly.")
  );
}

/** One goal as the rundown walks it; empty strings are left out. */
export interface RundownGoal {
  label: string | null;
  edge: string;
  watch: string;
  moves: string[];
}

export interface RundownInput {
  /** The called TRC row; null under F01. */
  row: TrcRow | null;
  trcConfidence: Confidence;
  /** Null when Socionics is not called. */
  socionics: { code: string; quadra: string; confidence: Confidence } | null;
  /** Null under F04. */
  enneagram: { type: number; labels: EnneagramEntry; instinct: Instinct; confidence: Confidence } | null;
  /** F01 only: what the stories did show. */
  whatISaw: string | null;
  goals: RundownGoal[];
}

/** "INTJ" becomes "I, N, T, J". */
export function spellCode(code: string): string {
  return code.split("").join(", ");
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function enneagramLine(enneagram: RundownInput["enneagram"], callsign: string | null): string {
  if (!enneagram) return "Enneagram: not called yet, no thought pattern came back enough.";
  const { labels, instinct } = enneagram;
  // The Enneagram fixation called Planning is not the TRC Planning lens.
  const mark = (label: string) => (label === callsign ? `${label} (the Enneagram one, not the TRC lens)` : label);
  const instinctPart = instinct === "undetermined" ? "" : ` Instinct: ${corpus.enneagram_instincts[instinct]}.`;
  return (
    `Enneagram: type ${NUMBER_WORDS[enneagram.type]}, a ${labels.triad} type (${confidenceWord(enneagram.confidence)}). ` +
    `The thought loop is ${mark(labels.fixation)}, the drive behind it is ${mark(labels.passion)}, and the trap is ${mark(labels.trap)}.` +
    instinctPart
  );
}

function typeLines(input: RundownInput): string {
  const { row } = input;
  if (!row) {
    const seen = input.whatISaw ? ` What I did see: ${asSentence(input.whatISaw)}` : "";
    return (
      "Type lines: no type called yet. Their stories didn't point one way often enough, and the reveal already asked the question that would settle it. " +
      `When they answer, thank them, say that's exactly where you'd start next time, and name no type.${seen} ${enneagramLine(input.enneagram, null)}`
    );
  }
  const trcWord = confidenceWord(input.trcConfidence);
  const socionics = input.socionics
    ? `Socionics: ${spellCode(input.socionics.code)}, in the ${input.socionics.quadra} group (${confidenceWord(input.socionics.confidence)}).`
    : "Socionics: not called yet.";
  return [
    `Type lines. TRC: the ${row.callsign} lens, which is ${fnGloss(row.lens).doing}; its tool is ${fnGloss(row.tool).doing} (${trcWord}).`,
    `Jungian: ${spellCode(row.jungian)} (${trcWord}).`,
    socionics,
    enneagramLine(input.enneagram, row.callsign),
  ].join(" ");
}

function goalLine(goal: RundownGoal, index: number): string {
  const label = goal.label?.trim().replace(/[.!?,;:]+$/, "");
  const parts = [`Goal ${index + 1}${label ? `, ${label}` : ""}.`];
  if (goal.edge) parts.push(`Edge: ${asSentence(goal.edge)}`);
  if (goal.watch) parts.push(`Watch for: ${asSentence(goal.watch)}`);
  if (goal.moves.length > 0) {
    parts.push(`${goal.moves.length > 1 ? "Moves" : "Move"}: ${goal.moves.map(asSentence).join(" ")}`);
  }
  return parts.join(" ");
}

/** Cuts at the last full sentence that fits; only reached if the type lines alone run long. */
function cutToBytes(text: string, max: number): string {
  let kept = "";
  let size = 0;
  for (const char of text) {
    const charSize = byteLength(char);
    if (size + charSize > max) break;
    kept += char;
    size += charSize;
  }
  const end = kept.lastIndexOf(". ");
  return end > 0 ? kept.slice(0, end + 1) : kept;
}

export function composeRundown(input: RundownInput): string {
  const head = [HEADER, typeLines(input)];
  const build = (goals: RundownGoal[]) => [...head, ...goals.map(goalLine)].join("\n");
  let goals = input.goals;
  let text = build(goals);
  if (byteLength(text) > RUNDOWN_MAX_BYTES) {
    goals = goals.map((goal) => ({ ...goal, moves: goal.moves.slice(0, 1) }));
    text = build(goals);
  }
  while (byteLength(text) > RUNDOWN_MAX_BYTES && goals.length > 1) {
    goals = goals.slice(0, -1);
    text = build(goals);
  }
  return byteLength(text) > RUNDOWN_MAX_BYTES ? cutToBytes(text, RUNDOWN_MAX_BYTES) : text;
}
