"use client";

import { useCallback, useEffect, useRef, type Dispatch } from "react";
import { useMeetingState } from "@daily-co/daily-react";
import { AiChip } from "@/app/components/brand";
import { CallPanel } from "@/app/components/call-panel";
import { VideoStage } from "@/app/components/video-stage";
import { useAppendContext } from "@/app/hooks/use-append-context";
import { useCallClock } from "@/app/hooks/use-call-clock";
import { useForgeInRoom } from "@/app/hooks/use-forge-in-room";
import { useRelay } from "@/app/hooks/use-relay";
import { useTavusEvents } from "@/app/hooks/use-tavus-events";
import type { ActiveSession, CallEnding, ForgeAction } from "@/lib/client/forge-state";
import type { Goal, Profile } from "@/lib/types";

interface CallScreenProps {
  session: ActiveSession;
  /** Goals so far, live app messages merged with the store. */
  goals: Goal[];
  /** The checked reading, once the poll has it. */
  profile: Profile | null;
  crisis: boolean;
  synthesizing: boolean;
  noReading: boolean;
  crisisLine: string;
  /** The call was created as ended: nothing to join, fixtures instead. */
  testMode: boolean;
  clock: number;
  presenter: boolean;
  dispatch: Dispatch<ForgeAction>;
  onEnd: (by: CallEnding, reason: string) => void;
  log: (line: string) => void;
}

export function CallScreen(props: CallScreenProps) {
  const { session, goals, profile, crisis, synthesizing, noReading, testMode, dispatch, onEnd, log } = props;
  const { conversationId } = session;
  const meetingState = useMeetingState();
  const live = !testMode && meetingState === "joined-meeting";

  // Facts the timers and handlers read at the moment they fire.
  const now = useRef({ crisis, profile, synthesizing });
  useEffect(() => {
    now.current = { crisis, profile, synthesizing };
  });

  const { relay, relayCrisis } = useRelay(session, log);
  const { joinedAt, forgeHere } = useForgeInRoom(testMode, onEnd, log);
  const sendContext = useAppendContext(conversationId, live);
  const { markPalSpeaking } = useCallClock({
    timing: session.timing,
    clock: props.clock,
    joinedAt,
    sendContext,
    shouldNudge: () => !now.current.crisis && !now.current.profile && !now.current.synthesizing,
    hasReading: () => now.current.profile !== null,
    isSynthesizing: () => now.current.synthesizing,
    onWatchdog: () => dispatch({ type: "watchdog" }),
    log,
  });

  const crisisRelayed = useRef(false);
  const handleEvent = useTavusEvents({
    onGoal: (goal, toolCallId) => {
      dispatch({ type: "goal", goal });
      relay({ conversationId, kind: "goal", data: { ...goal, tool_call_id: toolCallId } });
    },
    onUserTurn: (speech, inferenceId) => {
      // After a crisis no reading is made, so nothing more of what they say is kept.
      if (now.current.crisis) return;
      relay({ conversationId, kind: "user_turn", data: { speech, inference_id: inferenceId } });
    },
    onCrisis: (reason) => {
      dispatch({ type: "crisis" });
      if (crisisRelayed.current) return;
      crisisRelayed.current = true;
      void relayCrisis(reason);
    },
    onPalSpeaking: markPalSpeaking,
    onSynthesizing: () => {
      if (!now.current.synthesizing) log("Forge is putting it together");
      dispatch({ type: "synthesizing" });
    },
    onRaw: (event) => log(`event ${JSON.stringify(event)}`),
  });

  // Once the reading is in, hand Forge the checked rundown, once, to walk through.
  const rundownSent = useRef(false);
  useEffect(() => {
    if (!profile || rundownSent.current || crisis) return;
    if (profile.status === "withheld_for_safety" || !profile.rundown_context) return;
    if (!testMode && !live) return;
    rundownSent.current = true;
    const sent = sendContext(profile.rundown_context);
    log(`${sent ? "rundown sent" : "rundown not sent (no live room)"}: ${profile.rundown_context}`);
  }, [profile, crisis, live, testMode, sendContext, log]);

  // The leave button in the call controls. Conversation calls this on a room error too; the room watch ends that one.
  const leaveFromControls = useCallback(() => {
    if (meetingState === "error") return;
    onEnd("person", "left from the call controls");
  }, [meetingState, onEnd]);

  return (
    <main className="forge-night min-h-dvh">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:py-8">
        <header className="flex items-center justify-between gap-4">
          <AiChip />
          <button
            type="button"
            onClick={() => onEnd("person", "End call button")}
            className="h-10 rounded-btn-sm border border-line px-4 text-ink transition-colors duration-150 hover:border-forge-ember hover:text-forge-ember"
          >
            End call
          </button>
        </header>

        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
          <VideoStage
            session={session}
            testMode={testMode}
            presenter={props.presenter}
            onEvent={handleEvent}
            onLeave={leaveFromControls}
            log={log}
          />
          {/* On a phone the crisis card moves above the video, so it is never below the fold. */}
          <aside aria-label="Your goals and rundown" className={`space-y-8 ${crisis ? "order-first lg:order-none" : ""}`}>
            <CallPanel
              goals={goals}
              profile={profile}
              crisis={crisis}
              synthesizing={synthesizing}
              noReading={noReading}
              forgeHere={forgeHere}
              crisisLine={props.crisisLine}
              onEndFromCrisisCard={() => onEnd("person", "crisis card")}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
