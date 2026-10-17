// The Sam call: a five-minute run with two goals and four stories that point to the Planning lens
// (RNT: lens Ni, tool Te). The turns are the user's relayed utterances as Tavus transcribed them;
// the arguments are what the model sends to synthesize_profile. No thought pattern came back
// twice, so the Enneagram is not called (F04). tests/fixtures/envelope.json carries the same
// arguments inside the signed envelope.

import type { Goal, SynthInput, SynthesizeArgs, UserTurn } from "@/lib/types";

export const SAM_CONVERSATION_ID = "c_forge_fixture_sam";
export const SAM_TOOL_CALL_ID = "call_forge_fixture_sam_1";
/** The envelope's inference_id: the user turn that triggered the call, Sam's last one. */
export const SAM_INFERENCE_ID = "inf_sam_10";

/** The user's turns in arrival order; turn 9 says "5", the model quotes it as "five". */
export const samTurns: UserTurn[] = [
  "Honestly? I want to open my own pottery shop. Like a real one, with a storefront, by next spring.",
  "Oh, and I'm training for a half marathon in March. That's the other big one.",
  "Last Sunday I sat down with a notebook, and I could already see the shop open in spring. The shelves, the window, all of it. So I worked backwards from there.",
  "Quitting my agency job. I'd been seeing where that place was heading for about a year, and it wasn't anywhere I wanted to be.",
  "I mean, I check the sales sheet every Friday. If the numbers say a glaze isn't selling, it's gone. I don't really argue with the numbers.",
  "Ha, yeah, pretty much.",
  "A long solo walk on Sunday morning, no phone. That actually recharges me.",
  "Market days with crowds just wipe me out. Everyone talking at once, people grabbing things. I'm done by noon.",
  "Where it's heading, for sure. I'd already played out the next 5 years in my head before I said yes to anything.",
  "And I only sell to shops I actually trust. If it doesn't feel right with the owner, I walk away.",
].map((speech, index) => ({ n: index + 1, speech, inference_id: `inf_sam_${String(index + 1).padStart(2, "0")}` }));

/** The two save_goal calls, as the store holds them. */
export const samGoals: Goal[] = [
  {
    goal_id: "g1",
    goal: "Open my pottery shop",
    by_when: "by next spring",
    user_quote: "I want to open my own pottery shop. Like a real one, with a storefront, by next spring.",
  },
  {
    goal_id: "g2",
    goal: "Run a half marathon",
    by_when: "in March",
    user_quote: "I'm training for a half marathon in March.",
  },
];

/** What the model sends to synthesize_profile at the rundown stage. */
export const samArguments: SynthesizeArgs = {
  trc_code: "RNT",
  trc_confidence: "medium",
  evidence: [
    { pattern_id: "P03", key_words: "I could already see the shop open in spring" },
    { pattern_id: "P03", key_words: "I'd been seeing where that place was heading" },
    { pattern_id: "P03", key_words: "I'd already played out the next five years in my head" },
    { pattern_id: "P06", key_words: "I check the sales sheet every Friday" },
    { pattern_id: "P14", key_words: "market days with crowds just wipe me out" },
    { pattern_id: "P07", key_words: "I only sell to shops I actually trust" },
  ],
  socionics_confidence: "low",
  enneagram_type: 0,
  enneagram_instinct: "undetermined",
  enneagram_confidence: "insufficient",
  how_you_work:
    "You see where something is heading long before it gets there, like picturing the shop open by spring. Then you make it real by going with what works, like checking your sales every Friday.",
  goals: [
    {
      goal_id: "g1",
      goal_short: "the pottery shop",
      strength_anchor: "lens",
      strength_line: "You can already see opening day, which keeps every small step pointed the same way.",
      blind_spot_anchor: "drain",
      blind_spot_line: "Crowded, in-the-moment days cost you the most energy, so they can sink a whole week.",
      moves: [
        { kind: "lean_on", move: "Write down what opening day looks like, then list three steps back from it." },
        { kind: "bring_in", move: "Ask the friend who loves the market crowd to run the stall with you on day one." },
      ],
    },
    {
      goal_id: "g2",
      goal_short: "the half marathon",
      strength_anchor: "tool",
      strength_line: "You trust what the numbers show, so a plan you can check every week will keep you honest.",
      blind_spot_anchor: "drain",
      blind_spot_line: "Race-day noise and crowds are your expensive zone, so plan the morning in detail.",
      moves: [{ kind: "refuel", move: "Keep your Sunday solo walk; you said that is what actually recharges you." }],
    },
  ],
};

/** The words Tavus speaks for Sam: the called template around the checked how_you_work. */
export const SAM_EXPECTED_REVEAL =
  "Okay, here's what I'm seeing. You see where something is heading long before it gets there, like picturing the shop open by spring. Then you make it real by going with what works, like checking your sales every Friday. That's the Planning lens. What fits, and what doesn't?";

/** The synthesize input the route builds for Sam from the store. */
export function samInput(overrides: Partial<SynthInput> = {}): SynthInput {
  return { args: samArguments, turns: samTurns, goals: samGoals, crisis: false, ...overrides };
}
