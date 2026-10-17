import { byWhenLabel } from "@/lib/client/goals";
import type { Goal } from "@/lib/types";

/**
 * One chip per goal, popping in the moment save_goal fires; a changed goal pops again. After the
 * call an empty list shows nothing, since "as you say them" no longer applies.
 */
export function GoalChips({ goals, afterCall = false }: { goals: Goal[]; afterCall?: boolean }) {
  if (goals.length === 0 && afterCall) return null;
  return (
    <section aria-live="polite">
      <h2 className="type-label text-quiet">You&apos;re working toward</h2>
      {goals.length === 0 ? (
        <p className="mt-3 text-quiet">Your goals show up here as you say them.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {goals.map((goal) => {
            const when = byWhenLabel(goal.by_when);
            return (
              <li key={`${goal.goal_id}:${goal.goal}`} className="animate-pop-in rounded-full bg-surface px-4 py-2 text-ink">
                {goal.goal}
                {when && <span className="text-quiet"> · {when}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
