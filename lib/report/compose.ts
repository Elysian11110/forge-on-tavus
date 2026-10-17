// What the Forge site's engine is given, and what the link ends up carrying. The on-screen profile
// is the source of truth for the type: the engine reads the same words on its own and can land on
// another type, so its Jungian, Socionics and Enneagram cards are rewritten to the called type and
// its narrative is kept only where it names nothing that contradicts that type. The person's goals
// and their own quoted words go wherever the site's report shape has a place for them. No I/O here.

import type { SynthesisContext } from "@/lib/store";
import type { EvidenceQuote, Fn, Goal, Instinct, PatternId, Profile, ProfileGoal } from "@/lib/types";
import { PATTERN_FUNCTION, corpus, fnGloss, trcRow } from "@/lib/synth/corpus";
import type { EnneagramEntry, TrcRow } from "@/lib/synth/corpus";
import { asSentence, howYouWorkFromRow, watchTemplate } from "@/lib/synth/templates";
import { wordCount } from "@/lib/synth/normalize";
import type { SiteEvidence, SiteReport, SiteSystem } from "@/lib/report/site";

/** The extractor's own input cap. */
export const MAX_TEXT_CHARS = 10_000;
/** Below this there isn't enough of their own words to read anything from. */
export const MIN_TEXT_CHARS = 200;
/** The site's page draws three to five summary bullets. */
const MAX_BULLETS = 5;
/** A headline on the site is one short line. */
const HEADLINE_MAX_WORDS = 14;

type Role = "lens" | "tool" | "spark" | "drain";
const ROLES: readonly Role[] = ["lens", "tool", "spark", "drain"];

/** The same four positions in each system's own words. */
const ROLE_WORDS: Record<Role, { jungian: string; socionics: string }> = {
  lens: { jungian: "dominant", socionics: "base" },
  tool: { jungian: "auxiliary", socionics: "creative" },
  spark: { jungian: "tertiary", socionics: "role" },
  drain: { jungian: "inferior", socionics: "vulnerable (PoLR)" },
};

const INSTINCT_CODE: Record<Exclude<Instinct, "undetermined">, string> = { self_preservative: "sp", social: "so", sexual: "sx" };
const INSTINCT_CODES = ["sp", "so", "sx"];

const CENTERS: Record<string, readonly string[]> = { gut: ["8", "9", "1"], heart: ["2", "3", "4"], head: ["5", "6", "7"] };

/** The Enneagram the screen showed, when one was called. */
export interface CalledEnneagram {
  type: number;
  labels: EnneagramEntry;
  instinct: Instinct;
}

/** What the screen showed: the TRC row (null under F01) and the Enneagram (null under F04). */
export interface CalledType {
  row: TrcRow | null;
  enneagram: CalledEnneagram | null;
}

/** Their own words in the order they said them, goals first. */
export function storyText({ goals, turns }: SynthesisContext): string {
  const goalLines = goals.map((goal) => `Working toward: ${goal.user_quote || goal.goal}`);
  return [...goalLines, ...turns.map((turn) => turn.speech)].join("\n").slice(0, MAX_TEXT_CHARS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInstinct(value: string): value is Instinct {
  return value === "self_preservative" || value === "social" || value === "sexual" || value === "undetermined";
}

/** The type as the screen showed it; nothing is called for a missing profile. */
export function calledType(profile: Profile | null): CalledType {
  if (!profile) return { row: null, enneagram: null };
  const row = profile.trc ? trcRow(profile.trc) : null;
  const enneagram =
    profile.enneagram !== null && profile.enneagram_labels
      ? {
          type: profile.enneagram,
          labels: profile.enneagram_labels,
          instinct: isInstinct(profile.enneagram_instinct) ? profile.enneagram_instinct : "undetermined",
        }
      : null;
  return { row, enneagram };
}

function instinctWord(instinct: Instinct): string | null {
  return instinct === "undetermined" ? null : corpus.enneagram_instincts[instinct];
}

/** The reading in one line, for the engine's input and nothing spoken. */
export function readingLine(called: CalledType): string {
  const parts: string[] = [];
  if (called.row) {
    const { row } = called;
    parts.push(`Jungian ${row.jungian} (${row.lens} > ${row.tool} > ${row.spark} > ${row.drain}), Socionics ${row.socionics} in the ${row.quadra} quadra`);
  }
  if (called.enneagram) {
    const word = instinctWord(called.enneagram.instinct);
    parts.push(`Enneagram ${called.enneagram.type}${word ? ` (${word})` : ""}`);
  }
  if (parts.length === 0) return "No type was called on the call, so nothing constrains the reading.";
  return `${parts.join(", ")}: read live on the call from these words, so every system must agree with it.`;
}

/**
 * The life phase the extractor returned, plus what it never saw: the reading from the call, the
 * goals as they were saved, and the person's own words. The scorer reads the phase as JSON, so
 * extra fields reach it as they are.
 */
export function enginePhase(extracted: unknown, context: SynthesisContext): Record<string, unknown> {
  const base = isRecord(extracted) ? extracted : {};
  const ownWords: string[] = [];
  let size = 0;
  for (const turn of context.turns) {
    size += turn.speech.length + 1;
    if (size > MAX_TEXT_CHARS) break;
    ownWords.push(turn.speech);
  }
  return {
    ...base,
    forgeCall: {
      readingOnTheCall: readingLine(calledType(context.profile)),
      goals: context.goals.map(({ goal, by_when, user_quote }) => ({ goal, by_when, user_quote })),
      ownWords,
    },
  };
}

// Where the engine's text contradicts the screen. Codes match as the site's own normalizer reads
// them: Jungian in any case, Socionics and quadras in capitals only ("lie" and "see" are words).

const JUNGIAN_CODE = /\b[IE][NS][TF][JP]\b/gi;
const SOCIONICS_CODE = /\b(?:SLI|SEI|SLE|SEE|ILI|IEI|ILE|IEE|LSI|LII|LSE|LIE|ESI|EII|ESE|EIE)\b/g;
const QUADRA = /\b(?:Alpha|Beta|Gamma|Delta)\b/g;
const FUNCTION = /\b(?:Si|Se|Ni|Ne|Ti|Te|Fi|Fe)\b/g;
const WING = /\b([1-9])w[1-9]\b/gi;
const TYPE_DIGIT = /\b(?:type|core|enneagram)\s+([1-9])\b/gi;
const CENTER_DIGIT = /\b([1-9])\s*\((gut|heart|head)\)/gi;

function matches(text: string, pattern: RegExp): string[] {
  return Array.from(text.matchAll(pattern), (match) => match[0]);
}

function captures(text: string, pattern: RegExp): RegExpMatchArray[] {
  return Array.from(text.matchAll(pattern));
}

/** What the engine agreed with: its own lines are kept on a card only where it read the same thing. */
interface Agreement {
  jungian: boolean;
  socionics: boolean;
  enneagram: boolean;
}

/** True when a line names a type, function or quadra other than the one on the screen. */
export function contradicts(text: string, called: CalledType, agreement: Agreement): boolean {
  const { row, enneagram } = called;
  if (row) {
    if (matches(text, JUNGIAN_CODE).some((code) => code.toUpperCase() !== row.jungian)) return true;
    if (matches(text, SOCIONICS_CODE).some((code) => code !== row.socionics)) return true;
    if (matches(text, QUADRA).some((quadra) => quadra !== row.quadra)) return true;
    // With another type read, every function the engine names sits in the other stack's roles.
    if (!agreement.jungian && matches(text, FUNCTION).length > 0) return true;
  }
  if (enneagram) {
    const type = String(enneagram.type);
    if (captures(text, WING).some((match) => match[1] !== type)) return true;
    if (captures(text, TYPE_DIGIT).some((match) => match[1] !== type)) return true;
    const own = enneagram.labels.triad.toLowerCase();
    if (captures(text, CENTER_DIGIT).some((match) => match[2].toLowerCase() === own && match[1] !== type)) return true;
    if (!agreement.enneagram && (captures(text, WING).length > 0 || captures(text, CENTER_DIGIT).length > 0)) return true;
  }
  return false;
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function roleOf(row: TrcRow, fn: Fn): Role | null {
  return ROLES.find((role) => row[role] === fn) ?? null;
}

function functionSignal(pattern: PatternId, row: TrcRow, system: "jungian" | "socionics"): string | null {
  const label = corpus.patterns[pattern].label;
  const fn = PATTERN_FUNCTION[pattern];
  if (fn) {
    // A function outside the called stack is named by what it does, never by a code the card would contradict.
    const role = roleOf(row, fn);
    return role ? `${ROLE_WORDS[role][system]} ${fn}: ${label}` : label;
  }
  if (pattern === "P14") return `${ROLE_WORDS.drain[system]} ${row.drain}: ${label}`;
  if (pattern === "P09" || pattern === "P10") return label;
  return null;
}

/** The person's own words as the card's "From your life" rows, each pointed at its place in the stack. */
function wordsAsEvidence(quotes: EvidenceQuote[], row: TrcRow, system: "jungian" | "socionics"): SiteEvidence[] | undefined {
  const rows: SiteEvidence[] = [];
  for (const quote of quotes) {
    const signal = functionSignal(quote.pattern_id as PatternId, row, system);
    if (signal) rows.push({ moment: `You said: ${quote.words}`, signal });
  }
  return rows.length > 0 ? rows : undefined;
}

function enneagramSignal(pattern: string, called: CalledEnneagram): string | null {
  const entry = corpus.patterns[pattern as PatternId];
  if (!entry) return null;
  if (pattern === "P13") {
    const word = instinctWord(called.instinct);
    return word ? `${word}: ${entry.label}` : entry.label;
  }
  if (pattern === "P11" || pattern === "P12") return `${called.type} (${called.labels.triad}): ${entry.label}`;
  return null;
}

function wordsAsEnneagramEvidence(quotes: EvidenceQuote[], called: CalledEnneagram): SiteEvidence[] | undefined {
  const rows: SiteEvidence[] = [];
  for (const quote of quotes) {
    const signal = enneagramSignal(quote.pattern_id, called);
    if (signal) rows.push({ moment: `You said: ${quote.words}`, signal });
  }
  return rows.length > 0 ? rows : undefined;
}

function firstWatch(goals: ProfileGoal[]): string | undefined {
  return goals.find((goal) => goal.watch_for.trim())?.watch_for;
}

function jungianCard(row: TrcRow, profile: Profile, engine: SiteSystem, agrees: boolean): SiteSystem {
  const own = agrees ? engine : null;
  const stack = ROLES.map((role) => row[role]).join(" > ");
  return compact({
    code: row.jungian,
    detail: stack,
    verdict: own?.verdict ?? (profile.how_you_work.trim() ? asSentence(profile.how_you_work) : howYouWorkFromRow(row)),
    evidence: own?.evidence ?? wordsAsEvidence(profile.in_your_words, row, "jungian"),
    watchFor: own?.watchFor ?? firstWatch(profile.goals) ?? watchTemplate("drain", row, null),
    bullets: own?.bullets,
    justification:
      own?.justification ||
      `Read live on your call as the ${row.callsign} lens: you lead with ${fnGloss(row.lens).doing}, and you make it real by ${fnGloss(row.tool).doing}. ${capitalise(fnGloss(row.spark).doing)} comes and goes and refuels you; ${fnGloss(row.drain).doing} costs you the most energy.`,
  });
}

function socionicsCard(row: TrcRow, profile: Profile, engine: SiteSystem, agrees: boolean): SiteSystem {
  const own = agrees ? engine : null;
  return compact({
    code: row.socionics,
    detail: `${row.quadra} quadra / Base ${row.lens}`,
    verdict: own?.verdict ?? howYouWorkFromRow(row),
    evidence: own?.evidence ?? wordsAsEvidence(profile.in_your_words, row, "socionics"),
    watchFor: own?.watchFor ?? watchTemplate("drain", row, null),
    bullets: own?.bullets,
    justification:
      own?.justification ||
      `Read across from the ${row.callsign} lens: base ${row.lens}, creative ${row.tool}, role ${row.spark}, vulnerable ${row.drain}, in the ${row.quadra} quadra.`,
  });
}

function centerOf(digit: string): string | null {
  return Object.keys(CENTERS).find((center) => CENTERS[center].includes(digit)) ?? null;
}

/** The engine's tritype with the called type in its own center and first; nothing when the engine's is not one per center. */
function pinnedTritype(engineTritype: string | undefined, called: CalledEnneagram): string | undefined {
  const digits = (engineTritype ?? "").replace(/\D/g, "").split("");
  const centers = digits.map(centerOf);
  if (digits.length !== 3 || centers.some((center) => center === null) || new Set(centers).size !== 3) return undefined;
  const type = String(called.type);
  const others = digits.filter((digit) => centerOf(digit) !== centerOf(type));
  return [type, ...others].join("");
}

/** The engine's instinct order led by the called instinct; the engine's own when none was called. */
function pinnedInstincts(engineStack: string | undefined, called: CalledEnneagram): string | undefined {
  const parsed = (engineStack ?? "").toLowerCase().split("/").map((code) => code.trim());
  const valid = parsed.length === 3 && INSTINCT_CODES.every((code) => parsed.includes(code));
  if (called.instinct === "undetermined") return valid ? parsed.join("/") : engineStack;
  const first = INSTINCT_CODE[called.instinct];
  if (!valid) return first;
  return [first, ...parsed.filter((code) => code !== first)].join("/");
}

function enneagramCard(called: CalledEnneagram, profile: Profile, engine: SiteSystem, agrees: boolean): SiteSystem {
  const own = agrees ? engine : null;
  const { labels } = called;
  return compact({
    code: own?.code ?? String(called.type),
    detail: `triad: ${labels.triad}`,
    tritype: pinnedTritype(engine.tritype, called),
    instinctStack: pinnedInstincts(engine.instinctStack, called),
    verdict: own?.verdict ?? `The thought loop is ${labels.fixation}, the drive behind it is ${labels.passion}, and the trap is ${labels.trap}.`,
    evidence: own?.evidence ?? wordsAsEnneagramEvidence(profile.in_your_words, called),
    watchFor: own?.watchFor ?? watchTemplate("enneagram_trap", null, labels),
    bullets: own?.bullets,
    justification: own?.justification || `Called live on your call as a ${labels.triad} type, from a thought pattern that kept coming back in your own words.`,
  });
}

function trimEnd(text: string): string {
  return text.trim().replace(/[.!?,;:]+$/, "");
}

/** One bullet per goal: the goal as saved, its edge and the first move when the screen had them, else their own words. */
function goalBullets(profile: Profile | null, stored: Goal[]): string[] {
  const byId = new Map<string, Goal>(stored.map((goal) => [goal.goal_id, goal]));
  if (profile && profile.goals.length > 0) {
    return profile.goals.map((card) => {
      const when = card.by_when && card.by_when !== "not said" ? `, ${trimEnd(card.by_when)}` : "";
      const move = card.moves[0] ? ` ${card.moves[0].label}: ${asSentence(card.moves[0].move)}` : "";
      const edge = card.edge.trim() ? ` ${asSentence(card.edge)}` : "";
      const quote = !edge && !move ? ` In your words: ${asSentence(byId.get(card.goal_id)?.user_quote ?? "")}` : "";
      return `Working toward: ${trimEnd(card.goal)}${when}.${edge}${move}${quote}`.trim();
    });
  }
  return stored.map((goal) => {
    const when = goal.by_when && goal.by_when !== "not said" ? `, ${trimEnd(goal.by_when)}` : "";
    const quote = goal.user_quote.trim() ? ` In your words: ${asSentence(goal.user_quote)}` : "";
    return `Working toward: ${trimEnd(goal.goal)}${when}.${quote}`;
  });
}

function firstSentence(text: string): string {
  const match = text.trim().match(/^[^.!?]+[.!?]?/);
  return match ? match[0].trim() : text.trim();
}

function fallbackHeadline(profile: Profile, row: TrcRow): string {
  const line = firstSentence(profile.how_you_work);
  if (line && wordCount(line) <= HEADLINE_MAX_WORDS) return line;
  return `The ${row.callsign} lens, read live on your call`;
}

function jungianOf(system: SiteSystem): string | null {
  return system.code.toUpperCase().match(/[IE][NS][TF][JP]/)?.[0] ?? null;
}

function socionicsOf(system: SiteSystem): string | null {
  return system.code.toUpperCase().match(/\b(?:SLI|SEI|SLE|SEE|ILI|IEI|ILE|IEE|LSI|LII|LSE|LIE|ESI|EII|ESE|EIE)\b/)?.[0] ?? null;
}

function enneagramOf(system: SiteSystem): string | null {
  return system.code.match(/[1-9]/)?.[0] ?? null;
}

/**
 * The engine's report pinned to the screen. Jungian, Socionics and Enneagram come from the profile
 * when the screen called them; the engine's lines on those cards stand only where it read the same
 * type, and its headline, summary and bullets only where they name nothing that contradicts. The
 * goals lead the bullets. Without a profile, or under F01 with no Enneagram, the engine's own
 * reading stands and only the goals are added.
 */
export function pinReport(engine: SiteReport, profile: Profile | null, goals: Goal[]): SiteReport {
  const called = calledType(profile);
  const { row, enneagram } = called;
  const agreement: Agreement = {
    jungian: row !== null && jungianOf(engine.systems.mbti) === row.jungian,
    socionics: row !== null && socionicsOf(engine.systems.socionics) === row.socionics,
    enneagram: enneagram !== null && enneagramOf(engine.systems.enneagram) === String(enneagram.type),
  };
  const keep = (text: string) => !contradicts(text, called, agreement);

  const systems = { ...engine.systems };
  if (profile && row) {
    systems.mbti = jungianCard(row, profile, engine.systems.mbti, agreement.jungian);
    systems.socionics = socionicsCard(row, profile, engine.systems.socionics, agreement.socionics);
  }
  if (profile && enneagram) systems.enneagram = enneagramCard(enneagram, profile, engine.systems.enneagram, agreement.enneagram);

  const headline = keep(engine.headline) ? engine.headline : profile && row ? fallbackHeadline(profile, row) : engine.headline;
  const summary = keep(engine.summary)
    ? engine.summary
    : profile && row
      ? profile.how_you_work.trim()
        ? asSentence(profile.how_you_work)
        : howYouWorkFromRow(row)
      : engine.summary;
  const bullets = [...goalBullets(profile, goals), ...(engine.summaryBullets ?? []).filter(keep)].slice(0, MAX_BULLETS);

  return compact({
    headline,
    summary,
    summaryBullets: bullets.length > 0 ? bullets : undefined,
    method: "phases" as const,
    systems,
  });
}

// What the systems only the Forge engine reads say when it never answered.
const NOT_READ_YET = "Forge's engine didn't get to this one on this call. Talk with Veronica again to fill it in.";

/**
 * The report from the call alone: the pinned Jungian, Socionics and Enneagram cards, the goals and
 * the person's words, with the engine-only systems left honest. Used only when the Forge engine
 * failed, so the person still leaves with a report instead of an error.
 */
export function callOnlyReport(profile: Profile, goals: Goal[]): SiteReport {
  const blank: SiteSystem = { code: "-", justification: NOT_READ_YET };
  const row = profile.trc ? trcRow(profile.trc) : null;
  const engine: SiteReport = {
    headline: row ? fallbackHeadline(profile, row) : "Your Forge report",
    summary: profile.how_you_work.trim() ? asSentence(profile.how_you_work) : row ? howYouWorkFromRow(row) : NOT_READ_YET,
    method: "phases",
    systems: {
      mbti: blank,
      socionics: blank,
      enneagram: blank,
      temperaments: blank,
      moralAlignment: blank,
      attitudinalPsyche: blank,
      bigFive: blank,
    },
  };
  return pinReport(engine, profile, goals);
}

