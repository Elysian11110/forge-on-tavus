// The proof behind "the model picks, the code quotes": no invented quote reaches the screen or
// the voice, refusals only downgrade, every row reads across, every model line passes the lint or
// gets its template, and the Sam call gives the expected reveal.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FUNCTIONS, PATTERN_IDS, TRC_CODES } from "@/lib/types";
import type { Fn, Goal, GoalArg, PatternId, SynthesizeArgs, TrcCode, UserTurn } from "@/lib/types";
import { synthesize } from "@/lib/synthesize";
import { corpus, trcRow, type Quadra } from "@/lib/synth/corpus";
import { lintLine, type LintReason } from "@/lib/synth/lint";
import { wordCount } from "@/lib/synth/normalize";
import { parseSynthesizeArgs } from "@/lib/synth/parse";
import { RUNDOWN_MAX_BYTES, f05Rundown } from "@/lib/synth/rundown";
import {
  REVEAL_MAX_WORDS,
  SETTLE_QUESTIONS,
  SPOKEN_CRISIS,
  calledReveal,
  edgeTemplate,
  f01Reveal,
  howYouWorkFromPattern,
  howYouWorkFromRow,
  leanOnTemplate,
  spokenF05,
  watchTemplate,
} from "@/lib/synth/templates";
import { SAM_CONVERSATION_ID, SAM_EXPECTED_REVEAL, SAM_INFERENCE_ID, samArguments, samGoals, samInput, samTurns } from "./fixtures/sam";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const bytes = (text: string) => new TextEncoder().encode(text).length;
const spell = (code: string) => code.split("").join(", ");

// Independent of the lint's own lists, so the rundown check is not circular.
const BARE_CODES: readonly RegExp[] = [
  /\b(?:ISTJ|ISFJ|ESTP|ESFP|INTJ|INFJ|ENTP|ENFP|ISTP|INTP|ESTJ|ENTJ|ISFP|INFP|ESFJ|ENFJ)\b/i,
  /\b(?:SLI|SEI|SLE|SEE|ILI|IEI|ILE|IEE|LSI|LII|LSE|LIE|ESI|EII|ESE|EIE)\b/,
  /\b(?:RST|RSF|AST|ASF|RNT|RNF|ANT|ANF|RTS|RTN|ATS|ATN|RFS|RFN|AFS|AFN)\b/,
  /\b(?:Si|Se|Ni|Ne|Ti|Te|Fi|Fe)\b/,
];

function expectNoBareCodes(text: string) {
  for (const pattern of BARE_CODES) expect(text).not.toMatch(pattern);
}

/** Every TRC row as the TRC paper and standard type theory give it, written out independently of the corpus file. */
const EXPECTED_ROWS: Record<TrcCode, readonly [string, Fn, Fn, Fn, Fn, string, string, string]> = {
  RST: ["Tradition", "Si", "Te", "Fi", "Ne", "ISTJ", "SLI", "Delta"],
  RSF: ["Nostalgia", "Si", "Fe", "Ti", "Ne", "ISFJ", "SEI", "Alpha"],
  AST: ["Experiment", "Se", "Ti", "Fe", "Ni", "ESTP", "SLE", "Beta"],
  ASF: ["Energy", "Se", "Fi", "Te", "Ni", "ESFP", "SEE", "Gamma"],
  RNT: ["Planning", "Ni", "Te", "Fi", "Se", "INTJ", "ILI", "Gamma"],
  RNF: ["Awareness", "Ni", "Fe", "Ti", "Se", "INFJ", "IEI", "Beta"],
  ANT: ["Curiosity", "Ne", "Ti", "Fe", "Si", "ENTP", "ILE", "Alpha"],
  ANF: ["Dream", "Ne", "Fi", "Te", "Si", "ENFP", "IEE", "Delta"],
  RTS: ["Guarding", "Ti", "Se", "Ni", "Fe", "ISTP", "LSI", "Beta"],
  RTN: ["Improvement", "Ti", "Ne", "Si", "Fe", "INTP", "LII", "Alpha"],
  ATS: ["Duty", "Te", "Si", "Ne", "Fi", "ESTJ", "LSE", "Delta"],
  ATN: ["Mission", "Te", "Ni", "Se", "Fi", "ENTJ", "LIE", "Gamma"],
  RFS: ["Protection", "Fi", "Se", "Ni", "Te", "ISFP", "ESI", "Gamma"],
  RFN: ["Understanding", "Fi", "Ne", "Si", "Te", "INFP", "EII", "Delta"],
  AFS: ["Connection", "Fe", "Si", "Ne", "Ti", "ESFJ", "ESE", "Alpha"],
  AFN: ["Community", "Fe", "Ni", "Se", "Ti", "ENFJ", "EIE", "Beta"],
};

const LENS_PATTERN: Record<Fn, PatternId> = {
  Si: "P01", Se: "P02", Ni: "P03", Ne: "P04", Ti: "P05", Te: "P06", Fi: "P07", Fe: "P08",
};

/** Seven plain answers; each test points key words from them at whichever pattern it needs. */
const STORIES = [
  "The first thing I did was sketch the whole plan out on paper.",
  "Then I rang my sister and talked the whole thing through with her.",
  "After that I booked the smallest room I could find for a trial run.",
  "My best week was when I stopped checking my phone after dinner.",
  "Honestly the worst part is the long meetings with no clear point.",
  "Every time it comes back to the same worry about letting people down.",
  "I keep thinking that if I slip once everyone will notice it.",
];
const KEY_WORDS = [
  "sketch the whole plan out",
  "talked the whole thing through with her",
  "booked the smallest room I could find",
  "stopped checking my phone after dinner",
  "the long meetings with no clear point",
  "the same worry about letting people down",
  "if I slip once everyone will notice",
];

const ev = (pattern_id: PatternId, story: number) => ({ pattern_id, key_words: KEY_WORDS[story] });

function turnsOf(speeches: string[] = STORIES): UserTurn[] {
  return speeches.map((speech, index) => ({ n: index + 1, speech, inference_id: `inf_${index + 1}` }));
}

const GOAL: Goal = { goal_id: "g1", goal: "Open a studio", by_when: "by summer", user_quote: "I want to open a studio by summer." };
const SECOND_GOAL: Goal = { goal_id: "g2", goal: "Run a half marathon", by_when: "in March", user_quote: "I'm running a half marathon in March." };

function goalArg(overrides: Partial<GoalArg> = {}): GoalArg {
  return {
    goal_id: "g1",
    goal_short: "the studio",
    strength_anchor: "lens",
    strength_line: "You can already see the studio open, so each step points the same way.",
    blind_spot_anchor: "drain",
    blind_spot_line: "Busy, noisy days cost you the most, so keep them rare this month.",
    moves: [{ kind: "lean_on", move: "Write the opening day down, then list three steps back from it." }],
    ...overrides,
  };
}

/** A Planning read: three answers behind Ni, one behind Te, one drain story. */
function argsWith(overrides: Partial<SynthesizeArgs> = {}): SynthesizeArgs {
  return {
    trc_code: "RNT",
    trc_confidence: "high",
    evidence: [ev("P03", 0), ev("P03", 1), ev("P03", 2), ev("P06", 3), ev("P14", 4)],
    socionics_confidence: "medium",
    enneagram_type: 0,
    enneagram_instinct: "undetermined",
    enneagram_confidence: "insufficient",
    how_you_work: "You picture the finish line first, then you build the steps that prove it works.",
    goals: [goalArg()],
    ...overrides,
  };
}

function run(args: SynthesizeArgs, turns: UserTurn[] = turnsOf(), goals: Goal[] = [GOAL], crisis = false) {
  return synthesize({ args, turns, goals, crisis });
}

const RNT = trcRow("RNT");
const RNT_LENS_EDGE = edgeTemplate({ kind: "lens", fn: "Ni" });
const RNT_DRAIN_WATCH = watchTemplate("drain", RNT, null);
const RNT_LEAN_ON = leanOnTemplate({ kind: "lens", fn: "Ni" });

describe("the corpus file", () => {
  it("holds the 16 TRC rows in code order, with the TRC credit", () => {
    expect(corpus.trc_rows.map((row) => row.code)).toEqual([...TRC_CODES]);
    expect(corpus.credit.trc).toMatchObject({ author: "Gourav Kumar Mallick", license: "CC BY 4.0" });
    expect(corpus.credit.trc.notice).toContain("Gourav Kumar Mallick");
  });

  it("matches the independent table for every row, and the SuperId pair is spark plus drain for all 16", () => {
    for (const code of TRC_CODES) {
      const [callsign, lens, tool, spark, drain, jungian, socionics, quadra] = EXPECTED_ROWS[code];
      expect(trcRow(code)).toEqual({ code, callsign, lens, tool, spark, drain, jungian, socionics, quadra });
      const valuedOutsideEgo = corpus.quadras[quadra as Quadra].filter((fn) => fn !== lens && fn !== tool);
      expect(new Set(valuedOutsideEgo)).toEqual(new Set([spark, drain]));
    }
  });

  it("ships labels only: 8 functions, 4 quadras, 9 Enneagram label sets, 14 patterns, no writeups or dashes", () => {
    expect(Object.keys(corpus.functions)).toEqual([...FUNCTIONS]);
    expect(Object.keys(corpus.quadras)).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
    expect(Object.keys(corpus.patterns)).toEqual([...PATTERN_IDS]);
    expect(Object.keys(corpus.enneagram)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    for (const entry of Object.values(corpus.enneagram)) {
      expect(["gut", "heart", "head"]).toContain(entry.triad);
      for (const label of [entry.fixation, entry.passion, entry.trap]) expect(label).toMatch(/^[A-Z][a-z]+$/);
    }
    const raw = read("../lib/corpus/forge-corpus.json");
    expect(raw).not.toMatch(/derivation|holy_idea|Holy |[\u2012-\u2015]/);
    const strings: string[] = [];
    JSON.parse(raw, (_key, value) => {
      if (typeof value === "string") strings.push(value);
      return value;
    });
    for (const value of strings) expect(value.length).toBeLessThan(300);
  });

  it("keeps the plain glosses and the hunch bank in step with the prompt", () => {
    const prompt = read("../config/forge-system-prompt.md");
    for (const fn of FUNCTIONS) expect(prompt).toContain(`${fn}, ${corpus.functions[fn].plain}.`);
    expect(prompt).toContain(SETTLE_QUESTIONS.perceiving_outer);
    expect(prompt).toContain(SETTLE_QUESTIONS.thinking);
    expect(prompt).toContain(SETTLE_QUESTIONS.feeling);
    // The Si or Ni question is the general form of this line.
    expect(prompt).toContain("were you going off what you've seen work before, or where you could see it heading?");
  });
});

describe("parsing never trims or guesses", () => {
  it("falls back field by field", () => {
    const { args } = parseSynthesizeArgs({
      trc_code: "INTJ",
      trc_confidence: "High",
      evidence: "none",
      socionics_confidence: "very high",
      enneagram_type: 12,
      enneagram_instinct: "sx",
      enneagram_confidence: 3,
      how_you_work: "  kept exactly as sent  ",
      goals: { not: "a list" },
    });
    expect(args).toEqual({
      trc_code: "none",
      trc_confidence: "insufficient",
      evidence: [],
      socionics_confidence: "insufficient",
      enneagram_type: 0,
      enneagram_instinct: "undetermined",
      enneagram_confidence: "insufficient",
      how_you_work: "  kept exactly as sent  ",
      goals: [],
    });
    expect(parseSynthesizeArgs({ enneagram_type: "5" }).args.enneagram_type).toBe(0);
    expect(parseSynthesizeArgs({ enneagram_type: 4.5 }).args.enneagram_type).toBe(0);
    expect(parseSynthesizeArgs({ enneagram_type: 7 }).args.enneagram_type).toBe(7);
    expect(parseSynthesizeArgs({ how_you_work: "x".repeat(250) }).args.how_you_work).toHaveLength(250);
  });

  it("drops an item with an unknown pattern_id, goal_id, anchor or kind, and the Debug record still counts it", () => {
    const { args, report } = parseSynthesizeArgs(
      JSON.stringify({
        ...samArguments,
        evidence: [...samArguments.evidence.slice(0, 5), { pattern_id: "P15", key_words: "I only sell to shops I actually trust" }],
        goals: [
          { ...samArguments.goals[0], moves: [samArguments.goals[0].moves[0], { kind: "stretch", move: "Do one big stretch a day." }] },
          { ...samArguments.goals[1], goal_id: "g4" },
          { ...samArguments.goals[1], strength_anchor: "P11" },
        ],
      }),
    );
    expect(args.evidence).toHaveLength(5);
    expect(args.goals.map((goal) => goal.goal_id)).toEqual(["g1"]);
    expect(args.goals[0].moves).toHaveLength(1);

    const { profile, debug } = synthesize(samInput({ args }), report);
    expect(debug.evidence_sent).toBe(6);
    expect(debug.evidence_matched).toBe(5);
    expect(debug.unmatched).toEqual(["I only sell to shops I actually trust"]);
    expect(debug.replaced).toEqual([
      "goals.g1.moves[1] (unknown kind)",
      "goals[1] (unknown goal_id or anchor)",
      "goals[2] (unknown goal_id or anchor)",
      "goals.g2 (not sent)",
    ]);
    // The stored second goal still gets a card, built from templates.
    expect(profile.goals.map((goal) => goal.goal_id)).toEqual(["g1", "g2"]);
  });

  it("reads the envelope's JSON string and throws on anything that is not a JSON object", () => {
    expect(parseSynthesizeArgs(JSON.stringify(samArguments)).args).toEqual(samArguments);
    for (const bad of ["not json", "[1, 2]", "null", "42", 42, null, ["a"]]) {
      expect(() => parseSynthesizeArgs(bad)).toThrow();
    }
  });
});

describe("quote matching: no invented quote reaches the screen", () => {
  it("drops key words the person never said, even a near miss or two answers stitched together", () => {
    const invented = [
      "I always knew exactly where my life was going",
      "I could already see the shop open in summer",
      "the shop open in spring I check the sales sheet",
    ];
    const args: SynthesizeArgs = {
      ...samArguments,
      evidence: [...samArguments.evidence.slice(0, 3), ...invented.map((key_words) => ({ pattern_id: "P03" as const, key_words }))],
    };
    const { profile, debug } = synthesize(samInput({ args }));
    const shown = [
      ...profile.in_your_words.map((quote) => quote.words),
      profile.spoken_reveal,
      profile.rundown_context,
      profile.how_you_work,
    ]
      .join(" | ")
      .toLowerCase();
    for (const phrase of invented) expect(shown).not.toContain(phrase.toLowerCase());
    expect(debug.unmatched).toEqual(invented);
    expect(debug.evidence_matched).toBe(3);
    expect(profile.in_your_words).toHaveLength(3);
  });

  it('matches "5" to "five" and "I\'m" to "I am" in both directions, yet an invented quote still fails', () => {
    const turns = turnsOf([
      "I'm done by noon on market days.",
      "We ran 5 miles before work, every single day.",
      "I am the one who books every venue.",
      "Back then it was five shops, and I\u2019d rather plan it twice.",
    ]);
    const args = argsWith({
      evidence: [
        { pattern_id: "P03", key_words: "I am done by noon" },
        { pattern_id: "P03", key_words: "we ran five miles before work" },
        { pattern_id: "P03", key_words: "I'm the one who books" },
        { pattern_id: "P06", key_words: "it was 5 shops and I'd rather plan it twice" },
        { pattern_id: "P06", key_words: "I am done by eleven" },
        { pattern_id: "P06", key_words: "we ran six miles before work" },
      ],
    });
    const { profile, debug } = run(args, turns);
    expect(profile.in_your_words.map((quote) => quote.words)).toEqual([
      "I'm done by noon",
      "We ran 5 miles before work",
      "I am the one who books",
      "it was five shops, and I\u2019d rather plan it twice",
    ]);
    expect(debug.unmatched).toEqual(["I am done by eleven", "we ran six miles before work"]);
  });

  it("shows the person's own words, never the model's copy of them", () => {
    const { profile } = synthesize(samInput());
    const speeches = samTurns.map((turn) => turn.speech);
    for (const quote of profile.in_your_words) {
      expect(speeches.some((speech) => speech.includes(quote.words))).toBe(true);
    }
    expect(profile.in_your_words.map((quote) => quote.words)).toContain("I'd already played out the next 5 years in my head");
  });

  it("checks at most six pieces, each 3 to 12 words", () => {
    const args = argsWith({
      evidence: [
        ev("P03", 0),
        { pattern_id: "P03", key_words: "whole plan" },
        { pattern_id: "P03", key_words: "The first thing I did was sketch the whole plan out on paper" },
        ev("P03", 1),
        ev("P03", 2),
        ev("P06", 3),
        ev("P14", 4),
      ],
    });
    const { debug } = run(args);
    expect(debug.evidence_matched).toBe(4);
    expect(debug.unmatched).toEqual(["whole plan", "The first thing I did was sketch the whole plan out on paper", KEY_WORDS[4]]);
  });
});

describe("refusals only ever downgrade", () => {
  it("F05: fewer than three answers with matched evidence gives no type at all, however sure the model is", () => {
    const args = argsWith({
      evidence: [ev("P03", 0), ev("P03", 1), { pattern_id: "P03", key_words: "I never said any of this at all" }],
      enneagram_type: 5,
      enneagram_confidence: "high",
    });
    const { profile, debug, spokenText } = run(args);
    expect(profile).toMatchObject({
      status: "insufficient",
      triggers: ["F05"],
      trc: null,
      jungian: null,
      socionics: null,
      enneagram: null,
      how_you_work: "",
      goals: [],
      settle_question: null,
      spoken_reveal: spokenF05(true),
      rundown_context: f05Rundown(true),
    });
    expect(spokenText).toBe(spokenF05(true));
    expect(debug.triggers).toEqual([{ id: "F05", count: 2 }]);
  });

  it("F05 with no goal saved stops at the refusal: nothing on the screen to point to", () => {
    const { profile } = run(argsWith({ evidence: [ev("P03", 0)] }), turnsOf(), []);
    expect(profile.spoken_reveal).toBe(spokenF05(false));
    expect(profile.spoken_reveal).not.toContain("screen");
    expect(profile.rundown_context).toBe(f05Rundown(false));
    expect(profile.rundown_context).not.toContain("screen");
  });

  it("an unknown conversation has zero turns, so the signed call gets the F05 line", () => {
    const { profile, debug } = synthesize(samInput({ turns: [], goals: [] }));
    expect(profile.spoken_reveal).toBe(spokenF05(false));
    expect(debug).toMatchObject({ evidence_sent: 6, evidence_matched: 0, triggers: [{ id: "F05", count: 0 }] });
  });

  it("F01: fewer than three answers behind the row's lens gives no TRC, Jungian or Socionics, and asks the settling question", () => {
    const args = argsWith({ evidence: [ev("P03", 0), ev("P03", 1), ev("P06", 2), ev("P14", 3), ev("P11", 5), ev("P11", 6)], enneagram_type: 6, enneagram_confidence: "medium" });
    const { profile, debug } = run(args);
    expect(profile).toMatchObject({
      status: "partial",
      triggers: ["F01"],
      trc: null,
      callsign: null,
      lens: null,
      jungian: null,
      socionics: null,
      quadra: null,
      trc_confidence: "insufficient",
      socionics_confidence: "insufficient",
      enneagram: 6,
      enneagram_labels: { triad: "head", fixation: "Cowardice", passion: "Fear", trap: "Security" },
      settle_question: SETTLE_QUESTIONS.perceiving_inner,
    });
    expect(profile.spoken_reveal).toBe(f01Reveal(SETTLE_QUESTIONS.perceiving_inner));
    expect(debug.triggers).toEqual([{ id: "F01", count: 2 }]);
    expect(profile.rundown_context).toContain("no type called yet");
    expect(profile.rundown_context).toContain("When they answer, thank them");
    expect(profile.rundown_context).not.toContain("Jungian:");
  });

  it("F01 never upgrades: trc_code none stays uncalled even with enough evidence for a row", () => {
    const { profile, debug } = run(argsWith({ trc_code: "none" }));
    expect(profile.trc).toBeNull();
    expect(profile.triggers).toContain("F01");
    expect(debug.triggers[0]).toEqual({ id: "F01", count: 3 });
    expect(profile.spoken_reveal).toBe(f01Reveal(SETTLE_QUESTIONS.perceiving_inner));
  });

  it("F01 also follows the model's own insufficient, and picks the question for the likeliest lens", () => {
    expect(run(argsWith({ trc_confidence: "insufficient" })).profile.trc).toBeNull();
    const thinking = run(argsWith({ trc_code: "none", evidence: [ev("P05", 0), ev("P05", 1), ev("P02", 2), ev("P14", 3)] }));
    expect(thinking.profile.settle_question).toBe(SETTLE_QUESTIONS.thinking);
  });

  it("F04: fewer than two answers with matched P11 gives no Enneagram, and type 0 is never upgraded", () => {
    const one = run(argsWith({ evidence: [...argsWith().evidence, ev("P11", 5)], enneagram_type: 5, enneagram_confidence: "high", enneagram_instinct: "social" }));
    expect(one.profile).toMatchObject({ enneagram: null, enneagram_labels: null, enneagram_instinct: "undetermined", enneagram_confidence: "insufficient" });
    expect(one.debug.triggers).toEqual([{ id: "F04", count: 1 }]);

    const zero = run(argsWith({ evidence: [ev("P03", 0), ev("P03", 1), ev("P03", 2), ev("P11", 4), ev("P11", 5), ev("P11", 6)] }));
    expect(zero.profile.enneagram).toBeNull();
    expect(zero.profile.triggers).toEqual(["F04"]);
  });

  it("calls the Enneagram on two P11 answers and reads only the label words", () => {
    const { profile } = run(argsWith({ evidence: [ev("P03", 0), ev("P03", 1), ev("P03", 2), ev("P11", 5), ev("P11", 6)], enneagram_type: 5, enneagram_confidence: "medium", enneagram_instinct: "sexual" }));
    expect(profile).toMatchObject({
      status: "complete",
      triggers: [],
      enneagram: 5,
      enneagram_labels: { triad: "head", fixation: "Stinginess", passion: "Avarice", trap: "Observer" },
      enneagram_instinct: "sexual",
    });
    expect(profile.rundown_context).toContain("type five");
    expect(profile.rundown_context).toContain("Instinct: one-to-one.");
  });

  it("counts a phrase said in two different answers twice, but never one answer twice", () => {
    const turns = turnsOf(["I could see it all coming a mile away.", "Same with the move, I could see it all coming.", "Then a third time with the job offer."]);
    const repeat = { pattern_id: "P03" as const, key_words: "I could see it all coming" };
    const third = { pattern_id: "P03" as const, key_words: "a third time with the job" };
    expect(run(argsWith({ evidence: [repeat, repeat, third] }), turns).profile.trc).toBe("RNT");

    const once = turnsOf(["I could see it all coming a mile away.", "Then a third time with the job offer.", "Nothing much else to say."]);
    const { profile, debug } = run(argsWith({ evidence: [repeat, repeat, third] }), once);
    expect(profile.status).toBe("insufficient");
    expect(debug.triggers).toEqual([{ id: "F05", count: 2 }]);
  });

  it("withholds every reading under the crisis flag", () => {
    const { profile, spokenText } = run(argsWith(), turnsOf(), [GOAL], true);
    expect(profile).toMatchObject({ status: "withheld_for_safety", trc: null, enneagram: null, goals: [], in_your_words: [], rundown_context: "" });
    expect(spokenText).toBe(SPOKEN_CRISIS);
  });
});

describe("read-across from the TRC row", () => {
  it.each([...TRC_CODES])("%s reads across, its templates pass the lint and its rundown spells every code", (code) => {
    const [callsign, lens, tool, spark, drain, jungian, socionics, quadra] = EXPECTED_ROWS[code];
    const args = argsWith({
      trc_code: code,
      evidence: [ev(LENS_PATTERN[lens], 0), ev(LENS_PATTERN[lens], 1), ev(LENS_PATTERN[lens], 2), ev(LENS_PATTERN[tool], 3), ev("P14", 4)],
      how_you_work: "",
      goals: [goalArg({ goal_short: "", strength_line: "", blind_spot_line: "", moves: [] })],
    });
    const { profile } = run(args);
    expect(profile).toMatchObject({ status: "partial", triggers: ["F04"], trc: code, callsign, lens, tool, spark, drain, jungian, socionics, quadra });

    expect(profile.how_you_work).toBe(howYouWorkFromRow(trcRow(code)));
    expect(profile.spoken_reveal).toBe(calledReveal(profile.how_you_work, callsign));
    expect(wordCount(profile.spoken_reveal)).toBeLessThanOrEqual(REVEAL_MAX_WORDS);

    const [card] = profile.goals;
    expect(lintLine(profile.how_you_work, 200)).toBeNull();
    expect(lintLine(card.edge, 110)).toBeNull();
    expect(lintLine(card.watch_for, 110)).toBeNull();
    expect(card.moves).toHaveLength(1);
    expect(lintLine(card.moves[0].move, 100)).toBeNull();

    expect(profile.rundown_context).toContain(`Jungian: ${spell(jungian)}`);
    expect(profile.rundown_context).toContain(`Socionics: ${spell(socionics)}, in the ${quadra} group`);
    expect(profile.rundown_context).toContain("Goal 1, Open a studio.");
    expectNoBareCodes(profile.rundown_context);
    expect(bytes(profile.rundown_context)).toBeLessThanOrEqual(RUNDOWN_MAX_BYTES);
  });

  it("caps Socionics confidence at TRC's, and leaves Socionics uncalled at insufficient", () => {
    const capped = run(argsWith({ trc_confidence: "medium", socionics_confidence: "high" })).profile;
    expect(capped).toMatchObject({ trc_confidence: "medium", socionics_confidence: "medium", socionics: "ILI", quadra: "Gamma" });

    const uncalled = run(argsWith({ trc_confidence: "high", socionics_confidence: "insufficient" })).profile;
    expect(uncalled).toMatchObject({ status: "partial", jungian: "INTJ", socionics: null, quadra: null, socionics_confidence: "insufficient" });
    expect(uncalled.rundown_context).toContain("Socionics: not called yet.");
  });
});

describe("lint and templates", () => {
  it("rejects quotation marks in every model line", () => {
    const args = argsWith({
      how_you_work: 'You said "spring" a lot, and you plan backwards from it.',
      goals: [
        goalArg({
          strength_line: "You keep saying \u201cone day\u201d and then you make it real.",
          blind_spot_line: "The \u2018busy\u2019 days cost you the most energy.",
          moves: [{ kind: "guard", move: "Say 'not this week' to one market day." }],
        }),
      ],
    });
    const { profile, debug } = run(args);
    expect(profile.how_you_work).toBe(howYouWorkFromRow(RNT));
    expect(profile.goals[0]).toMatchObject({ edge: RNT_LENS_EDGE, watch_for: RNT_DRAIN_WATCH, moves: [{ label: "Lean on", move: RNT_LEAN_ON }] });
    expect(debug.replaced).toEqual([
      "how_you_work (lint: quote)",
      "goals.g1.edge (lint: quote)",
      "goals.g1.watch_for (lint: quote)",
      "goals.g1.moves[0] (lint: quote)",
    ]);
    expect(profile.spoken_reveal).not.toMatch(/["\u201c\u201d\u2018]/);
  });

  const failing: Array<[string, LintReason, string]> = [
    ["a Jungian code", "code", "You're such an INTJ about the plan."],
    ["a lowercase Jungian code", "code", "Classic intj move, honestly."],
    ["a TRC code", "code", "That's the RNT in you, no question."],
    ["a Socionics code", "code", "Very ILI of you to wait it out."],
    ["a function code", "code", "Your Ni is doing the heavy lifting here."],
    ["a framework name", "code", "On the Enneagram side you keep circling back."],
    ["an em dash", "dash", "You see where it goes \u2014 then you build it."],
    ["an en dash", "dash", "You see where it goes \u2013 then you build it."],
    ["a spaced hyphen", "dash", "You see where it goes - then you build it."],
    ["a nickname", "banned", "You are the Architect of your own plan."],
    ["a wing", "banned", "That sounds like a 5w6 way of planning."],
    ["a kill word", "banned", "This whole journey starts with one shelf."],
    ["therapy-speak", "banned", "Your inner child wants the shop to feel safe."],
    ["a clinical word", "banned", "That market anxiety is worth planning around."],
    ["a type limit", "banned", "Your type can't handle crowded days."],
  ];

  it.each(failing)("replaces a line with %s by its gloss template, and the Debug record says why", (_label, reason, line) => {
    expect(lintLine(line, 200)).toBe(reason);
    const { profile, debug } = run(argsWith({ how_you_work: line, goals: [goalArg({ strength_line: line, blind_spot_line: line })] }));
    expect(profile.how_you_work).toBe(howYouWorkFromRow(RNT));
    expect(profile.goals[0].edge).toBe(RNT_LENS_EDGE);
    expect(profile.goals[0].watch_for).toBe(RNT_DRAIN_WATCH);
    expect(debug.replaced).toEqual([`how_you_work (lint: ${reason})`, `goals.g1.edge (lint: ${reason})`, `goals.g1.watch_for (lint: ${reason})`]);
  });

  it("keeps every template within the same caps and lint as model lines", () => {
    const sources = [
      ...FUNCTIONS.flatMap((fn) => [{ kind: "lens" as const, fn }, { kind: "tool" as const, fn }]),
      ...PATTERN_IDS.slice(0, 10).map((pattern) => ({ kind: "pattern" as const, pattern })),
    ];
    for (const source of sources) {
      expect(lintLine(edgeTemplate(source), 110)).toBeNull();
      expect(lintLine(leanOnTemplate(source), 100)).toBeNull();
    }
    for (const code of TRC_CODES) {
      expect(lintLine(howYouWorkFromRow(trcRow(code)), 200)).toBeNull();
      expect(lintLine(watchTemplate("drain", trcRow(code), null), 110)).toBeNull();
    }
    for (const pattern of [...PATTERN_IDS.slice(0, 10), null] as const) {
      expect(lintLine(howYouWorkFromPattern(pattern), 200)).toBeNull();
    }
    expect(lintLine(watchTemplate("P14", null, null), 110)).toBeNull();
    expect(lintLine(leanOnTemplate(null), 100)).toBeNull();
  });

  it("passes ordinary lines with apostrophes, possessives and hyphenated words", () => {
    for (const line of [
      ...samArguments.goals.flatMap((goal) => [goal.strength_line, goal.blind_spot_line, ...goal.moves.map((move) => move.move)]),
      samArguments.how_you_work,
      "I\u2019m sure Sam's dogs' bowls are fine, and it\u2019s a five-minute walk.",
    ]) {
      expect(lintLine(line, 200)).toBeNull();
    }
  });

  it("treats an over-cap line like a lint failure", () => {
    const longLine = `You plan ${"steadily ".repeat(30)}`.slice(0, 201);
    const { profile, debug } = run(
      argsWith({
        how_you_work: longLine,
        goals: [goalArg({ strength_line: longLine.slice(0, 111), moves: [{ kind: "lean_on", move: longLine.slice(0, 101) }, { kind: "refuel", move: "Keep the Sunday walk." }] })],
      }),
    );
    expect(profile.how_you_work).toBe(howYouWorkFromRow(RNT));
    expect(profile.goals[0].edge).toBe(RNT_LENS_EDGE);
    expect(profile.goals[0].moves).toEqual([{ label: "Refuel", move: "Keep the Sunday walk." }]);
    expect(debug.replaced).toEqual(["how_you_work (lint: over_cap)", "goals.g1.edge (lint: over_cap)", "goals.g1.moves[0] (lint: over_cap)"]);
  });

  it("drops failed moves and a third move, and keeps one templated lean_on move when none survive", () => {
    const dropped = run(argsWith({ goals: [goalArg({ moves: [{ kind: "lean_on", move: "Tell your INTJ friend about it." }, { kind: "guard", move: "Skip one \u2014 just one." }] })] }));
    expect(dropped.profile.goals[0].moves).toEqual([{ label: "Lean on", move: RNT_LEAN_ON }]);
    expect(dropped.debug.replaced).toEqual(["goals.g1.moves[0] (lint: code)", "goals.g1.moves[1] (lint: dash)"]);

    const three = run(
      argsWith({
        goals: [
          goalArg({
            moves: [
              { kind: "lean_on", move: "Sketch the opening day on one page." },
              { kind: "bring_in", move: "Ask a friend to run the till." },
              { kind: "refuel", move: "Keep Sunday free." },
            ],
          }),
        ],
      }),
    );
    expect(three.profile.goals[0].moves.map((move) => move.label)).toEqual(["Lean on", "Bring in"]);
    expect(three.debug.replaced).toEqual(["goals.g1.moves[2] (more than two)"]);
  });

  it("anchors need their source: under F01 lens falls back to the strongest matched pattern and drain to P14", () => {
    const { profile, debug } = run(argsWith({ evidence: [ev("P03", 0), ev("P03", 1), ev("P06", 2), ev("P14", 3)] }));
    expect(profile.triggers).toContain("F01");
    expect(profile.goals[0].edge).toBe(edgeTemplate({ kind: "pattern", pattern: "P03" }));
    expect(profile.goals[0].watch_for).toBe(watchTemplate("P14", null, null));
    expect(profile.goals[0].moves[0].move).toBe("Write the opening day down, then list three steps back from it.");
    expect(debug.replaced).toEqual(["goals.g1.edge (anchor: no type called)", "goals.g1.watch_for (anchor: no type called)"]);
    expect(profile.rundown_context).toContain(`What I did see: ${profile.how_you_work}`);
  });

  it("under F01 two goals get different fallback lines: the next matched pattern, and the next watch source", () => {
    const args = argsWith({
      evidence: [ev("P03", 0), ev("P03", 1), ev("P06", 2), ev("P14", 3), ev("P11", 5), ev("P11", 6)],
      enneagram_type: 6,
      enneagram_confidence: "medium",
      goals: [goalArg(), goalArg({ goal_id: "g2", goal_short: "the half marathon" })],
    });
    const { profile } = run(args, turnsOf(), [GOAL, SECOND_GOAL]);
    expect(profile.triggers).toEqual(["F01"]);
    const [first, second] = profile.goals;
    expect(first.edge).toBe(edgeTemplate({ kind: "pattern", pattern: "P03" }));
    expect(second.edge).toBe(edgeTemplate({ kind: "pattern", pattern: "P06" }));
    expect(first.watch_for).toBe(watchTemplate("P14", null, null));
    expect(second.watch_for).toBe(watchTemplate("enneagram_trap", null, corpus.enneagram["6"]));
    expect(second.watch_for).toContain("Security");
  });

  it("an Enneagram trap anchor without a called Enneagram falls back to the drain", () => {
    const { profile, debug } = run(argsWith({ goals: [goalArg({ blind_spot_anchor: "enneagram_trap", blind_spot_line: "Watch the Perfection loop on this one." })] }));
    expect(profile.goals[0].watch_for).toBe(RNT_DRAIN_WATCH);
    expect(debug.replaced).toEqual(["goals.g1.watch_for (anchor: no Enneagram called)"]);
  });

  it("uses the stored goal when goal_short fails, and builds a card for a stored goal the model skipped", () => {
    const { profile, debug } = run(argsWith({ goals: [goalArg({ goal_short: "the INTJ plan" })] }), turnsOf(), [GOAL, SECOND_GOAL]);
    expect(profile.rundown_context).toContain("Goal 1, Open a studio.");
    expect(profile.rundown_context).toContain("Goal 2, Run a half marathon.");
    expect(profile.goals[1]).toEqual({
      goal_id: "g2",
      goal: "Run a half marathon",
      by_when: "in March",
      edge: RNT_LENS_EDGE,
      watch_for: RNT_DRAIN_WATCH,
      moves: [{ label: "Lean on", move: RNT_LEAN_ON }],
    });
    expect(debug.replaced).toEqual(["goals.g1.goal_short (lint: code)", "goals.g2 (not sent)"]);
  });
});

describe("the reveal and the rundown", () => {
  it("speaks the three templates word for word", () => {
    expect(spokenF05(true)).toBe(
      "Okay, honest answer: I don't have enough of your stories yet, and I'm not going to guess. Give me two more sometime and I'll call it. Your goals are on your screen either way.",
    );
    expect(spokenF05(false)).toBe(
      "Okay, honest answer: I don't have enough of your stories yet, and I'm not going to guess. Give me two more sometime and I'll call it.",
    );
    expect(calledReveal("You plan ahead.", "Planning")).toBe(
      "Okay, here's what I'm seeing. You plan ahead. That's the Planning lens. What fits, and what doesn't?",
    );
    expect(f01Reveal("Which one?")).toBe(
      "Okay, honest version: your stories didn't point one way often enough, so I won't guess a type yet. Here's the one question that would settle it: Which one?",
    );
  });

  it("keeps the reveal within 60 words: a model line that would push it over is replaced", () => {
    const words = (count: number) => `${Array.from({ length: count }, () => "go").join(" ")}.`;
    const fits = run(argsWith({ how_you_work: words(46) }));
    expect(wordCount(fits.profile.spoken_reveal)).toBe(60);
    expect(fits.debug.replaced).toEqual([]);

    const over = run(argsWith({ how_you_work: words(47) }));
    expect(over.profile.how_you_work).toBe(howYouWorkFromRow(RNT));
    expect(wordCount(over.profile.spoken_reveal)).toBeLessThanOrEqual(REVEAL_MAX_WORDS);
    expect(over.debug.replaced).toEqual(["how_you_work (over 60 words)"]);
  });

  it("fits every F01 and F05 reveal in 60 words", () => {
    for (const question of Object.values(SETTLE_QUESTIONS)) {
      expect(wordCount(f01Reveal(question))).toBeLessThanOrEqual(REVEAL_MAX_WORDS);
    }
    expect(wordCount(spokenF05(true))).toBeLessThanOrEqual(REVEAL_MAX_WORDS);
  });

  it("keeps the rundown within 1,500 bytes with three full goals and a called Enneagram", () => {
    const fill = (start: string, length: number) => `${start}${" and keep going".repeat(20)}`.slice(0, length - 1).trimEnd() + ".";
    const fullGoal = (goal_id: "g1" | "g2" | "g3"): GoalArg => ({
      goal_id,
      goal_short: fill(`the ${goal_id} project`, 60),
      strength_anchor: "lens",
      strength_line: fill("You can see the end first", 110),
      blind_spot_anchor: "drain",
      blind_spot_line: fill("Busy days cost you the most", 110),
      moves: [
        { kind: "lean_on", move: fill("Write the end down first", 100) },
        { kind: "bring_in", move: fill("Ask a friend to take the busy days", 100) },
      ],
    });
    const { profile } = run(
      argsWith({
        evidence: [ev("P03", 0), ev("P03", 1), ev("P03", 2), ev("P06", 3), ev("P11", 5), ev("P11", 6)],
        enneagram_type: 7,
        enneagram_confidence: "low",
        enneagram_instinct: "self_preservative",
        goals: [fullGoal("g1"), fullGoal("g2"), fullGoal("g3")],
      }),
    );
    expect(profile.goals).toHaveLength(3);
    expect(bytes(profile.rundown_context)).toBeLessThanOrEqual(RUNDOWN_MAX_BYTES);
    expect(profile.rundown_context).toContain("Goal 1, the g1 project");
    expect(profile.rundown_context).toContain("Planning (the Enneagram one, not the TRC lens)");
    expectNoBareCodes(profile.rundown_context);
  });

  it("never puts a bare code in the rundown, whatever the status", () => {
    const f01 = run(argsWith({ evidence: [ev("P03", 0), ev("P03", 1), ev("P06", 2), ev("P14", 3)] })).profile;
    const f05 = run(argsWith({ evidence: [ev("P03", 0)] })).profile;
    for (const profile of [f01, f05, synthesize(samInput()).profile]) expectNoBareCodes(profile.rundown_context);
  });
});

describe("the Sam fixture", () => {
  it("gives the expected reveal, profile and Debug record", () => {
    const { profile, debug, spokenText } = synthesize(samInput());
    expect(spokenText).toBe(SAM_EXPECTED_REVEAL);
    expect(wordCount(spokenText)).toBeLessThanOrEqual(REVEAL_MAX_WORDS);
    expect(profile).toMatchObject({
      status: "partial",
      triggers: ["F04"],
      trc: "RNT",
      callsign: "Planning",
      lens: "Ni",
      tool: "Te",
      spark: "Fi",
      drain: "Se",
      jungian: "INTJ",
      socionics: "ILI",
      quadra: "Gamma",
      trc_confidence: "medium",
      socionics_confidence: "low",
      enneagram: null,
      enneagram_instinct: "undetermined",
      settle_question: null,
      how_you_work: samArguments.how_you_work,
    });
    expect(profile.in_your_words).toEqual([
      { pattern_id: "P03", words: "I could already see the shop open in spring" },
      { pattern_id: "P03", words: "I'd been seeing where that place was heading" },
      { pattern_id: "P03", words: "I'd already played out the next 5 years in my head" },
      { pattern_id: "P06", words: "I check the sales sheet every Friday" },
      { pattern_id: "P14", words: "Market days with crowds just wipe me out" },
      { pattern_id: "P07", words: "I only sell to shops I actually trust" },
    ]);
    expect(profile.goals).toEqual([
      {
        goal_id: "g1",
        goal: "Open my pottery shop",
        by_when: "by next spring",
        edge: samArguments.goals[0].strength_line,
        watch_for: samArguments.goals[0].blind_spot_line,
        moves: [
          { label: "Lean on", move: samArguments.goals[0].moves[0].move },
          { label: "Bring in", move: samArguments.goals[0].moves[1].move },
        ],
      },
      {
        goal_id: "g2",
        goal: "Run a half marathon",
        by_when: "in March",
        edge: samArguments.goals[1].strength_line,
        watch_for: samArguments.goals[1].blind_spot_line,
        moves: [{ label: "Refuel", move: samArguments.goals[1].moves[0].move }],
      },
    ]);
    expect(debug).toEqual({
      evidence_sent: 6,
      evidence_matched: 6,
      unmatched: [],
      triggers: [{ id: "F04", count: 0 }],
      replaced: [],
    });
    expect(profile.rundown_context).toContain("TRC: the Planning lens");
    expect(profile.rundown_context).toContain("Jungian: I, N, T, J (leaning).");
    expect(profile.rundown_context).toContain("Socionics: I, L, I, in the Gamma group (faint).");
    expect(profile.rundown_context).toContain("Enneagram: not called yet");
    expect(bytes(profile.rundown_context)).toBeLessThanOrEqual(RUNDOWN_MAX_BYTES);
  });

  it("matches the signed envelope: one compact line, sorted keys, the same arguments, the last turn as the trigger", () => {
    const raw = read("./fixtures/envelope.json");
    expect(raw).not.toContain("\n");
    const envelope = JSON.parse(raw) as Record<string, unknown>;
    expect(Object.keys(envelope)).toEqual(["arguments", "conversation_id", "inference_id", "name", "tool_call_id", "turn_idx"]);
    expect(envelope).toMatchObject({ name: "synthesize_profile", conversation_id: SAM_CONVERSATION_ID, inference_id: SAM_INFERENCE_ID });
    expect(samTurns[samTurns.length - 1].inference_id).toBe(SAM_INFERENCE_ID);
    expect(typeof envelope.turn_idx).toBe("number");
    expect(JSON.parse(envelope.arguments as string)).toEqual(samArguments);

    const { args, report } = parseSynthesizeArgs(envelope.arguments);
    expect(synthesize({ args, turns: samTurns, goals: samGoals, crisis: false }, report).spokenText).toBe(SAM_EXPECTED_REVEAL);
    // The production curl posts this file with a conversation Forge never stored: zero turns, so F05.
    expect(synthesize({ args, turns: [], goals: [], crisis: false }, report).spokenText).toBe(spokenF05(false));
  });
});
