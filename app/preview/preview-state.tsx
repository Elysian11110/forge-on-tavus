"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CallLayout } from "@/app/components/call-screen";
import { CallPanel } from "@/app/components/call-panel";
import { Landing } from "@/app/components/consent-screen";
import { ConnectingState } from "@/app/components/cvi/components/conversation-status";
import { CVIProvider } from "@/app/components/cvi/components/cvi-provider";
import { CameraSelectBtn, MicSelectBtn } from "@/app/components/cvi/components/device-select";
import styles from "@/app/components/cvi/components/conversation/conversation.module.css";
import { DeleteMyDataView } from "@/app/components/delete-my-data";
import { PresenterLog } from "@/app/components/presenter-log";
import { Rundown } from "@/app/components/rundown";
import { ResultLayout, ResultScreen } from "@/app/components/result-screen";
import { TestModeStage } from "@/app/components/test-mode-stage";
import { failureText, MIC_PROBLEM_TEXT, SayHiView, type SayHiViewProps } from "@/app/components/say-hi-form";
import { arcTiming } from "@/lib/switches";
import type { Debug, Profile } from "@/lib/types";
import { samGoals } from "@/tests/fixtures/sam";

const CRISIS_LINE = "Samaritans, 116 123, free, any time";
const SESSION = { conversationId: "c_preview", sessionToken: "preview" };
const nothing = () => {};

type Profiles = { called: Profile; refused: Profile; tooFew: Profile };

function form(overrides: Partial<SayHiViewProps>): ReactNode {
  return (
    <Landing arc={5}>
      <SayHiView
        showPasscode
        firstName=""
        passcode=""
        consent={false}
        phase="idle"
        ready={false}
        problem={null}
        onFirstName={nothing}
        onPasscode={nothing}
        onConsent={nothing}
        onSubmit={(event) => event.preventDefault()}
        {...overrides}
      />
    </Landing>
  );
}

const filled: Partial<SayHiViewProps> = { firstName: "Sam", passcode: "forge-demo", consent: true };

/** The CVI block's own frame and controls around a stand-in face, since a real one needs a paid room. */
function Stage({ forgeHere, voiceOnly = false }: { forgeHere: boolean; voiceOnly?: boolean }) {
  return (
    <section aria-label="Video call" className="frame min-w-0 self-start">
      <div className={styles.containerWrapper}>
        <div className={styles.container}>
          <div className={styles.videoContainer}>
            <div className={styles.mainVideoContainer}>
              {forgeHere ? (
                <div className="flex size-full items-center justify-center bg-[radial-gradient(60%_70%_at_50%_45%,#2a2a31,#0d0d11)]">
                  <span className="type-label text-quiet">Forge&apos;s face</span>
                </div>
              ) : (
                <ConnectingState />
              )}
            </div>
            {!voiceOnly && (
              <div className={styles.selfViewContainer}>
                <div className={`${styles.previewVideoContainer} bg-[linear-gradient(160deg,#3a3c41,#131318)]`} />
              </div>
            )}
          </div>
          <div className={styles.footer}>
            <div className={styles.footerControls}>
              <MicSelectBtn />
              <CameraSelectBtn />
              <button type="button" className={styles.leaveButton} aria-label="Leave Call">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface CallProps {
  forgeHere?: boolean;
  voiceOnly?: boolean;
  goals?: typeof samGoals;
  profile?: Profile | null;
  crisis?: boolean;
  synthesizing?: boolean;
  noReading?: boolean;
}

function call({ forgeHere = true, voiceOnly = false, goals = samGoals, profile = null, crisis = false, synthesizing = false, noReading = false }: CallProps) {
  return (
    <CallLayout
      voiceOnly={voiceOnly}
      crisis={crisis}
      onEnd={nothing}
      stage={<Stage forgeHere={forgeHere} voiceOnly={voiceOnly} />}
      panel={
        <CallPanel
          goals={goals}
          profile={profile}
          crisis={crisis}
          synthesizing={synthesizing}
          noReading={noReading}
          forgeHere={forgeHere}
          crisisLine={CRISIS_LINE}
          onEndFromCrisisCard={nothing}
        />
      }
    />
  );
}

function result(overrides: Partial<Parameters<typeof ResultScreen>[0]>) {
  return (
    <ResultScreen
      session={SESSION}
      profile={null}
      goals={samGoals}
      crisis={false}
      synthesizing={false}
      noReading={false}
      ended={{ at: Date.now(), by: "forge" }}
      deleted={null}
      crisisLine={CRISIS_LINE}
      onDeleted={nothing}
      log={nothing}
      {...overrides}
    />
  );
}

const PRESENTER_LINES = [
  "   +0.0s  call created: c_preview, meeting token present, camera on",
  "   +2.4s  joined the room",
  "   +6.1s  Forge is in the room as tavus-replica",
  "  +41.8s  event save_goal g1 Open my pottery shop",
  " +165.0s  time check sent: about 3 minutes in",
  " +171.2s  Forge is putting it together",
  " +176.9s  rundown sent",
];

function states(profiles: Profiles, debug: Debug): Record<string, () => ReactNode> {
  return {
    landing: () => form({}),
    "landing-ready": () => form({ ...filled, ready: true }),
    checking: () => form({ ...filled, phase: "checking" }),
    calling: () => form({ ...filled, phase: "calling" }),
    "error-mic": () => form({ ...filled, ready: true, problem: MIC_PROBLEM_TEXT.blocked }),
    "error-failed": () => form({ ...filled, ready: true, problem: failureText({ ok: false, status: 502, error: "tavus" }) }),
    "error-live": () => form({ ...filled, ready: true, problem: failureText({ ok: false, status: 409, error: "call_live" }) }),
    joining: () => call({ forgeHere: false, goals: [] }),
    call: () => call({}),
    "call-voice": () => call({ voiceOnly: true, goals: samGoals.slice(0, 1) }),
    "test-mode": () => (
      <CallLayout
        voiceOnly={false}
        crisis={false}
        onEnd={nothing}
        stage={
          <section aria-label="Video call" className="frame min-w-0 self-start">
            <TestModeStage presenter onEvent={nothing} log={nothing} />
          </section>
        }
        panel={<CallPanel goals={[]} profile={null} crisis={false} synthesizing={false} noReading={false} forgeHere crisisLine={CRISIS_LINE} onEndFromCrisisCard={nothing} />}
      />
    ),
    synthesizing: () => call({ synthesizing: true }),
    "call-rundown": () => call({ profile: profiles.called }),
    "call-no-reading": () => call({ noReading: true }),
    crisis: () => call({ crisis: true }),
    waiting: () => result({ synthesizing: true }),
    result: () => result({ profile: profiles.called }),
    "result-refused": () => result({ profile: profiles.refused }),
    "result-too-few": () => result({ profile: profiles.tooFew }),
    "no-reading": () => result({ noReading: true }),
    "never-connected": () => result({ ended: { at: Date.now(), by: "never_connected" } }),
    "crisis-result": () => result({ crisis: true }),
    "delete-confirm": () => (
      <ResultLayout
        body={<Rundown profile={profiles.called} />}
        actions={<DeleteMyDataView deletion={{ kind: "confirming" }} onAsk={nothing} onCancel={nothing} onDelete={nothing} />}
      />
    ),
    deleted: () => result({ deleted: { tavusConfirmed: true } }),
    presenter: () => (
      <>
        <div className="pb-[44vh] lg:pb-[32vh]">{call({ synthesizing: true })}</div>
        <PresenterLog timing={arcTiming(5)} clock={1} testMode={false} lines={PRESENTER_LINES} debug={debug} />
      </>
    ),
  };
}

export function PreviewState({ state, profiles, debug }: { state: string; profiles: Profiles; debug: Debug }) {
  // Client only, as the real call screens are: the CVI status grid is random per load, so a server render would never match.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const all = states(profiles, debug);
  if (!mounted) return null;
  const render = all[state];
  if (!render) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="stamp">Preview</p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {Object.keys(all).map((name) => (
            <li key={name}>
              <a href={`/preview?state=${name}`} className="text-ink underline decoration-rule underline-offset-4">
                {name}
              </a>
            </li>
          ))}
        </ul>
      </main>
    );
  }
  return <CVIProvider>{render()}</CVIProvider>;
}
