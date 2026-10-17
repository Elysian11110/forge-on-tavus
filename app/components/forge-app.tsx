"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { CallScreen } from "@/app/components/call-screen";
import { ConsentScreen } from "@/app/components/consent-screen";
import { CVIProvider } from "@/app/components/cvi/components/cvi-provider";
import { ResultScreen } from "@/app/components/result-screen";
import { useFullReport } from "@/app/hooks/use-full-report";
import { useSessionPoll } from "@/app/hooks/use-session-poll";
import { endSession, sendEndBeacon, worthRetrying, type SessionRef } from "@/lib/client/api";
import { forgeReducer, initialForgeState, type ActiveSession, type CallEnding, type Screen } from "@/lib/client/forge-state";
import { mergeGoals } from "@/lib/client/goals";
import type { Arc } from "@/lib/types";

/** After the call, the poll keeps going this long for a reading that is still landing. */
const RESULT_POLL_WINDOW_MS = 30_000;
/** One retry of the end route, this long after a failed first try. */
const END_RETRY_MS = 2000;

/** Each screen has its own address, so the URL says where you are. */
const SCREEN_PATHS: Record<Screen, { path: string; title: string }> = {
  consent: { path: "/homepage", title: "Forge" },
  call: { path: "/veronica-talks", title: "Talking with Veronica · Forge" },
  result: { path: "/report", title: "Your report · Forge" },
};

export interface ForgeAppProps {
  /** Chosen on the server from x-vercel-ip-country. */
  crisisLine: string;
  arc: Arc;
}

/** Tells the server the call is over. The route leaves it live when Tavus could not end it, so one retry is worth it. */
async function endOnServer(session: SessionRef): Promise<void> {
  const reply = await endSession(session);
  if (!worthRetrying(reply)) return;
  await new Promise((resolve) => setTimeout(resolve, END_RETRY_MS));
  await endSession(session);
}

/** The whole visit: the landing, the call, the result. One reducer holds what happened; one poll reads the server's view. */
export function ForgeApp({ crisisLine, arc }: ForgeAppProps) {
  const [state, dispatch] = useReducer(forgeReducer, initialForgeState);
  const { session, screen, ended } = state;

  const view = useSessionPoll(session, {
    enabled: screen !== "consent",
    until: ended ? ended.at + RESULT_POLL_WINDOW_MS : null,
  });
  const profile = view?.profile ?? null;
  const goals = mergeGoals(view?.goals ?? [], state.goals);
  const crisis = state.crisis || Boolean(view?.crisis);
  // The full report starts as soon as a reading exists, so it is mostly built by the time the call ends.
  const readingReady = !crisis && (profile?.status === "complete" || profile?.status === "partial");
  const report = useFullReport(session, readingReady);

  const start = useCallback((next: ActiveSession) => dispatch({ type: "started", session: next }), []);

  // End, the call controls, the room closing, the crisis card and the no-show timers all land here; the first one counts.
  const endedOnce = useRef(false);
  const endCall = useCallback(
    (by: CallEnding) => {
      if (!session || endedOnce.current) return;
      endedOnce.current = true;
      void endOnServer(session);
      dispatch({ type: "ended", at: Date.now(), by });
    },
    [session],
  );

  // The screen lives in this one component, so the address follows it instead of the other way
  // round: a fresh load of /report or /veronica-talks starts at the landing and says /homepage.
  useEffect(() => {
    const { path, title } = SCREEN_PATHS[screen];
    if (window.location.pathname !== path) window.history.replaceState(null, "", path);
    document.title = title;
  }, [screen]);

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
      {screen === "consent" && <ConsentScreen arc={arc} onStarted={start} />}
      {screen === "call" && session && (
        <CallScreen
          session={session}
          goals={goals}
          profile={profile}
          crisis={crisis}
          synthesizing={state.synthesizing}
          noReading={state.noReading}
          crisisLine={crisisLine}
          dispatch={dispatch}
          onEnd={endCall}
        />
      )}
      {screen === "result" && session && ended && (
        <ResultScreen
          profile={profile}
          goals={goals}
          crisis={crisis}
          synthesizing={state.synthesizing}
          noReading={state.noReading}
          ended={ended}
          crisisLine={crisisLine}
          report={report.build}
          onRetryReport={report.retry}
        />
      )}
    </CVIProvider>
  );
}
