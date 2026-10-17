"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AllGone } from "@/app/components/all-gone";
import { StatusLine, TrcCredit, Wordmark } from "@/app/components/brand";
import { CrisisCard, CrisisLine } from "@/app/components/crisis-card";
import { DeleteMyData } from "@/app/components/delete-my-data";
import { GoalChips } from "@/app/components/goal-chips";
import { NoReading } from "@/app/components/no-reading";
import { Rundown } from "@/app/components/rundown";
import type { SessionRef } from "@/lib/client/api";
import type { CallEnding } from "@/lib/client/forge-state";
import type { Goal, Profile } from "@/lib/types";

const RESULT_FOOTER = "For getting to know yourself, not a test. Not a stand-in for a professional.";

/** How long to wait for a reading after the call ends: longer if Forge had started putting it together. */
const WAIT_IF_SYNTHESIZING_MS = 30_000;
const WAIT_OTHERWISE_MS = 8_000;

interface ResultScreenProps {
  session: SessionRef;
  profile: Profile | null;
  goals: Goal[];
  crisis: boolean;
  synthesizing: boolean;
  noReading: boolean;
  ended: { at: number; by: CallEnding };
  deleted: { tavusConfirmed: boolean } | null;
  crisisLine: string;
  onDeleted: (tavusConfirmed: boolean) => void;
  log: (line: string) => void;
}

/** What the page shows: the rundown, the honest no-reading note, the crisis card, or the all-gone note. */
function resultBody(props: ResultScreenProps, waitOver: boolean): ReactNode {
  const { profile, goals, crisis, synthesizing, noReading, ended, deleted } = props;
  if (deleted) return <AllGone tavusConfirmed={deleted.tavusConfirmed} />;
  if (crisis || profile?.status === "withheld_for_safety") return <CrisisCard line={props.crisisLine} />;
  if (profile) {
    // Under F05 the profile has no goal cards, yet Forge just said the goals are on screen: list them.
    return (
      <>
        <Rundown profile={profile} />
        {profile.goals.length === 0 && goals.length > 0 && (
          <div className="mt-16">
            <GoalChips goals={goals} afterCall />
          </div>
        )}
      </>
    );
  }
  if (ended.by === "never_connected" || noReading || waitOver) return <NoReading goals={goals} endedBy={ended.by} />;
  return (
    <div className="space-y-10">
      <StatusLine text={synthesizing ? "Putting it together." : "Checking for your rundown."} />
      <GoalChips goals={goals} afterCall />
    </div>
  );
}

export function ResultScreen(props: ResultScreenProps) {
  const { synthesizing, ended, deleted, crisis } = props;
  const [waitOver, setWaitOver] = useState(false);

  // A reading can still land after the call ends, so the honest no-reading note waits a little first.
  useEffect(() => {
    const wait = synthesizing ? WAIT_IF_SYNTHESIZING_MS : WAIT_OTHERWISE_MS;
    const timer = setTimeout(() => setWaitOver(true), Math.max(0, ended.at + wait - Date.now()));
    return () => clearTimeout(timer);
  }, [ended.at, synthesizing]);

  return (
    <main className="forge-day min-h-dvh">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Wordmark />
        <div className="mt-14">{resultBody(props, waitOver)}</div>

        <footer className="mt-20 border-t border-line pt-8">
          <p className="text-ink-body">
            {RESULT_FOOTER} If things are heavy, talk to a person: <CrisisLine line={props.crisisLine} />.
          </p>
          <p className="mt-3 max-w-prose text-sm text-quiet">
            <TrcCredit />
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            {!deleted && <DeleteMyData session={props.session} onDeleted={props.onDeleted} log={props.log} />}
            {!crisis && (
              <button type="button" onClick={() => window.location.reload()} className="text-ink underline underline-offset-4">
                Talk again
              </button>
            )}
          </div>
        </footer>
      </div>
    </main>
  );
}
