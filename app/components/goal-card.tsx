import { byWhenLabel } from "@/lib/client/goals";
import type { ProfileGoal } from "@/lib/types";

/** One goal from the checked rundown: your edge, what to watch for, and one or two next moves. */
export function GoalCard({ goal }: { goal: ProfileGoal }) {
  const when = byWhenLabel(goal.by_when);
  return (
    <article className="@container frame animate-rise p-5 sm:p-7">
      <h3 className="text-2xl font-medium leading-tight tracking-[-0.02em] text-ink">{goal.goal}</h3>
      {when && <p className="type-label mt-2 text-quiet">{when}</p>}

      <dl className="mt-6 grid gap-6 @md:grid-cols-2">
        <div>
          <dt className="type-label text-quiet">Your edge</dt>
          <dd className="mt-2 text-ink-body">{goal.edge}</dd>
        </div>
        <div>
          <dt className="type-label text-quiet">Watch for</dt>
          <dd className="mt-2 text-ink-body">{goal.watch_for}</dd>
        </div>
      </dl>

      {goal.moves.length > 0 && (
        <div className="mt-6 border-t border-line pt-6">
          <p className="type-label text-quiet">Next moves</p>
          <ul className="mt-4 space-y-4">
            {goal.moves.map((move) => (
              <li key={`${move.label}:${move.move}`} className="grid gap-1.5 @md:grid-cols-[7.5rem_1fr] @md:gap-4">
                <span className="type-label pt-0.5 text-ember">{move.label}</span>
                <span className="text-ink">{move.move}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
