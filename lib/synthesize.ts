// The pure core behind the signed route, where the model picks and the code quotes. No I/O here.
// The route checks the signature, reads the store and writes the result. Every type field comes
// from the TRC row the evidence supports, every quote is the person's own words from a stored turn,
// and every model line passes the lint or gets its template.

import { FUNCTIONS, GOAL_IDS } from "@/lib/types";
import type {
  BlindSpotAnchor,
  Confidence,
  Debug,
  EvidenceArg,
  EvidenceQuote,
  Fn,
  Goal,
  GoalArg,
  GoalId,
  PatternId,
  Profile,
  ProfileGoal,
  ProfileMove,
  ProfileStatus,
  StrengthAnchor,
  SynthInput,
  SynthResult,
  SynthesizeArgs,
  UserTurn,
} from "@/lib/types";
import { PATTERN_FUNCTION, enneagramEntry, trcRow } from "@/lib/synth/corpus";
import type { EnneagramEntry, TrcRow } from "@/lib/synth/corpus";
import { lintLine } from "@/lib/synth/lint";
import { findWords, normalizeWithMap, normalizeWords, originalSpan, wordCount } from "@/lib/synth/normalize";
import type { WordMap } from "@/lib/synth/normalize";
import type { ParseReport } from "@/lib/synth/parse";
import { composeRundown, f05Rundown } from "@/lib/synth/rundown";
import type { RundownGoal } from "@/lib/synth/rundown";
import {
  MOVE_LABELS,
  REVEAL_MAX_WORDS,
  SPOKEN_CRISIS,
  calledReveal,
  edgeTemplate,
  f01Reveal,
  howYouWorkFromPattern,
  howYouWorkFromRow,
  leanOnTemplate,
  settleQuestionFor,
  spokenF05,
  watchTemplate,
} from "@/lib/synth/templates";
import type { StrengthSource, WatchSource } from "@/lib/synth/templates";

// Caps from config/tools.json: evidence pieces, moves per goal, words per quote, characters per line.
const MAX_EVIDENCE = 6;
const MAX_MOVES = 2;
const KEY_WORDS_MIN = 3;
const KEY_WORDS_MAX = 12;
const CAP = { how_you_work: 200, goal_short: 60, goal: 90, strength_line: 110, blind_spot_line: 110, move: 100 };

// The refusal floors, each counted in different answers with matched evidence.
const MIN_ANSWERS_FOR_ANY_TYPE = 3; // F05, any matched evidence
const MIN_LENS_ANSWERS_FOR_TRC = 3; // F01, evidence behind the row's lens
const MIN_P11_ANSWERS_FOR_ENNEAGRAM = 2; // F04, a thought pattern that keeps coming back

const CONFIDENCE_RANK: Record<Confidence, number> = { insufficient: 0, low: 1, medium: 2, high: 3 };

const STRENGTH_PATTERNS: readonly PatternId[] = ["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08", "P09", "P10"];

// Where a watch-for line goes when its anchor has no source, in order.
const WATCH_FALLBACKS: Record<WatchSource, WatchSource[]> = {
  drain: ["P14", "enneagram_trap"],
  enneagram_trap: ["drain", "P14"],
  P14: ["drain", "enneagram_trap"],
};

const WATCH_MISSING: Record<WatchSource, string> = {
  drain: "anchor: no type called",
  enneagram_trap: "anchor: no Enneagram called",
  P14: "anchor: P14 not matched",
};

interface MatchedEvidence {
  // Position in the model's evidence list, for tie-breaks.
  order: number;
  pattern_id: PatternId;
  // n of every stored turn that holds the key words.
  turns: number[];
  // The person's own words, from the first of those turns.
  words: string;
}

interface NormalizedTurn {
  turn: UserTurn;
  map: WordMap;
}

// What stands after the refusals. The row is gone under F01 and the Enneagram under F04.
interface Called {
  row: TrcRow | null;
  // The row the model named, kept for the tie-break on the settling question.
  modelRow: TrcRow | null;
  enneagram: EnneagramEntry | null;
  triggers: Debug["triggers"];
}

// What one goal's anchors can stand on. The fallback pattern and the watch fallbacks rotate across
// goals, so two cards don't repeat one line when another is there.
interface Anchors {
  row: TrcRow | null;
  enneagram: EnneagramEntry | null;
  matchedPatterns: Set<PatternId>;
  fallbackPattern: PatternId | null;
  goalIndex: number;
}

interface Reveal {
  howYouWork: string;
  spoken: string;
  settleQuestion: string | null;
}

interface BuiltGoal {
  card: ProfileGoal;
  rundown: RundownGoal;
}

// Key words have to sit inside a single turn, so two answers stitched together never match.
function matchEvidence(evidence: EvidenceArg[], turns: UserTurn[]): { matched: MatchedEvidence[]; unmatched: string[] } {
  const stored = turns.map((turn) => ({ turn, map: normalizeWithMap(turn.speech) }));
  const matched: MatchedEvidence[] = [];
  const unmatched: string[] = [];
  evidence.forEach((piece, order) => {
    const needle = normalizeWords(piece.key_words);
    const checkable = order < MAX_EVIDENCE && needle.length >= KEY_WORDS_MIN && needle.length <= KEY_WORDS_MAX;
    const found = checkable ? findInTurns(needle, stored) : null;
    if (!found) {
      unmatched.push(piece.key_words);
      return;
    }
    matched.push({ order, pattern_id: piece.pattern_id, ...found });
  });
  return { matched, unmatched };
}

function findInTurns(needle: string[], stored: NormalizedTurn[]): { turns: number[]; words: string } | null {
  const turns: number[] = [];
  let words = "";
  for (const { turn, map } of stored) {
    const at = findWords(map.words, needle);
    if (at < 0) continue;
    if (turns.length === 0) words = originalSpan(turn.speech, map, at, needle.length);
    turns.push(turn.n);
  }
  return turns.length > 0 ? { turns, words } : null;
}

/**
 * How many different answers the pieces come from. Each answer counts once, and pieces get
 * shuffled so as many answers as possible count, which is a maximum matching of pieces to turns.
 * A phrase the person really said in two answers can fill both.
 */
function distinctAnswers(pieces: readonly MatchedEvidence[]): number {
  const owner = new Map<number, number>();
  const assign = (index: number, seen: Set<number>): boolean => {
    for (const turn of pieces[index].turns) {
      if (seen.has(turn)) continue;
      seen.add(turn);
      const current = owner.get(turn);
      if (current === undefined || assign(current, seen)) {
        owner.set(turn, index);
        return true;
      }
    }
    return false;
  };
  let count = 0;
  for (let index = 0; index < pieces.length; index += 1) {
    if (assign(index, new Set())) count += 1;
  }
  return count;
}

function lensAnswers(matched: readonly MatchedEvidence[], fn: Fn): number {
  return distinctAnswers(matched.filter((piece) => PATTERN_FUNCTION[piece.pattern_id] === fn));
}

function rankedPatterns(matched: readonly MatchedEvidence[]): PatternId[] {
  const counted = STRENGTH_PATTERNS.flatMap((pattern) => {
    const pieces = matched.filter((piece) => piece.pattern_id === pattern);
    return pieces.length === 0 ? [] : [{ pattern, answers: distinctAnswers(pieces), order: pieces[0].order }];
  });
  return counted.sort((a, b) => b.answers - a.answers || a.order - b.order).map((entry) => entry.pattern);
}

// The lens with the most matched answers. Ties go to the model's own row, then to the earlier piece.
function likeliestLens(matched: readonly MatchedEvidence[], rowLens: Fn | null): Fn | null {
  let best: Fn | null = null;
  let bestCount = 0;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const fn of FUNCTIONS) {
    const pieces = matched.filter((piece) => PATTERN_FUNCTION[piece.pattern_id] === fn);
    if (pieces.length === 0) continue;
    const count = distinctAnswers(pieces);
    const rank = fn === rowLens ? -1 : pieces[0].order;
    if (count > bestCount || (count === bestCount && rank < bestRank)) {
      best = fn;
      bestCount = count;
      bestRank = rank;
    }
  }
  return best ?? rowLens;
}

function minConfidence(a: Confidence, b: Confidence): Confidence {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;
}

function quotesFrom(matched: readonly MatchedEvidence[]): EvidenceQuote[] {
  const seen = new Set<string>();
  const quotes: EvidenceQuote[] = [];
  for (const piece of matched) {
    const quote = `${piece.pattern_id}|${piece.words}`;
    if (seen.has(quote)) continue;
    seen.add(quote);
    quotes.push({ pattern_id: piece.pattern_id, words: piece.words });
  }
  return quotes;
}

function rotate<T>(list: readonly T[], goalIndex: number): T | null {
  return list.length === 0 ? null : list[goalIndex % list.length];
}

// F01 and F04 only ever take away. The model's row stands only when the model is sure and enough
// different answers back its lens, and its Enneagram only when a thought pattern kept coming back.
function applyRefusals(args: SynthesizeArgs, matched: readonly MatchedEvidence[]): Called {
  const modelRow = args.trc_code === "none" ? null : trcRow(args.trc_code);
  const lensCount = modelRow
    ? lensAnswers(matched, modelRow.lens)
    : Math.max(0, ...FUNCTIONS.map((fn) => lensAnswers(matched, fn)));
  const rowStands = modelRow !== null && args.trc_confidence !== "insufficient" && lensCount >= MIN_LENS_ANSWERS_FOR_TRC;
  const p11Count = distinctAnswers(matched.filter((piece) => piece.pattern_id === "P11"));
  const enneagramStands = args.enneagram_confidence !== "insufficient" && p11Count >= MIN_P11_ANSWERS_FOR_ENNEAGRAM;
  const enneagram = enneagramStands ? enneagramEntry(args.enneagram_type) : null;
  const triggers: Debug["triggers"] = [];
  if (!rowStands) triggers.push({ id: "F01", count: lensCount });
  if (!enneagram) triggers.push({ id: "F04", count: p11Count });
  return { row: rowStands ? modelRow : null, modelRow, enneagram, triggers };
}

// A model line that passed, or the reason it did not.
type Checked = { text: string; why: null } | { text: null; why: string };

function modelLine(line: string, cap: number, anchorWhy: string | null): Checked {
  if (anchorWhy) return { text: null, why: anchorWhy };
  const lint = lintLine(line, cap);
  if (lint) return { text: null, why: `lint: ${lint}` };
  return { text: line.trim(), why: null };
}

function composeReveal(args: SynthesizeArgs, matched: readonly MatchedEvidence[], called: Called, fallbackPattern: PatternId | null, replaced: string[]): Reveal {
  const { row } = called;
  const template = row ? howYouWorkFromRow(row) : howYouWorkFromPattern(fallbackPattern);
  const line = modelLine(args.how_you_work, CAP.how_you_work, null);
  if (line.why) replaced.push(`how_you_work (${line.why})`);
  let howYouWork = line.text ?? template;
  if (!row) {
    const settleQuestion = settleQuestionFor(likeliestLens(matched, called.modelRow?.lens ?? null));
    return { howYouWork, spoken: f01Reveal(settleQuestion), settleQuestion };
  }
  let spoken = calledReveal(howYouWork, row.callsign);
  if (wordCount(spoken) > REVEAL_MAX_WORDS && howYouWork !== template) {
    howYouWork = template;
    spoken = calledReveal(template, row.callsign);
    replaced.push(`how_you_work (over ${REVEAL_MAX_WORDS} words)`);
  }
  return { howYouWork, spoken, settleQuestion: null };
}

function fallbackStrength(anchors: Anchors): StrengthSource | null {
  if (anchors.row) return { kind: "lens", fn: anchors.row.lens };
  return anchors.fallbackPattern ? { kind: "pattern", pattern: anchors.fallbackPattern } : null;
}

function resolveStrength(anchor: StrengthAnchor, anchors: Anchors): { source: StrengthSource | null; why: string | null } {
  if (anchor === "lens" || anchor === "tool") {
    if (anchors.row) return { source: { kind: anchor, fn: anchors.row[anchor] }, why: null };
    return { source: fallbackStrength(anchors), why: "anchor: no type called" };
  }
  if (anchors.matchedPatterns.has(anchor)) return { source: { kind: "pattern", pattern: anchor }, why: null };
  return { source: fallbackStrength(anchors), why: `anchor: ${anchor} not matched` };
}

function watchStands(source: WatchSource, anchors: Anchors): boolean {
  if (source === "drain") return anchors.row !== null;
  if (source === "enneagram_trap") return anchors.enneagram !== null;
  return anchors.matchedPatterns.has("P14");
}

function resolveWatch(anchor: BlindSpotAnchor, anchors: Anchors): { source: WatchSource | null; why: string | null } {
  if (watchStands(anchor, anchors)) return { source: anchor, why: null };
  const standing = WATCH_FALLBACKS[anchor].filter((source) => watchStands(source, anchors));
  return { source: rotate(standing, anchors.goalIndex), why: WATCH_MISSING[anchor] };
}

function blankGoal(goalId: GoalId): GoalArg {
  return {
    goal_id: goalId,
    goal_short: "",
    strength_anchor: "lens",
    strength_line: "",
    blind_spot_anchor: "drain",
    blind_spot_line: "",
    moves: [],
  };
}

function goalLabel(entry: GoalArg, stored: Goal | undefined, note: (field: string, why: string) => void): string | null {
  const short = modelLine(entry.goal_short, CAP.goal_short, null);
  if (short.why) note("goal_short", short.why);
  if (short.text) return short.text;
  return stored && !lintLine(stored.goal, CAP.goal) ? stored.goal.trim() : null;
}

function goalMoves(entry: GoalArg, fallback: StrengthSource | null, note: (field: string, why: string) => void): ProfileMove[] {
  const moves: ProfileMove[] = [];
  entry.moves.forEach((move, index) => {
    const line = modelLine(move.move, CAP.move, index >= MAX_MOVES ? "more than two" : null);
    if (line.why !== null) {
      note(`moves[${index}]`, line.why);
      return;
    }
    moves.push({ label: MOVE_LABELS[move.kind], move: line.text });
  });
  if (moves.length === 0) moves.push({ label: MOVE_LABELS.lean_on, move: leanOnTemplate(fallback) });
  return moves;
}

// A stored goal the model skipped still gets a card, built from templates.
function buildGoal(goalId: GoalId, sent: GoalArg | null, stored: Goal | undefined, anchors: Anchors, replaced: string[]): BuiltGoal {
  const path = `goals.${goalId}`;
  if (!sent) replaced.push(`${path} (not sent)`);
  const note = (field: string, why: string) => {
    if (sent) replaced.push(`${path}.${field} (${why})`);
  };
  const entry = sent ?? blankGoal(goalId);

  const label = goalLabel(entry, stored, note);
  const strength = resolveStrength(entry.strength_anchor, anchors);
  const edgeLine = modelLine(entry.strength_line, CAP.strength_line, strength.why);
  if (edgeLine.why) note("edge", edgeLine.why);
  const edge = edgeLine.text ?? (strength.source ? edgeTemplate(strength.source) : "");

  const watch = resolveWatch(entry.blind_spot_anchor, anchors);
  const watchLine = modelLine(entry.blind_spot_line, CAP.blind_spot_line, watch.why);
  if (watchLine.why) note("watch_for", watchLine.why);
  const watchFor = watchLine.text ?? (watch.source ? watchTemplate(watch.source, anchors.row, anchors.enneagram) : "");

  const moves = goalMoves(entry, strength.source, note);
  const card: ProfileGoal = {
    goal_id: goalId,
    goal: stored?.goal ?? label ?? `Goal ${GOAL_IDS.indexOf(goalId) + 1}`,
    by_when: stored?.by_when ?? "not said",
    edge,
    watch_for: watchFor,
    moves,
  };
  return { card, rundown: { label, edge, watch: watchFor, moves: moves.map((move) => move.move) } };
}

function buildGoals(args: SynthesizeArgs, stored: Goal[], matched: readonly MatchedEvidence[], called: Called, ranked: PatternId[], replaced: string[]): BuiltGoal[] {
  const sent = new Map<GoalId, GoalArg>();
  args.goals.forEach((entry, index) => {
    if (sent.has(entry.goal_id)) {
      replaced.push(`goals[${index}] (duplicate goal_id)`);
      return;
    }
    sent.set(entry.goal_id, entry);
  });
  const kept = new Map(stored.map((goal) => [goal.goal_id, goal]));
  const matchedPatterns = new Set(matched.map((piece) => piece.pattern_id));
  return GOAL_IDS.filter((id) => sent.has(id) || kept.has(id)).map((id, goalIndex) => {
    const anchors: Anchors = {
      row: called.row,
      enneagram: called.enneagram,
      matchedPatterns,
      fallbackPattern: rotate(ranked, goalIndex),
      goalIndex,
    };
    return buildGoal(id, sent.get(id) ?? null, kept.get(id), anchors, replaced);
  });
}

function emptyProfile(status: ProfileStatus, spoken: string, rundown: string): Profile {
  return {
    status,
    triggers: [],
    trc: null,
    callsign: null,
    lens: null,
    tool: null,
    spark: null,
    drain: null,
    jungian: null,
    socionics: null,
    quadra: null,
    trc_confidence: "insufficient",
    socionics_confidence: "insufficient",
    enneagram: null,
    enneagram_labels: null,
    enneagram_instinct: "undetermined",
    enneagram_confidence: "insufficient",
    in_your_words: [],
    how_you_work: "",
    goals: [],
    settle_question: null,
    spoken_reveal: spoken,
    rundown_context: rundown,
  };
}

function composeProfile(args: SynthesizeArgs, matched: readonly MatchedEvidence[], called: Called, reveal: Reveal, goals: BuiltGoal[]): Profile {
  const { row, enneagram } = called;
  const trcConfidence: Confidence = row ? args.trc_confidence : "insufficient";
  // Socionics is read off the TRC row too, so it's never surer than TRC.
  const socionicsConfidence: Confidence = row ? minConfidence(args.socionics_confidence, trcConfidence) : "insufficient";
  const socionics =
    row && socionicsConfidence !== "insufficient" ? { code: row.socionics, quadra: row.quadra, confidence: socionicsConfidence } : null;
  return {
    status: called.triggers.length > 0 || socionics === null ? "partial" : "complete",
    triggers: called.triggers.map((trigger) => trigger.id),
    trc: row?.code ?? null,
    callsign: row?.callsign ?? null,
    lens: row?.lens ?? null,
    tool: row?.tool ?? null,
    spark: row?.spark ?? null,
    drain: row?.drain ?? null,
    jungian: row?.jungian ?? null,
    socionics: socionics?.code ?? null,
    quadra: socionics?.quadra ?? null,
    trc_confidence: trcConfidence,
    socionics_confidence: socionicsConfidence,
    enneagram: enneagram ? args.enneagram_type : null,
    enneagram_labels: enneagram ? { ...enneagram } : null,
    enneagram_instinct: enneagram ? args.enneagram_instinct : "undetermined",
    enneagram_confidence: enneagram ? args.enneagram_confidence : "insufficient",
    in_your_words: quotesFrom(matched),
    how_you_work: reveal.howYouWork,
    goals: goals.map((goal) => goal.card),
    settle_question: reveal.settleQuestion,
    spoken_reveal: reveal.spoken,
    rundown_context: composeRundown({
      row,
      trcConfidence,
      socionics,
      enneagram: enneagram
        ? { type: args.enneagram_type, labels: enneagram, instinct: args.enneagram_instinct, confidence: args.enneagram_confidence }
        : null,
      whatISaw: row ? null : reveal.howYouWork,
      goals: goals.map((goal) => goal.rundown),
    }),
  };
}

/**
 * Match, refuse (F05, F01, F04, downgrade only), read across, anchor, lint, compose. Pass the report
 * from parseSynthesizeArgs so the Debug record still counts what parsing dropped.
 */
export function synthesize(input: SynthInput, report?: ParseReport): SynthResult {
  const { args, turns, goals, crisis } = input;
  const { matched, unmatched } = matchEvidence(args.evidence, turns);
  const replaced = [...(report?.droppedPaths ?? [])];
  const debug = (triggers: Debug["triggers"]): Debug => ({
    evidence_sent: report?.evidenceSent ?? args.evidence.length,
    evidence_matched: matched.length,
    unmatched: [...(report?.droppedKeyWords ?? []), ...unmatched],
    triggers,
    replaced,
  });
  const reading = (profile: Profile, triggers: Debug["triggers"]): SynthResult => ({
    profile,
    debug: debug(triggers),
    spokenText: profile.spoken_reveal,
  });
  const goalsOnScreen = goals.length > 0;

  if (crisis) return reading(emptyProfile("withheld_for_safety", SPOKEN_CRISIS, ""), []);

  const answers = distinctAnswers(matched);
  if (answers < MIN_ANSWERS_FOR_ANY_TYPE) {
    const refused = emptyProfile("insufficient", spokenF05(goalsOnScreen), f05Rundown(goalsOnScreen));
    return reading({ ...refused, triggers: ["F05"], in_your_words: quotesFrom(matched) }, [{ id: "F05", count: answers }]);
  }

  const called = applyRefusals(args, matched);
  const ranked = rankedPatterns(matched);
  const reveal = composeReveal(args, matched, called, ranked[0] ?? null, replaced);
  const cards = buildGoals(args, goals, matched, called, ranked, replaced);
  return reading(composeProfile(args, matched, called, reveal, cards), called.triggers);
}
