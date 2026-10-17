"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { CallScreen } from "@/app/components/call-screen";
import { ConsentScreen } from "@/app/components/consent-screen";
import { CVIProvider } from "@/app/components/cvi/components/cvi-provider";
import { PresenterLog } from "@/app/components/presenter-log";
import { ResultScreen } from "@/app/components/result-screen";
import { usePresenterLog } from "@/app/hooks/use-presenter-log";
import { useSessionPoll } from "@/app/hooks/use-session-poll";
import { endSession, sendEndBeacon, worthRetrying, type SessionRef } from "@/lib/client/api";
import { forgeReducer, initialForgeState, type ActiveSession, type CallEnding } from "@/lib/client/forge-state";
import { mergeGoals } from "@/lib/client/goals";
import type { Arc } from "@/lib/types";

/** After the call, the poll keeps going this long for a reading that is still landing. */
const RESULT_POLL_WINDOW_MS = 30_000;
/** One retry of the end route, this long after a failed first try. */
const END_RETRY_MS = 2000;

export interface ForgeAppProps {
  /** Chosen on the server from x-vercel-ip-country. */
  crisisLine: string;
  arc: Arc;
  askPasscode: boolean;
  presenter: boolean;
  testMode: boolean;
  clock: number;
}

/** Tells the server the call is over. The route leaves it live when Tavus could not end it, so one retry is worth it. */
async function endOnServer(session: SessionRef, log: (line: string) => void): Promise<void> {
  let reply = await endSession(session);
  if (worthRetrying(reply)) {
    await new Promise((resolve) => setTimeout(resolve, END_RETRY_MS));
    reply = await endSession(session);
  }
  log(reply.ok ? "end route: ended" : `end route failed (${reply.status || "network"})`);
}

/** The whole visit: consent, the call, the result. One reducer holds what happened; one poll reads the server's view. */
export function ForgeApp({ crisisLine, arc, askPasscode, presenter, testMode, clock }: ForgeAppProps) {
  const [state, dispatch] = useReducer(forgeReducer, initialForgeState);
  const { session, screen, ended, deleted } = state;
  const { lines, log, startClock } = usePresenterLog(presenter);

  const view = useSessionPoll(session, {
    enabled: screen !== "consent" && !deleted,
    until: ended ? ended.at + RESULT_POLL_WINDOW_MS : null,
    log,
  });
  const profile = deleted ? null : (view?.profile ?? null);
  const goals = deleted ? [] : mergeGoals(view?.goals ?? [], state.goals);
  const crisis = state.crisis || Boolean(view?.crisis);

  const start = useCallback(
    (next: ActiveSession) => {
      startClock();
      dispatch({ type: "started", session: next });
      const camera = next.voiceOnly ? "voice only" : "camera on";
      log(`call created: ${next.conversationId}, meeting token ${next.meetingToken ? "present" : "absent"}, ${camera}`);
    },
    [startClock, log],
  );

  // End, the call controls, the room closing, the crisis card and the no-show timers all land here; the first one counts.
  const endedOnce = useRef(false);
  const endCall = useCallback(
    (by: CallEnding, reason: string) => {
      if (!session || endedOnce.current) return;
      endedOnce.current = true;
      log(`call ended (${reason})`);
      void endOnServer(session, log);
      dispatch({ type: "ended", at: Date.now(), by });
    },
    [session, log],
  );

  // Closing the tab mid-call ends it too, so the minutes stop.
  useEffect(() => {
    if (screen !== "call" || !session) return;
    const onPageHide = () => {
      sendEndBeacon(session);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [screen, session]);

  return (
    <CVIProvider>
      <div className={presenter ? "pb-[34vh]" : undefined}>
        {screen === "consent" && (
          <ConsentScreen arc={arc} askPasscode={askPasscode} crisisLine={crisisLine} onStarted={start} />
        )}
        {screen === "call" && session && (
          <CallScreen
            session={session}
            goals={goals}
            profile={profile}
            crisis={crisis}
            synthesizing={state.synthesizing}
            noReading={state.noReading}
            crisisLine={crisisLine}
            testMode={testMode}
            clock={clock}
            presenter={presenter}
            dispatch={dispatch}
            onEnd={endCall}
            log={log}
          />
        )}
        {screen === "result" && session && ended && (
          <ResultScreen
            session={session}
            profile={profile}
            goals={goals}
            crisis={crisis}
            synthesizing={state.synthesizing}
            noReading={state.noReading}
            ended={ended}
            deleted={deleted}
            crisisLine={crisisLine}
            onDeleted={(tavusConfirmed) => dispatch({ type: "deleted", tavusConfirmed })}
            log={log}
          />
        )}
      </div>
      {presenter && (
        <PresenterLog
          timing={session?.timing ?? null}
          clock={clock}
          testMode={testMode}
          lines={lines}
          debug={deleted ? null : (view?.debug ?? null)}
        />
      )}
    </CVIProvider>
  );
}
