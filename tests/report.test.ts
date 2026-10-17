// The full report agrees with the screen: the link the route hands back carries the Jungian,
// Socionics and Enneagram the person was told on the call, their goals lead the bullets, their own
// words fill the cards, and the engine's lines survive only where they contradict none of it. The
// engine fixture reads another type on purpose, which is the bug this file pins down.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/report/route";
import { contradicts, enginePhase, pinReport, readingLine, calledType } from "@/lib/report/compose";
import { FORGE_SITE, decodeReport, encodedFromUrl, reportUrl, type SiteReport } from "@/lib/report/site";
import { getStore } from "@/lib/store";
import type { Debug, Goal, Profile } from "@/lib/types";
import { SESSION_HEADER } from "@/lib/types";

const CALL = "c_forge_fixture_report";
const TOKEN = "session-token-for-the-report-test";

/** The goals as save_goal stored them. */
const goals: Goal[] = [
  { goal_id: "g1", goal: "Pay off the flat early.", by_when: "in ten years", user_quote: "I want the flat paid off in ten years, then I'm free." },
  { goal_id: "g2", goal: "Run the shop floor myself", by_when: "not said", user_quote: "I want to run the floor myself." },
];

/** Enough of their own words for the extractor, none of them anyone's real call. */
const turns = [
  "Honestly I just go with what's in front of me right now. If the queue is out the door I move, I don't plan it.",
  "Something breaks, I fix the leak first and work out why later, as long as it holds I'm happy.",
  "It has to make sense to me, I'll redo the whole rota until the logic holds together properly.",
  "The thing that keeps coming back is this urge to get everything exactly right, I can't leave a crooked shelf.",
  "What drains me is mess I can't fix right then, I end up pacing around the stock room.",
];

/** The screen's reading for this call: the Experiment lens, ESTP, SLE in Beta, Enneagram 1, self-preservation. */
const profile: Profile = {
  status: "complete",
  triggers: [],
  trc: "AST",
  callsign: "Experiment",
  lens: "Se",
  tool: "Ti",
  spark: "Fe",
  drain: "Ni",
  jungian: "ESTP",
  socionics: "SLE",
  quadra: "Beta",
  trc_confidence: "medium",
  socionics_confidence: "medium",
  enneagram: 1,
  enneagram_labels: { triad: "gut", fixation: "Resentment", passion: "Anger", trap: "Perfection" },
  enneagram_instinct: "self_preservative",
  enneagram_confidence: "medium",
  in_your_words: [
    { pattern_id: "P02", words: "go with what's in front of me right now" },
    { pattern_id: "P06", words: "fix the leak first" },
    { pattern_id: "P05", words: "It has to make sense to me" },
    { pattern_id: "P11", words: "get everything exactly right" },
    { pattern_id: "P14", words: "mess I can't fix right then" },
  ],
  how_you_work: "You act on what is in front of you right now, and you make it real by making sure it holds together by your own logic.",
  goals: [
    {
      goal_id: "g1",
      goal: "Pay off the flat early.",
      by_when: "in ten years",
      edge: "Moving the second something is in front of you is your edge here.",
      watch_for: "Mess you can't fix right then costs you the most, so plan around it.",
      moves: [{ label: "Lean on", move: "Pick one bill this week and clear it the day it lands." }],
    },
    {
      goal_id: "g2",
      goal: "Run the shop floor myself",
      by_when: "not said",
      edge: "",
      watch_for: "",
      moves: [],
    },
  ],
  settle_question: null,
  spoken_reveal: "Okay, here's what I'm seeing.",
  rundown_context: "Checked rundown from Forge's server.",
};

const debug: Debug = { evidence_sent: 5, evidence_matched: 5, unmatched: [], triggers: [], replaced: [] };

/** What the site's engine sent back for the same words on the last real call: another type entirely. */
const engine: SiteReport = {
  headline: "Fix it fast, understand why, then never repeat it",
  summary: "You lead with Te and build the system before anyone asks for it.",
  summaryBullets: [
    "You patch the leak, then trace it to the source, and the cost is that some problems have no source.",
    "Classic ENTJ: you move faster than the room and call it efficiency.",
    "Stagnation is unbearable to you, so a ten hour day beats standing still.",
  ],
  method: "phases",
  systems: {
    mbti: {
      code: "ENTJ",
      detail: "Te > Ni > Se > Fi",
      verdict: "You lead with external logic and long-range architecture.",
      evidence: [{ moment: "You fix the leak first and trace the cause after", signal: "dominant Te" }],
      watchFor: "You will build the right structure around the wrong people, until you let inferior Fi speak.",
      justification: "Te first, Ni behind it.",
    },
    socionics: {
      code: "LIE",
      detail: "Gamma quadra / Base Te",
      verdict: "Base Te runs the show.",
      evidence: [{ moment: "You measure by what works", signal: "Base Te" }],
      watchFor: "Vulnerable Fi, until you ask how it landed.",
      justification: "Gamma values.",
    },
    enneagram: {
      code: "8w7",
      detail: "triad: gut",
      tritype: "837",
      instinctStack: "so/sp/sx",
      verdict: "You run toward total autonomy.",
      evidence: [{ moment: "You refuse any structure that puts someone above you", signal: "core 8 (gut)" }],
      watchFor: "You will bulldoze, until you let someone else hold the wheel.",
      justification: "Gut core, head wing.",
    },
    temperaments: { code: "Choleric", detail: "Choleric-Melancholic", verdict: "Fast and driven.", justification: "Speed over comfort." },
    moralAlignment: { code: "Chaotic Good", detail: "The Rebel", verdict: "Rules are optional when they slow the right outcome.", justification: "Outcome over order." },
    attitudinalPsyche: { code: "LFVE", detail: "1st Logic / 3rd Will", verdict: "Logic first.", justification: "Logic leads." },
    bigFive: { code: "O-High C-High E-Mod A-Low N-Low", detail: "Curious and disciplined", verdict: "Steady under load.", justification: "Low N." },
  },
};

/** The engine reading the same type as the screen, wing and all. */
const agreeingEngine: SiteReport = {
  ...engine,
  systems: {
    ...engine.systems,
    mbti: { ...engine.systems.mbti, code: "ESTP", detail: "Se > Ti > Fe > Ni", verdict: "You move first and explain later.", evidence: [{ moment: "You move when the queue is out the door", signal: "dominant Se" }] },
    socionics: { ...engine.systems.socionics, code: "SLE", detail: "Beta quadra / Base Se", verdict: "Base Se, creative Ti." },
    enneagram: { ...engine.systems.enneagram, code: "1w9", tritype: "137", instinctStack: "sp/so/sx", verdict: "You cannot leave a crooked shelf." },
  },
};

function everyLine(report: SiteReport): string[] {
  const lines = [report.headline, report.summary, ...(report.summaryBullets ?? [])];
  for (const system of Object.values(report.systems)) {
    lines.push(system.code, system.detail ?? "", system.verdict ?? "", system.watchFor ?? "", system.justification, ...(system.bullets ?? []));
    for (const row of system.evidence ?? []) lines.push(row.moment, row.signal);
  }
  return lines;
}

describe("pinReport", () => {
  const report = pinReport(engine, profile, goals);

  it("carries the Jungian, Socionics and Enneagram the screen showed, not the engine's", () => {
    expect(report.systems.mbti).toMatchObject({ code: "ESTP", detail: "Se > Ti > Fe > Ni" });
    expect(report.systems.socionics).toMatchObject({ code: "SLE", detail: "Beta quadra / Base Se" });
    expect(report.systems.enneagram).toMatchObject({ code: "1", detail: "triad: gut", tritype: "137", instinctStack: "sp/so/sx" });
  });

  it("keeps none of the engine's lines that name the other type, its functions, quadra or core", () => {
    const text = everyLine(report).join("\n");
    expect(text).not.toMatch(/\bENTJ\b/);
    expect(text).not.toMatch(/\bLIE\b/);
    expect(text).not.toMatch(/\bGamma\b/);
    expect(text).not.toMatch(/\bTe\b/);
    expect(text).not.toMatch(/\b8w7\b|\bcore 8\b/);
    // The headline names nothing, so it stands; the summary named Te, so the screen's line replaces it.
    expect(report.headline).toBe(engine.headline);
    expect(report.summary).toBe(profile.how_you_work);
  });

  it("leads the bullets with the goals, each with its edge and first move, then the engine's clean bullets", () => {
    expect(report.summaryBullets?.[0]).toBe(
      "Working toward: Pay off the flat early, in ten years. Moving the second something is in front of you is your edge here. Lean on: Pick one bill this week and clear it the day it lands.",
    );
    expect(report.summaryBullets?.[1]).toBe("Working toward: Run the shop floor myself. In your words: I want to run the floor myself.");
    expect(report.summaryBullets?.slice(2)).toEqual([engine.summaryBullets![0], engine.summaryBullets![2]]);
  });

  it("fills the pinned cards with the person's own words pointed at their place in the stack", () => {
    expect(report.systems.mbti.verdict).toBe(profile.how_you_work);
    expect(report.systems.mbti.evidence).toEqual([
      { moment: "You said: go with what's in front of me right now", signal: "dominant Se: being all in on the moment" },
      { moment: "You said: fix the leak first", signal: "going by what works" },
      { moment: "You said: It has to make sense to me", signal: "auxiliary Ti: making it make sense to you" },
      { moment: "You said: mess I can't fix right then", signal: "inferior Ni: what drains you, what refuels you" },
    ]);
    expect(report.systems.mbti.watchFor).toBe(profile.goals[0].watch_for);
    expect(report.systems.socionics.evidence?.[0]).toEqual({ moment: "You said: go with what's in front of me right now", signal: "base Se: being all in on the moment" });
    expect(report.systems.enneagram.evidence).toEqual([{ moment: "You said: get everything exactly right", signal: "1 (gut): a thought that keeps coming back" }]);
    expect(report.systems.enneagram.verdict).toBe("The thought loop is Resentment, the drive behind it is Anger, and the trap is Perfection.");
  });

  it("leaves the four systems the screen never calls as the engine wrote them", () => {
    for (const key of ["temperaments", "moralAlignment", "attitudinalPsyche", "bigFive"] as const) {
      expect(report.systems[key]).toEqual(engine.systems[key]);
    }
  });

  it("keeps the engine's own lines and wing when it read the same type", () => {
    const same = pinReport(agreeingEngine, profile, goals);
    expect(same.systems.mbti).toMatchObject({ code: "ESTP", verdict: "You move first and explain later." });
    expect(same.systems.mbti.evidence).toEqual(agreeingEngine.systems.mbti.evidence);
    expect(same.systems.socionics.verdict).toBe("Base Se, creative Ti.");
    expect(same.systems.enneagram).toMatchObject({ code: "1w9", tritype: "137", instinctStack: "sp/so/sx", verdict: "You cannot leave a crooked shelf." });
    expect(same.summaryBullets).toContain(engine.summaryBullets![0]);
    expect(same.summaryBullets).not.toContain(engine.summaryBullets![1]);
  });

  it("lets the engine's reading stand when no type was called, and still leads with the goals", () => {
    const open = pinReport(engine, null, goals);
    expect(open.systems.mbti.code).toBe("ENTJ");
    expect(open.systems.enneagram.code).toBe("8w7");
    expect(open.summaryBullets?.[0]).toBe("Working toward: Pay off the flat early, in ten years. In your words: I want the flat paid off in ten years, then I'm free.");

    const f01: Profile = { ...profile, status: "partial", triggers: ["F01"], trc: null, callsign: null, lens: null, tool: null, spark: null, drain: null, jungian: null, socionics: null, quadra: null };
    const partial = pinReport(engine, f01, goals);
    expect(partial.systems.mbti.code).toBe("ENTJ");
    expect(partial.systems.enneagram).toMatchObject({ code: "1", tritype: "137" });
    // No Jungian type was called, so the engine's own stands, bullets included; only the Enneagram is pinned.
    expect(partial.summaryBullets).toContain(engine.summaryBullets![1]);
    expect(everyLine(partial).join("\n")).not.toMatch(/\b8w7\b|\bcore 8\b/);
  });

  it("survives the site's own decode with the screen's codes intact", () => {
    const encoded = encodedFromUrl(reportUrl(report));
    expect(encoded).not.toBeNull();
    const decoded = decodeReport(encoded!);
    expect(decoded?.systems.mbti.code).toBe("ESTP");
    expect(decoded?.systems.socionics.code).toBe("SLE");
    expect(decoded?.systems.enneagram.code).toBe("1");
    expect(decoded?.summaryBullets?.[0]).toMatch(/^Working toward: Pay off the flat early/);
    expect(decodeReport("not-a-report")).toBeNull();
  });

  it("names a contradiction only against what was called", () => {
    const called = calledType(profile);
    const agreed = { jungian: true, socionics: true, enneagram: true };
    const disagreed = { jungian: false, socionics: false, enneagram: false };
    expect(contradicts("You lead with Se", called, agreed)).toBe(false);
    expect(contradicts("You lead with Se", called, disagreed)).toBe(true);
    expect(contradicts("An INTJ would plan it", called, agreed)).toBe(true);
    expect(contradicts("1w9 with a 3 (heart) second", called, agreed)).toBe(false);
    expect(contradicts("type 8 energy", called, agreed)).toBe(true);
    expect(contradicts("Anything at all", calledType(null), disagreed)).toBe(false);
  });
});

describe("enginePhase", () => {
  it("hands the engine the reading from the call, the goals and the person's own words beside the extracted phase", () => {
    const phase = enginePhase({ phaseName: "The shop years", moments: [] }, { turns: turns.map((speech, index) => ({ n: index + 1, speech, inference_id: null })), goals, crisis: false, profile });
    expect(phase.phaseName).toBe("The shop years");
    expect(phase.forgeCall).toMatchObject({
      readingOnTheCall: readingLine(calledType(profile)),
      goals: goals.map(({ goal, by_when, user_quote }) => ({ goal, by_when, user_quote })),
      ownWords: turns,
    });
    expect(readingLine(calledType(profile))).toBe(
      "Jungian ESTP (Se > Ti > Fe > Ni), Socionics SLE in the Beta quadra, Enneagram 1 (self-preservation): read live on the call from these words, so every system must agree with it.",
    );
    expect(readingLine(calledType(null))).toMatch(/^No type was called/);
  });
});

describe("POST /api/report", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

  function engineAnswers(score: unknown = { result: engine }) {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === `${FORGE_SITE}/api/enneagram-extract`) return Response.json({ extracted: { phaseName: "The shop years" } });
      if (url === `${FORGE_SITE}/api/unified-score`) return Response.json(score);
      throw new Error(`unexpected fetch ${url}`);
    });
  }

  function post(token: string | null = TOKEN): Promise<Response> {
    const headers = new Headers({ "content-type": "application/json" });
    if (token) headers.set(SESSION_HEADER, token);
    return POST(new Request("http://localhost/api/report", { method: "POST", headers, body: JSON.stringify({ conversationId: CALL }) }));
  }

  async function seed(withProfile: Profile | null = profile): Promise<void> {
    const store = getStore();
    await store.createSession(CALL, TOKEN);
    for (const goal of goals) await store.addGoal(CALL, goal, null);
    for (const speech of turns) await store.addUserTurn(CALL, speech, null);
    if (withProfile) await store.setProfile(CALL, withProfile, debug);
  }

  beforeAll(() => {
    for (const name of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "VERCEL"]) vi.stubEnv(name, "");
    vi.stubGlobal("fetch", fetchMock);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    quiet.mockRestore();
  });

  beforeEach(async () => {
    fetchMock.mockReset();
    await getStore().deleteSession(CALL);
  });

  afterEach(() => {
    quiet.mockClear();
  });

  it("answers a link whose report carries the screen's type and goals, and sends the engine the reading, goals and words", async () => {
    await seed();
    engineAnswers();
    const reply = await post();
    expect(reply.status).toBe(200);
    const { url } = (await reply.json()) as { url: string };
    const decoded = decodeReport(encodedFromUrl(url)!);
    expect(decoded?.systems.mbti.code).toBe("ESTP");
    expect(decoded?.systems.socionics.code).toBe("SLE");
    expect(decoded?.systems.enneagram.code).toBe("1");
    expect(decoded?.summaryBullets?.[0]).toMatch(/^Working toward: Pay off the flat early, in ten years\./);
    expect(everyLine(decoded!).join("\n")).not.toMatch(/\bENTJ\b|\bLIE\b|\b8w7\b/);

    const scoreCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/api/unified-score"));
    const sent = JSON.parse(String(scoreCall?.[1]?.body)) as { method: string; phases: Record<string, unknown>[] };
    expect(sent.method).toBe("phases");
    expect(sent.phases[0].phaseName).toBe("The shop years");
    expect(sent.phases[0].forgeCall).toMatchObject({
      readingOnTheCall: expect.stringContaining("Jungian ESTP"),
      goals: goals.map(({ goal, by_when, user_quote }) => ({ goal, by_when, user_quote })),
      ownWords: turns,
    });
    expect(await getStore().getReportUrl(CALL)).toBe(url);
  });

  it("hands back the link already built without calling the engine again", async () => {
    await seed();
    engineAnswers();
    const first = ((await (await post()).json()) as { url: string }).url;
    fetchMock.mockClear();
    const again = await post();
    expect(((await again.json()) as { url: string }).url).toBe(first);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives 422 with no reading on the screen, or when there wasn't enough to go on", async () => {
    await seed(null);
    expect((await post()).status).toBe(422);
    await getStore().deleteSession(CALL);
    await seed({ ...profile, status: "insufficient", triggers: ["F05"], trc: null, jungian: null, socionics: null, enneagram: null });
    expect((await post()).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the crisis, token and engine-failure answers", async () => {
    await seed();
    expect((await post(null)).status).toBe(403);
    expect((await post("another-token")).status).toBe(403);
    engineAnswers({ error: "Could not parse result" });
    expect((await post()).status).toBe(502);
    await getStore().setCrisis(CALL);
    expect((await post()).status).toBe(403);
  });
});
