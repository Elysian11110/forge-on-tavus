// Typed access to lib/corpus/forge-corpus.json, which scripts/build-corpus.ts builds and checks.
// Pure lookups, no I/O: the JSON is bundled with the server code.

import data from "@/lib/corpus/forge-corpus.json";
import type { Fn, PatternId, TrcCode } from "@/lib/types";

export type Quadra = "Alpha" | "Beta" | "Gamma" | "Delta";

/** One TRC row with the Jungian and Socionics codes read across from it. */
export interface TrcRow {
  code: TrcCode;
  callsign: string;
  lens: Fn;
  tool: Fn;
  spark: Fn;
  drain: Fn;
  jungian: string;
  socionics: string;
  quadra: Quadra;
}

/** A function in plain words: the prompt's gloss, the template wording and TRC's tagline. */
export interface FunctionGloss {
  plain: string;
  doing: string;
  tagline: string;
}

/** One pattern from the prompt's patterns block; doing is the template wording for P01 to P10. */
export interface PatternEntry {
  name: string;
  points_to: string;
  plain: string;
  label: string;
  doing: string | null;
}

export interface EnneagramEntry {
  triad: string;
  fixation: string;
  passion: string;
  trap: string;
}

export interface ForgeCorpus {
  about: string;
  credit: {
    trc: { title: string; author: string; affiliation: string; license: string; license_url: string; notice: string };
  };
  trc_rows: TrcRow[];
  functions: Record<Fn, FunctionGloss>;
  stack_roles: Record<"lens" | "tool" | "spark" | "drain", { plain: string; trc: string }>;
  quadras: Record<Quadra, Fn[]>;
  patterns: Record<PatternId, PatternEntry>;
  enneagram: Record<string, EnneagramEntry>;
  enneagram_instincts: Record<"self_preservative" | "social" | "sexual", string>;
}

export const corpus = data as unknown as ForgeCorpus;

/** P01 to P08 point to Si, Se, Ni, Ne, Ti, Te, Fi and Fe; P09 to P14 point to no function. */
export const PATTERN_FUNCTION: Readonly<Partial<Record<PatternId, Fn>>> = {
  P01: "Si",
  P02: "Se",
  P03: "Ni",
  P04: "Ne",
  P05: "Ti",
  P06: "Te",
  P07: "Fi",
  P08: "Fe",
};

const rowsByCode = new Map<string, TrcRow>(corpus.trc_rows.map((row) => [row.code, row]));

/** The TRC row for a code; throws only if the corpus file is broken. */
export function trcRow(code: TrcCode): TrcRow {
  const row = rowsByCode.get(code);
  if (!row) throw new Error(`TRC row ${code} is missing from forge-corpus.json`);
  return row;
}

export function fnGloss(fn: Fn): FunctionGloss {
  return corpus.functions[fn];
}

/** Template wording for a pattern (P01 to P10), or null for P11 to P14. */
export function patternDoing(pattern: PatternId): string | null {
  return corpus.patterns[pattern]?.doing ?? null;
}

/** Enneagram label words for types 1 to 9, null otherwise. */
export function enneagramEntry(type: number): EnneagramEntry | null {
  if (!Number.isInteger(type) || type < 1 || type > 9) return null;
  return corpus.enneagram[String(type)] ?? null;
}
