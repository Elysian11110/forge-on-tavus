// Sample Tavus app messages for test mode, where the call is created as ended and nobody joins.
// Replaying them runs the real event handler, so the chips, the presenter log and the relays to
// the store can be checked without spending a minute. Shapes follow the documented events.

const base = { message_type: "conversation", conversation_id: "replay" } as const;

let seq = 0;
const meta = (turn: number) => ({ ...base, seq: ++seq, turn_idx: turn, timestamp: Date.now() / 1000 });

function palSpeaks(turn: number, speech: string) {
  return [
    { ...meta(turn), event_type: "conversation.started_speaking", inference_id: `pal-${turn}`, properties: { role: "pal" } },
    { ...meta(turn), event_type: "conversation.utterance", inference_id: `pal-${turn}`, properties: { role: "pal", speech } },
  ];
}

function userSays(turn: number, speech: string, audio: string, visual: string) {
  return {
    ...meta(turn),
    event_type: "conversation.utterance",
    inference_id: `user-${turn}`,
    properties: { role: "user", speech, user_audio_analysis: audio, user_visual_analysis: visual },
  };
}

/** One goal, three stories and the filler line, in call order. */
export function fixtureEvents(): unknown[] {
  seq = 0;
  return [
    ...palSpeaks(1, "Hey, I'm Forge! First things first: what are you working toward right now?"),
    userSays(
      2,
      "I want to open my own pottery shop by spring, that's the big one.",
      "Speaks at a steady pace.",
      "Looks at the camera and smiles.",
    ),
    {
      ...meta(2),
      event_type: "conversation.tool_call",
      inference_id: "user-2",
      properties: {
        name: "save_goal",
        tool_call_id: "replay-goal-1",
        arguments: JSON.stringify({
          goal_id: "g1",
          goal: "Open my pottery shop",
          by_when: "by spring",
          user_quote: "I want to open my own pottery shop by spring",
        }),
      },
    },
    userSays(
      3,
      "Last month I mapped out the whole first year on one big sheet before I told anyone.",
      "Pauses for a few seconds before answering.",
      "Looks away from the camera before answering.",
    ),
    userSays(
      4,
      "Running the Saturday workshop, honestly, I could do that every week, it fills me right up.",
      "Voice gets faster and more animated talking about the workshop.",
      "Becomes more animated, hands moving.",
    ),
    userSays(
      5,
      "Last-minute changes from other people wipe me out, I need to see where it's all going.",
      "Voice drops in energy describing last-minute changes.",
      "Face tightens slightly.",
    ),
    ...palSpeaks(6, "Give me a sec, I'm putting it all together."),
  ];
}
