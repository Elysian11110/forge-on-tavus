"use client";

import { useEffect, useState, type ReactNode } from "react";
import { StatusLine, Wordmark } from "@/app/components/brand";
import { CrisisCard } from "@/app/components/crisis-card";
import { FullReport } from "@/app/components/full-report";
import { GoalChips } from "@/app/components/goal-chips";
import { NoReading } from "@/app/components/no-reading";
import { GoalCard } from "@/app/components/goal-card";
import type { ReportBuild } from "@/app/hooks/use-full-report";
import type { CallEnding } from "@/lib/client/forge-state";
import type { Goal, Profile } from "@/lib/types";

/** How long to wait for a reading after the call ends: longer if Veronica had started putting it together. */
const WAIT_IF_SYNTHESIZING_MS = 30_000;
const WAIT_OTHERWISE_MS = 8_000;

interface ResultScreenProps {
  profile: Profile | null;
  goals: Goal[];
  crisis: boolean;
  synthesizing: boolean;
  noReading: boolean;
  ended: { at: number; by: CallEnding };
  crisisLine: string;
  report: ReportBuild;
  onRetryReport: () => void;
}

/** What the page shows under the report: the goal cards, the honest no-reading note, or the crisis card. */
function resultBody(props: ResultScreenProps, waitOver: boolean): ReactNode {
  const { profile, goals, crisis, synthesizing, noReading, ended } = props;
  if (crisis || profile?.status === "withheld_for_safety") return <CrisisCard line={props.crisisLine} />;
  if (profile) {
    // Under F05 the profile has no goal cards, yet Veronica just said the goals are on screen: list them.
    if (profile.goals.length === 0) return goals.length > 0 ? <GoalChips goals={goals} afterCall /> : null;
    return (
      <section>
        <h2 className="stamp">For your goals</h2>
        <div className="mt-6 space-y-5">
          {profile.goals.map((goal) => (
            <GoalCard key={goal.goal_id} goal={goal} />
          ))}
        </div>
      </section>
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

/** The result page as it looks: the mark, the full report, the quick read, and the quiet action under it. */
function ResultLayout({ report, body, actions }: { report: ReactNode; body: ReactNode; actions: ReactNode }) {
  return (
    <main className="min-h-dvh">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8">
        <Wordmark />
        {report && <div className="mt-12 sm:mt-16">{report}</div>}
        <div className="mt-16 sm:mt-24">{body}</div>
        <div className="mt-24 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-line pt-8 pb-10">{actions}</div>
      </div>
    </main>
  );
}

export function ResultScreen(props: ResultScreenProps) {
  const { synthesizing, ended, crisis, profile } = props;
  const [waitOver, setWaitOver] = useState(false);

  // A reading can still land after the call ends, so the honest no-reading note waits a little first.
  useEffect(() => {
    const wait = synthesizing ? WAIT_IF_SYNTHESIZING_MS : WAIT_OTHERWISE_MS;
    const timer = setTimeout(() => setWaitOver(true), Math.max(0, ended.at + wait - Date.now()));
    return () => clearTimeout(timer);
  }, [ended.at, synthesizing]);

  return (
    <ResultLayout
      report={!crisis && profile && profile.status !== "withheld_for_safety" ? <FullReport build={props.report} onRetry={props.onRetryReport} /> : null}
      body={resultBody(props, waitOver)}
      actions={
        <>
          {!crisis && (
            <button type="button" onClick={() => window.location.assign("/homepage")} className="line-btn">
              Talk again
            </button>
          )}
        </>
      }
    />
  );
}
