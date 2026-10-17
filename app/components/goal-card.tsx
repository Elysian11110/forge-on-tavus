import { byWhenLabel } from "@/lib/client/goals";
import type { ProfileGoal } from "@/lib/types";

/** One goal from the checked rundown: your edge, what to watch for, and one or two next moves. */
export function GoalCard({ goal }: { goal: ProfileGoal }) {
  const when = byWhenLabel(goal.by_when);
  return (
    <article className="@container animate-rise rounded-(--card-radius) border border-line bg-surface p-5 sm:p-6">
      <h3 className="font-display text-2xl leading-tight text-ink">{goal.goal}</h3>
      {when && <p className="type-label mt-2 text-quiet">{when}</p>}

      <dl className="mt-5 grid gap-5 @md:grid-cols-2">
        <div>
          <dt className="type-label text-quiet">Your edge</dt>
          <dd className="mt-1.5 text-ink-body">{goal.edge}</dd>
        </div>
        <div>
          <dt className="type-label text-quiet">Watch for</dt>
          <dd className="mt-1.5 text-ink-body">{goal.watch_for}</dd>
        </div>
      </dl>

      {goal.moves.length > 0 && (
        <div className="mt-5 border-t border-line pt-5">
          <p className="type-label text-quiet">Next moves</p>
          <ul className="mt-3 space-y-3">
            {goal.moves.map((move) => (
              <li key={`${move.label}:${move.move}`} className="grid gap-1 @md:grid-cols-[7rem_1fr] @md:gap-4">
                <span className="type-label pt-1 text-accent-ink">{move.label}</span>
                <span className="text-ink-body">{move.move}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
