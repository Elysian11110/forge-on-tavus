import { GoalChips } from "@/app/components/goal-chips";
import type { CallEnding } from "@/lib/client/forge-state";
import type { Goal } from "@/lib/types";

/** Why there is no reading, by who ended the call. */
const WHY_NO_READING: Record<CallEnding, string> = {
  forge: "I didn't get enough to call it, and I won't guess.",
  person: "We stopped before I had enough to go on, so I won't guess.",
  never_connected: "The call didn't connect, so there's nothing to read. Give it a minute and try again.",
};

/** The watchdog fired, the call never connected, or it ended without a reading: goals kept, nothing guessed. */
export function NoReading({ goals, endedBy }: { goals: Goal[]; endedBy: CallEnding }) {
  return (
    <section className="space-y-10">
      <div>
        <h1 className="type-display text-[length:clamp(2.75rem,9vw,5rem)] text-ink">No reading this time</h1>
        <p className="mt-5 max-w-prose text-lg text-ink-body">
          {WHY_NO_READING[endedBy]}
          {goals.length > 0 && " Your goals are kept below."}
        </p>
      </div>
      <GoalChips goals={goals} afterCall />
    </section>
  );
}
