// The names every route, module and screen codes against: Forge's fixed lists, the records the
// store keeps, what the browser sends and gets back, and what Tavus posts to the signed route.
// Wire names stay snake_case because Tavus and the result screen read them as they are.

// Fixed lists: runtime arrays so zod and code can check against them, with the unions read off them.

export const TRC_CODES = [
  "RST", "RSF", "AST", "ASF", "RNT", "RNF", "ANT", "ANF",
  "RTS", "RTN", "ATS", "ATN", "RFS", "RFN", "AFS", "AFN",
] as const;
export type TrcCode = (typeof TRC_CODES)[number];

// The eight cognitive functions, in TRC's own order.
export const FUNCTIONS = ["Si", "Se", "Ni", "Ne", "Ti", "Te", "Fi", "Fe"] as const;
export type Fn = (typeof FUNCTIONS)[number];

// Confidence words the model may send; anything else parses to insufficient.
export const CONFIDENCES = ["high", "medium", "low", "insufficient"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

// Goal slots, filled by save_goal in the order the goals were named.
export const GOAL_IDS = ["g1", "g2", "g3"] as const;
export type GoalId = (typeof GOAL_IDS)[number];

// The patterns block of the prompt: P01 to P08 point to one function each, P09 and P10 to the
// frame mode, P11 to P13 to the Enneagram, P14 to the spark and drain.
export const PATTERN_IDS = [
  "P01", "P02", "P03", "P04", "P05", "P06", "P07",
  "P08", "P09", "P10", "P11", "P12", "P13", "P14",
] as const;
export type PatternId = (typeof PATTERN_IDS)[number];

// Enneagram instincts; anything else parses to undetermined.
export const INSTINCTS = ["self_preservative", "social", "sexual", "undetermined"] as const;
export type Instinct = (typeof INSTINCTS)[number];

// What a goal's strength line may stand on: the lens, the tool, or an observed pattern.
export const STRENGTH_ANCHORS = [
  "lens", "tool", "P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08", "P09", "P10",
] as const;
export type StrengthAnchor = (typeof STRENGTH_ANCHORS)[number];

// What a goal's watch-for line may stand on.
export const BLIND_SPOT_ANCHORS = ["drain", "enneagram_trap", "P14"] as const;
export type BlindSpotAnchor = (typeof BLIND_SPOT_ANCHORS)[number];

// Move kinds; the card shows them as Lean on, Guard, Refuel and Bring in.
export const MOVE_KINDS = ["lean_on", "guard", "refuel", "bring_in"] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];

// Refusals: F05 no type at all, F01 no TRC row (so no Jungian or Socionics either), F04 no Enneagram.
export const TRIGGER_IDS = ["F01", "F04", "F05"] as const;
export type TriggerId = (typeof TRIGGER_IDS)[number];

export type ProfileStatus = "complete" | "partial" | "insufficient" | "withheld_for_safety";

// Call length in minutes, from FORGE_ARC; 5 unless it says 7.
export type Arc = 5 | 7;

// Daily app messages from Tavus, read with useObservableEvent<T>.

// Who spoke; "replica" is the legacy duplicate of "pal" and is ignored everywhere.
export type Role = "user" | "pal" | "replica";

// Fields every Tavus broadcast may carry: seq orders events, turn_idx groups one turn.
export interface TavusEventMeta {
  message_type?: string;
  conversation_id?: string;
  seq?: number;
  turn_idx?: number;
  timestamp?: number;
}

// conversation.tool_call: arguments is a JSON string, and tool_call_id can be missing.
export type ToolCall = TavusEventMeta & {
  event_type: "conversation.tool_call";
  inference_id?: string;
  properties: { name: string; arguments: string; tool_call_id?: string };
};

// conversation.utterance: Raven's notes ride on user turns only.
export type Utterance = TavusEventMeta & {
  event_type: "conversation.utterance";
  inference_id?: string;
  properties: { role: Role; speech: string; user_audio_analysis?: string; user_visual_analysis?: string };
};

// conversation.started_speaking: the first one from the pal sets T0.
export type Speaking = TavusEventMeta & {
  event_type: "conversation.started_speaking";
  inference_id?: string;
  properties: { role: Role };
};

// The crisis guardrail's app message; its event name is undocumented, so it is matched on properties.
export type Guardrail = TavusEventMeta & {
  event_type?: string;
  properties: { guardrail: "crisis_self_harm"; reason?: string };
};

// What the store keeps for one call.

// One goal, exactly the save_goal arguments.
export interface Goal {
  goal_id: GoalId;
  goal: string;
  by_when: string;
  user_quote: string;
}

// One relayed user turn, text only; n counts from 1 in arrival order.
export interface UserTurn {
  n: number;
  speech: string;
  inference_id: string | null;
}

export interface EnneagramLabels {
  triad: string;
  fixation: string;
  passion: string;
  trap: string;
}

// The person's own words from one turn, and the pattern they point to.
export interface EvidenceQuote {
  pattern_id: string;
  words: string;
}

export interface ProfileMove {
  label: string;
  move: string;
}

export interface ProfileGoal {
  goal_id: string;
  goal: string;
  by_when: string;
  edge: string;
  watch_for: string;
  moves: ProfileMove[];
}

/** The checked reading: every field here came from code or from matched words, never straight from the model. */
export interface Profile {
  status: ProfileStatus;
  triggers: TriggerId[];
  trc: TrcCode | null;
  callsign: string | null;
  lens: Fn | null;
  tool: Fn | null;
  spark: Fn | null;
  drain: Fn | null;
  jungian: string | null;
  socionics: string | null;
  quadra: string | null;
  /** The Jungian row shows this one too, since the Jungian code is read off the TRC row. */
  trc_confidence: Confidence;
  socionics_confidence: Confidence;
  enneagram: number | null;
  enneagram_labels: EnneagramLabels | null;
  enneagram_instinct: string;
  enneagram_confidence: Confidence;
  in_your_words: EvidenceQuote[];
  how_you_work: string;
  goals: ProfileGoal[];
  /** F01 only: the hunch-bank question for the likeliest lens. */
  settle_question: string | null;
  /** At most 60 words; Tavus speaks it word for word. */
  spoken_reveal: string;
  /** At most 1,500 bytes with every code spelled out; the browser appends it to the call once. */
  rundown_context: string;
}

/** The per-call record behind the presenter log and the model choice. */
export interface Debug {
  evidence_sent: number;
  evidence_matched: number;
  /** key_words that matched no stored user turn. */
  unmatched: string[];
  triggers: { id: TriggerId; count: number }[];
  /** Field paths whose model line was replaced or dropped, each with its reason in brackets. */
  replaced: string[];
}

// What the browser's poll gets.
export interface SessionView {
  state: "live" | "ended";
  crisis: boolean;
  goals: Goal[];
  profile: Profile | null;
  debug: Debug | null;
}

// synthesize_profile: the parsed arguments, then the pure function's input and output.

export interface EvidenceArg {
  pattern_id: PatternId;
  key_words: string;
}

export interface MoveArg {
  kind: MoveKind;
  move: string;
}

export interface GoalArg {
  goal_id: GoalId;
  goal_short: string;
  strength_anchor: StrengthAnchor;
  strength_line: string;
  blind_spot_anchor: BlindSpotAnchor;
  blind_spot_line: string;
  moves: MoveArg[];
}

// The arguments after parsing: fallbacks applied, unknown items dropped, strings kept at full length
// so an over-cap line fails the lint instead of being cut.
export interface SynthesizeArgs {
  trc_code: TrcCode | "none";
  trc_confidence: Confidence;
  evidence: EvidenceArg[];
  socionics_confidence: Confidence;
  /** 0 means not called; 1 to 9 otherwise. */
  enneagram_type: number;
  enneagram_instinct: Instinct;
  enneagram_confidence: Confidence;
  how_you_work: string;
  goals: GoalArg[];
}

// Input to synthesize(): the parsed arguments plus what the store holds for the call.
export interface SynthInput {
  args: SynthesizeArgs;
  /** Empty for a conversation the store does not know, which refuses with F05. */
  turns: UserTurn[];
  goals: Goal[];
  /** Set by the guardrail relay; the reading is then withheld. */
  crisis: boolean;
}

// Output of synthesize(): what to store, and the exact text Tavus speaks.
export interface SynthResult {
  profile: Profile;
  debug: Debug;
  spokenText: string;
}

// Routes.

// The session token on browser routes.
export const SESSION_HEADER = "x-forge-session";
// The store backend, on the synthesize route's reply.
export const STORE_HEADER = "x-forge-store";
// Tavus's hex HMAC-SHA256 of the raw request body.
export const SIGNATURE_HEADER = "x-tavus-signature";

export type StoreKind = "upstash" | "memory";

// 400 bad_request or consent_required, 401 passcode, 403 forbidden, 404 not_found, 409 call_live,
// 429 too_many_tries, 502 tavus, 503 store_unavailable or not_configured.
export type ApiErrorCode =
  | "bad_request"
  | "consent_required"
  | "passcode"
  | "too_many_tries"
  | "forbidden"
  | "not_found"
  | "call_live"
  | "tavus"
  | "store_unavailable"
  | "not_configured";

export interface ApiError {
  error: ApiErrorCode;
}

// POST /api/session
export interface CreateSessionRequest {
  consent: boolean;
  firstName?: string;
  passcode?: string;
}

// Browser timings for the arc, in seconds from T0, plus the call cap sent to Tavus.
export interface SessionTiming {
  arc: Arc;
  /** max_call_duration: 300 on the 5-minute arc, 600 on 7. */
  maxCallSec: number;
  /** When the time-check note goes to Forge: 165 (2:45) or 255 (4:15). */
  timeCheckSec: number;
  /** When "No reading this time" shows if nothing arrived: 240 (4:00) or 390 (6:30). */
  watchdogSec: number;
}

// POST /api/session 200; meetingToken is null when require_auth is off.
export interface CreateSessionResponse {
  conversationId: string;
  conversationUrl: string;
  meetingToken: string | null;
  sessionToken: string;
  timing: SessionTiming;
}

// GET /api/session?c= 200, with the x-forge-session header on the request.
export type GetSessionResponse = SessionView;

// POST /api/events, kind goal: the save_goal arguments plus the tool_call_id that dedupes a repeat.
export type GoalEventData = Goal & { tool_call_id: string | null };

// POST /api/events, kind user_turn: text only.
export interface UserTurnEventData {
  speech: string;
  inference_id: string | null;
}

// POST /api/events, kind crisis.
export interface CrisisEventData {
  reason: string | null;
}

export type ForgeEventKind = "goal" | "user_turn" | "crisis";

// POST /api/events, with the x-forge-session header.
export type EventsRequest =
  | { conversationId: string; kind: "goal"; data: GoalEventData }
  | { conversationId: string; kind: "user_turn"; data: UserTurnEventData }
  | { conversationId: string; kind: "crisis"; data: CrisisEventData };

// POST /api/events 200, also for a repeat the store already had.
export interface EventsResponse {
  ok: true;
}

// POST /api/tools/synthesize-profile, from Tavus, keys sorted; arguments is the model's JSON string.
export interface SynthesizeEnvelope {
  arguments: string;
  conversation_id: string;
  inference_id: string;
  name: string;
  tool_call_id: string;
  turn_idx: number;
}

// POST /api/session/end; the token rides in the body so the tab-close beacon can send it.
export interface EndSessionRequest {
  conversationId: string;
  sessionToken: string;
}

// POST /api/session/end 200; ending twice is fine.
export interface EndSessionResponse {
  ended: true;
}

// POST /api/session/delete, the same body as end.
export type DeleteSessionRequest = EndSessionRequest;

// POST /api/session/delete 200; tavusStatus is the HTTP status of the hard delete, null if Tavus
// could not be reached. Forge's keys are gone either way; the token stays until Tavus confirms, so
// the same request can be sent again.
export interface DeleteSessionResponse {
  deleted: true;
  tavusStatus: number | null;
}
