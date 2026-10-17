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
    <section className="space-y-14">
      <div>
        <h1 className="type-hero text-[length:clamp(3.25rem,11vw,6.5rem)] text-ink">
          <span className="block">No reading</span>
          <span className="type-outline block">this time.</span>
        </h1>
        <p className="mt-8 max-w-prose text-lg text-ink-body">
          {WHY_NO_READING[endedBy]}
          {goals.length > 0 && " Your goals are kept below."}
        </p>
      </div>
      <GoalChips goals={goals} afterCall />
    </section>
  );
}
