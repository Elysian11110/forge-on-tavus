// Builds lib/corpus/forge-corpus.json from the read-only source corpus at CORPUS_DIR plus Forge's
// own words in config/forge-system-prompt.md. It keeps only what Forge may publish: the 16 TRC
// rows (CC BY 4.0, credited), TRC's function taglines and stack definitions, short plain-words
// glosses, quadra names and values, Enneagram label words and the pattern list P01 to P14. No
// Jungian (CJTE) or Socionics (KIME) writeups, no Enneagram prose.
//
// Run from the project root: npm run build:corpus
// Every cross-check failure stops the build before anything is written.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { FUNCTIONS, PATTERN_IDS, TRC_CODES } from "../lib/types";
import type { Fn, PatternId, TrcCode } from "../lib/types";

type Quadra = "Alpha" | "Beta" | "Gamma" | "Delta";
const QUADRAS: readonly Quadra[] = ["Alpha", "Beta", "Gamma", "Delta"];

/** Forge's template wording per function: a phrase that fits after "is" or "by". */
const DOING: Record<Fn, string> = {
  Si: "going back to what you've lived through",
  Se: "being all in on what's in front of you right now",
  Ni: "seeing where things are heading",
  Ne: "seeing what else something could become",
  Ti: "making sure it makes sense by your own logic",
  Te: "going by what works and what the facts show",
  Fi: "going by your own sense of what matters",
  Fe: "reading the room and what your people value",
};

/** P01 to P08 point to one function each; the prompt must agree. */
const PATTERN_FUNCTION: Partial<Record<PatternId, Fn>> = {
  P01: "Si", P02: "Se", P03: "Ni", P04: "Ne", P05: "Ti", P06: "Te", P07: "Fi", P08: "Fe",
};

/** What P09 to P14 point to, in the prompt's terms. */
const PATTERN_POINTS_TO: Partial<Record<PatternId, string>> = {
  P09: "R", P10: "A", P11: "fixation", P12: "passion", P13: "instinct", P14: "spark and drain",
};

/** Short second-person labels for the result screen. */
const PATTERN_LABEL: Record<PatternId, string> = {
  P01: "leaning on what you've lived",
  P02: "being all in on the moment",
  P03: "seeing where it's heading",
  P04: "seeing what else it could be",
  P05: "making it make sense to you",
  P06: "going by what works",
  P07: "your own sense of what matters",
  P08: "the mood of the room",
  P09: "a frame that holds steady",
  P10: "a frame that updates fast",
  P11: "a thought that keeps coming back",
  P12: "a drive that keeps showing up",
  P13: "where your attention goes first",
  P14: "what drains you, what refuels you",
};

/** Template wording for the reference-mode patterns; P01 to P08 use their function's phrase. */
const MODE_DOING: Partial<Record<PatternId, string>> = {
  P09: "keeping a frame that holds steady inside you",
  P10: "updating fast from what's newest around you",
};

/** Plain words for the four TRC stack positions, next to TRC's own definitions. */
const STACK_PLAIN = {
  lens: "how you take things in first",
  tool: "how you make it real",
  spark: "what comes and goes, and refuels you",
  drain: "what costs you the most energy",
} as const;

/** How the result and the rundown say each Enneagram instinct; sexual is said as one-to-one (prompt, P13). */
const INSTINCT_LABEL = {
  self_preservative: "self-preservation",
  social: "social",
  sexual: "one-to-one",
} as const;

const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

interface SourceTrcType {
  trc: string;
  callsign: string;
  lens: string;
  tool: string;
  spark: string;
  drain: string;
  jungian: string;
  socionics: string;
}

interface SourceTrc {
  meta: { framework: string; full_name: string; author: string; affiliation: string; license: string };
  cognitive_functions: Record<string, { tagline: string }>;
  function_stack: Record<"lens" | "tool" | "spark" | "drain", { definition: string }>;
  types: SourceTrcType[];
}

interface SourceSociotype {
  socionics: string;
  trc: string;
  quadra: string;
  base: string;
  creative: string;
  derivation_text: string;
}

interface SourceEnneagramType {
  triad: string;
  fixation: string;
  passion: string;
  trap: string;
}

function fail(message: string): never {
  console.error(`build-corpus: ${message}`);
  process.exit(1);
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

const root = process.cwd();
const promptPath = join(root, "config", "forge-system-prompt.md");
check(existsSync(promptPath), "run this from the project root (config/forge-system-prompt.md not found)");

const corpusDirSetting = process.env.CORPUS_DIR?.trim();
check(corpusDirSetting, "CORPUS_DIR is not set; add the corpus folder to .env.local");
const corpusDir = resolve(root, corpusDirSetting);

const shown: string[] = [];

/** Finds a corpus file under CORPUS_DIR; only the relative path is printed, never the folder itself. */
function locate(name: string, subdirs: string[]): string {
  for (const sub of subdirs) {
    const path = join(corpusDir, sub, name);
    if (existsSync(path)) {
      shown.push(join(sub, name));
      return path;
    }
  }
  fail(`${name} not found under CORPUS_DIR (looked in ${subdirs.map((sub) => sub || ".").join(", ")})`);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const DATA_DIRS = ["", "data", "public/data"];
const ENNEAGRAM_DIRS = ["", "enneagram-data", "public/enneagram-data", "../enneagram-data"];

const trc = readJson<SourceTrc>(locate("vrdw_trc_corpus.json", DATA_DIRS));
const kime = readJson<{ quadra_values: Record<string, string[]> }>(locate("vrdw_kime_corpus.json", DATA_DIRS));
const sociotypes = readJson<{ sociotypes: SourceSociotype[] }>(locate("vrdw_kime_sociotypes.json", DATA_DIRS)).sociotypes;
const synthesisSchema = readJson<{ transcript_signal_map: { patterns: { pattern_id: string }[] } }>(
  locate("vrdw_synthesis_schema.json", DATA_DIRS),
);
const enneagramSource = readJson<{ types: Record<string, SourceEnneagramType> }>(
  locate("vrdw_inee_corpus.json", ENNEAGRAM_DIRS),
).types;
const prompt = readFileSync(promptPath, "utf8");

const isFn = (value: string): value is Fn => (FUNCTIONS as readonly string[]).includes(value);
const domainOf = (fn: Fn) => fn[0] as "S" | "N" | "T" | "F";
const modeOf = (fn: Fn) => fn[1] as "i" | "e";
const isDynamic = (domain: string) => domain === "S" || domain === "N";
const OTHER_IN_CATEGORY: Record<string, string> = { S: "N", N: "S", T: "F", F: "T" };
const otherInCategory = (domain: string) => OTHER_IN_CATEGORY[domain];
const flip = (mode: string) => (mode === "i" ? "e" : "i");

// TRC rows: the 16 codes, the notation and the function-stack rules from the TRC paper.

check(trc.types.length === 16, `expected 16 TRC rows, found ${trc.types.length}`);
const sourceRows = new Map(trc.types.map((row) => [row.trc, row]));
check(sourceRows.size === 16, "TRC row codes are not unique");

interface Row {
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

const quadraValues = new Map<Quadra, Fn[]>();
for (const name of QUADRAS) {
  const values = kime.quadra_values[name];
  check(Array.isArray(values) && values.length === 4 && values.every(isFn), `quadra ${name} must list 4 functions`);
  quadraValues.set(name, values as Fn[]);
}

const rows: Row[] = TRC_CODES.map((code) => {
  const source = sourceRows.get(code);
  check(source, `TRC row ${code} is missing`);
  const { lens, tool, spark, drain } = source;
  check(isFn(lens) && isFn(tool) && isFn(spark) && isFn(drain), `${code}: unknown function in the stack`);
  check(code[0] === (modeOf(lens) === "i" ? "R" : "A"), `${code}: first letter does not match the lens mode`);
  check(code[1] === domainOf(lens) && code[2] === domainOf(tool), `${code}: letters do not match lens and tool`);
  check(isDynamic(domainOf(lens)) !== isDynamic(domainOf(tool)) && modeOf(tool) === flip(modeOf(lens)), `${code}: tool breaks the stack rules`);
  check(domainOf(spark) === otherInCategory(domainOf(tool)) && modeOf(spark) === modeOf(lens), `${code}: spark breaks the stack rules`);
  check(domainOf(drain) === otherInCategory(domainOf(lens)) && modeOf(drain) === flip(modeOf(lens)), `${code}: drain breaks the stack rules`);
  check(/^[IE][NS][TF][JP]$/.test(source.jungian), `${code}: Jungian code ${source.jungian} is malformed`);
  check(/^[A-Z]{3}$/.test(source.socionics), `${code}: Socionics code ${source.socionics} is malformed`);
  check(/^[A-Z][a-z]+$/.test(source.callsign), `${code}: callsign ${source.callsign} is not one word`);
  const quadras = QUADRAS.filter((name) => {
    const values = quadraValues.get(name) ?? [];
    return values.includes(lens) && values.includes(tool);
  });
  check(quadras.length === 1, `${code}: lens and tool sit in ${quadras.length} quadras`);
  return {
    code,
    callsign: source.callsign,
    lens,
    tool,
    spark,
    drain,
    jungian: source.jungian,
    socionics: source.socionics,
    quadra: quadras[0],
  };
});

// The prompt's TRC table is what the model picks from, so it must match the corpus exactly.

const promptTable = new Map<string, string[]>();
for (const match of prompt.matchAll(/\b([RA][STNF][STNF]) (Si|Se|Ni|Ne|Ti|Te|Fi|Fe) (Si|Se|Ni|Ne|Ti|Te|Fi|Fe) (Si|Se|Ni|Ne|Ti|Te|Fi|Fe) (Si|Se|Ni|Ne|Ti|Te|Fi|Fe)\./g)) {
  promptTable.set(match[1], match.slice(2, 6));
}
check(promptTable.size === 16, `the prompt's TRC table has ${promptTable.size} rows, expected 16`);
for (const row of rows) {
  const stack = promptTable.get(row.code)?.join(" ");
  check(stack === [row.lens, row.tool, row.spark, row.drain].join(" "), `${row.code}: the prompt's TRC table disagrees with the corpus`);
}

// Socionics cross-checks: each sociotype's quadra, base and creative match its TRC row, and the
// SuperId need ("supplied by others") equals the TRC spark plus drain.

let superIdMatches = 0;
check(sociotypes.length === 16, `expected 16 sociotypes, found ${sociotypes.length}`);
for (const row of rows) {
  const sociotype = sociotypes.find((entry) => entry.trc === row.code);
  check(sociotype, `${row.code}: no sociotype bridges to this row`);
  check(sociotype.socionics === row.socionics, `${row.code}: sociotype ${sociotype.socionics} differs from the row's ${row.socionics}`);
  check(sociotype.quadra === row.quadra, `${row.code}: sociotype quadra ${sociotype.quadra} differs from ${row.quadra}`);
  check(sociotype.base === row.lens && sociotype.creative === row.tool, `${row.code}: base and creative differ from lens and tool`);
  const need = /SuperId need is (Si|Se|Ni|Ne|Ti|Te|Fi|Fe)\b[^.]*?\band (Si|Se|Ni|Ne|Ti|Te|Fi|Fe)\b/.exec(sociotype.derivation_text);
  if (!need) continue;
  const pair = [need[1], need[2]].sort().join(" ");
  const sparkDrain = [row.spark, row.drain].sort().join(" ");
  const valuedOutsideEgo = (quadraValues.get(row.quadra) ?? []).filter((fn) => fn !== row.lens && fn !== row.tool).sort().join(" ");
  if (pair === sparkDrain && pair === valuedOutsideEgo) superIdMatches += 1;
}
check(superIdMatches === 16, `SuperId = spark + drain holds for ${superIdMatches}/16 rows`);

// Functions: the prompt's plain words, Forge's template wording and TRC's tagline.

const glossLine = prompt.split("\n").find((line) => line.startsWith("Functions in plain words:"));
check(glossLine, "the prompt has no 'Functions in plain words' line");
const plain = new Map<string, string>();
for (const match of glossLine.slice("Functions in plain words:".length).matchAll(/(Si|Se|Ni|Ne|Ti|Te|Fi|Fe), (.+?)\.(?=\s+(?:Si|Se|Ni|Ne|Ti|Te|Fi|Fe), |\s*$)/g)) {
  plain.set(match[1], match[2]);
}
check(plain.size === 8, `the prompt glosses ${plain.size} functions, expected 8`);

const functions = Object.fromEntries(
  FUNCTIONS.map((fn) => {
    const tagline = trc.cognitive_functions[fn]?.tagline;
    check(typeof tagline === "string" && tagline.length > 0, `${fn}: TRC tagline missing`);
    return [fn, { plain: plain.get(fn) as string, doing: DOING[fn], tagline }];
  }),
);

const stackRoles = Object.fromEntries(
  (["lens", "tool", "spark", "drain"] as const).map((role) => {
    const definition = trc.function_stack[role]?.definition;
    check(typeof definition === "string" && definition.length > 0, `TRC stack definition for ${role} missing`);
    return [role, { plain: STACK_PLAIN[role], trc: definition }];
  }),
);

// Patterns P01 to P14: names from the synthesis schema, wording from the prompt's patterns block.

const schemaNames = new Map<string, string>();
for (const entry of synthesisSchema.transcript_signal_map.patterns) {
  const match = /^(P\d\d)_(.+)$/.exec(entry.pattern_id);
  if (match) schemaNames.set(match[1], match[2]);
}

const promptPatterns = new Map<string, string>();
for (const match of prompt.matchAll(/^(P\d\d) (.+)$/gm)) promptPatterns.set(match[1], match[2].trim());

const patterns = Object.fromEntries(
  PATTERN_IDS.map((id) => {
    const name = schemaNames.get(id);
    const line = promptPatterns.get(id);
    check(name, `${id}: missing from the synthesis schema`);
    check(line, `${id}: missing from the prompt's patterns block`);
    const fn = PATTERN_FUNCTION[id];
    const colon = /^(.*): (.+)\.$/.exec(line);
    if (fn) {
      check(colon && colon[2] === fn, `${id}: the prompt points it to ${colon?.[2] ?? "nothing"}, the contract says ${fn}`);
    }
    if (id === "P09" || id === "P10") {
      const mode = id === "P09" ? "R" : "A";
      check(colon && colon[2] === `a code starting with ${mode}`, `${id}: the prompt does not point it to ${mode}`);
    }
    const description = colon ? colon[1] : line.replace(/\.$/, "");
    return [
      id,
      {
        name,
        points_to: fn ?? PATTERN_POINTS_TO[id] ?? "",
        plain: description,
        label: PATTERN_LABEL[id],
        doing: fn ? DOING[fn] : MODE_DOING[id] ?? null,
      },
    ];
  }),
);

// Enneagram label words only (the word before " - " in each corpus entry), checked against the prompt.

const enneagram: Record<string, SourceEnneagramType> = {};
const labelWord = (text: string) => text.split(" - ")[0].trim();
for (const type of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
  const source = enneagramSource[type];
  check(source, `Enneagram type ${type} is missing`);
  const entry = {
    triad: source.triad.trim(),
    fixation: labelWord(source.fixation),
    passion: labelWord(source.passion),
    trap: labelWord(source.trap),
  };
  check(["gut", "heart", "head"].includes(entry.triad), `Enneagram ${type}: unknown triad ${entry.triad}`);
  for (const word of [entry.fixation, entry.passion, entry.trap]) {
    check(/^[A-Z][a-z]+$/.test(word), `Enneagram ${type}: label ${word} is not one word`);
  }
  const promptLine = new RegExp(`\\b${type} ${entry.triad}, ${entry.fixation}, ${entry.passion}, ${entry.trap}\\.`);
  check(promptLine.test(prompt), `Enneagram ${type}: the prompt's labels disagree with the corpus`);
  enneagram[type] = entry;
}

// Write the file.

const out = {
  about:
    "Built by scripts/build-corpus.ts from the source corpus and config/forge-system-prompt.md; do not edit by hand. Holds only what v1 publishes: TRC rows and text (CC BY 4.0), plain-words glosses, quadras, Enneagram label words and the pattern list.",
  credit: {
    trc: {
      title: `${trc.meta.full_name} (${trc.meta.framework})`,
      author: trc.meta.author,
      affiliation: trc.meta.affiliation,
      license: trc.meta.license,
      license_url: LICENSE_URL,
      notice: `The TRC rows, function taglines and stack definitions come from ${trc.meta.full_name} by ${trc.meta.author} (${trc.meta.affiliation}), licensed ${trc.meta.license}. The plain-words glosses and template wording are Forge's own, not part of TRC.`,
    },
  },
  trc_rows: rows,
  functions,
  stack_roles: stackRoles,
  quadras: Object.fromEntries(QUADRAS.map((name) => [name, quadraValues.get(name)])),
  patterns,
  enneagram,
  enneagram_instincts: INSTINCT_LABEL,
};

check(out.credit.trc.license === "CC BY 4.0", `TRC license is ${out.credit.trc.license}, expected CC BY 4.0`);
const json = `${JSON.stringify(out, null, 2)}\n`;
check(!/[\u2012-\u2015]/.test(json), "the output would contain a dash character");

const outPath = join(root, "lib", "corpus", "forge-corpus.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, json);

console.info(`read ${shown.join(", ")} and config/forge-system-prompt.md`);
console.info(
  `${rows.length} rows, ${Object.keys(functions).length} functions, ${quadraValues.size} quadras, ${Object.keys(enneagram).length} label sets, ${Object.keys(patterns).length} patterns`,
);
console.info(`SuperId = spark + drain: ${superIdMatches}/16`);
console.info(`wrote lib/corpus/forge-corpus.json (${Buffer.byteLength(json)} bytes)`);
