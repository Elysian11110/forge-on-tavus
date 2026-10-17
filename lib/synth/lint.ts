// The four checks on every model-written line: codes, dashes, quotation marks and one banned-word
// list (nicknames, wings, kill words, therapy-speak, clinical words). A line that fails any check,
// is blank or runs over its cap is replaced or dropped by the caller.

import { TRC_CODES } from "@/lib/types";
import { JUNGIAN_CODE, SOCIONICS_CODE } from "@/lib/synth/codes";
import { corpus } from "@/lib/synth/corpus";
import { normalizeText } from "@/lib/synth/normalize";

export type LintReason = "empty" | "over_cap" | "code" | "dash" | "quote" | "banned";

// Codes and framework names. TRC codes match in capitals only, because "ant" is an ordinary word;
// the Jungian and Socionics patterns come from lib/synth/codes.

const CALLSIGNS = corpus.trc_rows.map((row) => row.callsign).join("|");

const CODE_PATTERNS: readonly RegExp[] = [
  new RegExp(`\\b(?:${TRC_CODES.join("|")})\\b`),
  JUNGIAN_CODE,
  SOCIONICS_CODE,
  /\b(?:Si|Se|Ni|Ne|Ti|Te|Fi|Fe|SI|SE|NI|NE|TI|TE|FI|FE)\b/,
  /\b(?:introvert(?:ed)?|extravert(?:ed)?|extrovert(?:ed)?)\s+(?:sensing|sensor|intuition|intuitive|thinking|thinker|feeling|feeler)\b/i,
  /\b(?:TRC|MBTI|Myers[\s-]?Briggs|Jung|Jungian|Socionics?|Enneagram|sociotypes?|quadras?|cognitive functions?)\b/i,
  /\btype\s+(?:[1-9]|one|two|three|four|five|six|seven|eight|nine)\b/i,
  new RegExp(`\\b(?:${CALLSIGNS})\\s+lens\\b`, "i"),
];

export function hasCode(text: string): boolean {
  return CODE_PATTERNS.some((pattern) => pattern.test(text));
}

// Dashes: em, en and their relatives, a spaced hyphen and a double hyphen. A hyphen inside a word
// ("race-day") is fine.

const DASH = /[\u2012-\u2015\u2E3A\u2E3B\uFE31\uFE32\uFE58]|(?:^|\s)-{1,2}(?:\s|$)|--/;

export function hasDash(text: string): boolean {
  return DASH.test(text);
}

// Quotation marks: a double quote, guillemets, a left single quote, or a phrase wrapped in single
// quotes. An apostrophe inside a word ("I'm", "Sam's") is fine.

const QUOTE_MARK = /["\u201C\u201D\u201E\u201F\u00AB\u00BB\u2039\u203A\u300C\u300D\uFF02\u2018]/;
const SINGLE_QUOTED = /(?:^|[\s([{])['\u2019][^\s'\u2019][^'\u2019]*['\u2019](?=$|[\s.,!?;:)\]}])/;

export function hasQuote(text: string): boolean {
  return QUOTE_MARK.test(text) || SINGLE_QUOTED.test(text);
}

// One banned-word list. Phrases are compared after the same normalization as quote matching.

/** Archetype nicknames (16 Personalities, Keirsey, Enneagram), flagged after "the" or capitalized mid-sentence. */
const NICKNAMES = [
  "Architect", "Logician", "Commander", "Debater", "Advocate", "Mediator", "Protagonist", "Campaigner",
  "Logistician", "Defender", "Executive", "Consul", "Virtuoso", "Adventurer", "Entrepreneur", "Entertainer",
  "Mastermind", "Inventor", "Fieldmarshal", "Counselor", "Healer", "Champion", "Inspector", "Protector",
  "Supervisor", "Provider", "Crafter", "Composer", "Promoter", "Performer", "Rational", "Idealist",
  "Guardian", "Artisan", "Reformer", "Helper", "Achiever", "Individualist", "Investigator", "Loyalist",
  "Enthusiast", "Challenger", "Peacemaker", "Perfectionist", "Giver", "Romantic", "Observer", "Questioner",
  "Epicure",
];
const NICKNAME = new RegExp(`(?:\\b[Tt]he\\s+|(?<=[\\p{Ll}\\p{N},;:]\\s+))(?:${NICKNAMES.join("|")})s?\\b`, "u");

/** Socionics type nicknames that are people's names. */
const PERSON_NICKNAME = /\b(?:Quixote|Robespierre|Hamlet|Gorky|Zhukov|Yesenin|Napoleon|Balzac|Dreiser|Stierlitz|Dostoevsky|Gabin|Dumas|Huxley)\b/;

/** Enneagram wings such as 5w6. */
const WING = /\b[1-9]\s?w\s?[1-9]\b/i;

/** Kill words from the Forge copy rules, matched as word stems (journeys, empowering, alignment). */
const KILL_STEMS = /\b(?:journey|authentic|embrac|empower|unlock|discover|potential|align)\w*/;

/** "Your type can't" style limits. */
const TYPE_LIMIT = /\b(?:type|types|people like you)\s+(?:like you\s+)?(?:can not|could not|will not|would not|will never|would never|never|is not able|are not able|should not)\b/;

const BANNED_PHRASES: readonly string[] = [
  // wings and kill words said as whole words
  "wing", "wings",
  // therapy-speak, including the prompt's never-say lines
  "how does that make you feel", "i'm hearing that", "what i'm hearing", "hold space", "holding space",
  "safe space", "healing", "heal", "inner child", "validate your feelings", "feel validated",
  "process your feelings", "processing your feelings", "trauma", "traumatic", "traumatized", "triggered",
  "triggering", "toxic", "gaslight", "gaslighting", "codependent", "based on what you've shared",
  "great question", "as an ai language model",
  // clinical words
  "anxiety", "anxious", "depression", "depressed", "depressive", "disorder", "disorders", "narcissist",
  "narcissistic", "narcissism", "adhd", "ocd", "ptsd", "bipolar", "autism", "autistic", "schizophrenia",
  "schizophrenic", "psychopath", "sociopath", "psychotic", "diagnosis", "diagnose", "diagnosed", "diagnostic",
  "symptom", "symptoms", "therapy", "therapist", "therapeutic", "medication", "clinical", "pathological",
  "neurotic", "paranoid", "mental illness", "mental health condition", "panic attack", "panic attacks",
].map(normalizeText);

export function hasBannedWord(text: string): boolean {
  if (NICKNAME.test(text) || PERSON_NICKNAME.test(text) || WING.test(text)) return true;
  const normalized = normalizeText(text);
  const padded = ` ${normalized} `;
  return (
    BANNED_PHRASES.some((phrase) => padded.includes(` ${phrase} `)) ||
    KILL_STEMS.test(normalized) ||
    TYPE_LIMIT.test(normalized)
  );
}

/** The first reason a model line fails, or null when it can be used as written. Caps count characters. */
export function lintLine(line: string, cap: number): LintReason | null {
  if (!line.trim()) return "empty";
  if (Array.from(line).length > cap) return "over_cap";
  if (hasCode(line)) return "code";
  if (hasDash(line)) return "dash";
  if (hasQuote(line)) return "quote";
  if (hasBannedWord(line)) return "banned";
  return null;
}
