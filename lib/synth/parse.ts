// The synthesize_profile arguments, parsed with zod against the schema in config/tools.json.
// Parsing never trims or guesses: an unknown confidence becomes insufficient, instinct
// undetermined, trc_code none, an out-of-range enneagram_type 0; an unknown pattern_id, anchor,
// kind or goal_id drops that item; strings are kept exactly as sent, so an over-cap line fails the
// lint instead of being cut.

import { z } from "zod";
import {
  BLIND_SPOT_ANCHORS,
  CONFIDENCES,
  GOAL_IDS,
  INSTINCTS,
  MOVE_KINDS,
  PATTERN_IDS,
  STRENGTH_ANCHORS,
  TRC_CODES,
} from "@/lib/types";
import type { EvidenceArg, GoalArg, MoveArg, SynthesizeArgs } from "@/lib/types";

const confidence = z.enum(CONFIDENCES).catch("insufficient");
const text = z.string().catch("");
const list = z.array(z.unknown()).catch([]);

const argsSchema = z.object({
  trc_code: z.enum([...TRC_CODES, "none"] as const).catch("none"),
  trc_confidence: confidence,
  evidence: list,
  socionics_confidence: confidence,
  enneagram_type: z.number().int().min(0).max(9).catch(0),
  enneagram_instinct: z.enum(INSTINCTS).catch("undetermined"),
  enneagram_confidence: confidence,
  how_you_work: text,
  goals: list,
});

const evidenceItem = z.object({ pattern_id: z.enum(PATTERN_IDS), key_words: z.string() });

const moveItem = z.object({ kind: z.enum(MOVE_KINDS), move: text });

const goalItem = z.object({
  goal_id: z.enum(GOAL_IDS),
  goal_short: text,
  strength_anchor: z.enum(STRENGTH_ANCHORS),
  strength_line: text,
  blind_spot_anchor: z.enum(BLIND_SPOT_ANCHORS),
  blind_spot_line: text,
  moves: list,
});

/** What parsing dropped, so the Debug record still counts it. */
export interface ParseReport {
  /** Evidence items the model sent, before any were dropped. */
  evidenceSent: number;
  /** key_words of evidence items dropped for an unknown pattern_id. */
  droppedKeyWords: string[];
  /** Goal and move items dropped for an unknown goal_id, anchor or kind, with the reason. */
  droppedPaths: string[];
}

export interface ParsedArgs {
  args: SynthesizeArgs;
  report: ParseReport;
}

/** Parses the envelope's arguments (a JSON string or an object); throws only when they are not a JSON object. */
export function parseSynthesizeArgs(raw: unknown): ParsedArgs {
  const value: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("synthesize_profile arguments are not a JSON object");
  }
  const parsed = argsSchema.parse(value);
  const droppedKeyWords: string[] = [];
  const droppedPaths: string[] = [];
  const args: SynthesizeArgs = {
    trc_code: parsed.trc_code,
    trc_confidence: parsed.trc_confidence,
    evidence: keepEvidence(parsed.evidence, droppedKeyWords),
    socionics_confidence: parsed.socionics_confidence,
    enneagram_type: parsed.enneagram_type,
    enneagram_instinct: parsed.enneagram_instinct,
    enneagram_confidence: parsed.enneagram_confidence,
    how_you_work: parsed.how_you_work,
    goals: keepGoals(parsed.goals, droppedPaths),
  };
  return { args, report: { evidenceSent: parsed.evidence.length, droppedKeyWords, droppedPaths } };
}

function keepEvidence(items: unknown[], droppedKeyWords: string[]): EvidenceArg[] {
  const kept: EvidenceArg[] = [];
  for (const candidate of items) {
    const evidence = evidenceItem.safeParse(candidate);
    if (evidence.success) {
      kept.push(evidence.data);
      continue;
    }
    const keyWords = (candidate as { key_words?: unknown } | null)?.key_words;
    if (typeof keyWords === "string") droppedKeyWords.push(keyWords);
  }
  return kept;
}

function keepGoals(items: unknown[], droppedPaths: string[]): GoalArg[] {
  const kept: GoalArg[] = [];
  items.forEach((item, index) => {
    const goal = goalItem.safeParse(item);
    if (!goal.success) {
      droppedPaths.push(`goals[${index}] (unknown goal_id or anchor)`);
      return;
    }
    kept.push({ ...goal.data, moves: keepMoves(goal.data.moves, goal.data.goal_id, droppedPaths) });
  });
  return kept;
}

function keepMoves(items: unknown[], goalId: string, droppedPaths: string[]): MoveArg[] {
  const kept: MoveArg[] = [];
  items.forEach((item, index) => {
    const move = moveItem.safeParse(item);
    if (move.success) kept.push(move.data);
    else droppedPaths.push(`goals.${goalId}.moves[${index}] (unknown kind)`);
  });
  return kept;
}
