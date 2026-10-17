"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AllGone } from "@/app/components/all-gone";
import { StatusLine, Wordmark } from "@/app/components/brand";
import { CrisisCard } from "@/app/components/crisis-card";
import { DeleteMyData } from "@/app/components/delete-my-data";
import { GoalChips } from "@/app/components/goal-chips";
import { NoReading } from "@/app/components/no-reading";
import { Rundown } from "@/app/components/rundown";
import type { SessionRef } from "@/lib/client/api";
import type { CallEnding } from "@/lib/client/forge-state";
import type { Goal, Profile } from "@/lib/types";

/** How long to wait for a reading after the call ends: longer if Veronica had started putting it together. */
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
}

/** What the page shows: the rundown, the honest no-reading note, the crisis card, or the all-gone note. */
function resultBody(props: ResultScreenProps, waitOver: boolean): ReactNode {
  const { profile, goals, crisis, synthesizing, noReading, ended, deleted } = props;
  if (deleted) return <AllGone tavusConfirmed={deleted.tavusConfirmed} />;
  if (crisis || profile?.status === "withheld_for_safety") return <CrisisCard line={props.crisisLine} />;
  if (profile) {
    // Under F05 the profile has no goal cards, yet Veronica just said the goals are on screen: list them.
    return (
      <>
        <Rundown profile={profile} />
        {profile.goals.length === 0 && goals.length > 0 && (
          <div className="mt-20">
            <GoalChips goals={goals} afterCall />
          </div>
        )}
      </>
    );
  }
  if (ended.by === "never_connected" || noReading || waitOver) return <NoReading goals={goals} endedBy={ended.by} />;
  return (
    <div className="space-y-14">
      <StatusLine text={synthesizing ? "Putting it together." : "Checking for your rundown."} />
      <GoalChips goals={goals} afterCall />
    </div>
  );
}

/** The result page as it looks: the mark, the body, and the two quiet actions under it. */
function ResultLayout({ body, actions }: { body: ReactNode; actions: ReactNode }) {
  return (
    <main className="min-h-dvh">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8">
        <Wordmark />
        <div className="mt-16 sm:mt-24">{body}</div>
        <div className="mt-24 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-line pt-8 pb-10">{actions}</div>
      </div>
    </main>
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
    <ResultLayout
      body={resultBody(props, waitOver)}
      actions={
        <>
          {!crisis && (
            <button type="button" onClick={() => window.location.reload()} className="line-btn">
              Talk again
            </button>
          )}
          {!deleted && <DeleteMyData session={props.session} onDeleted={props.onDeleted} />}
        </>
      }
    />
  );
}
