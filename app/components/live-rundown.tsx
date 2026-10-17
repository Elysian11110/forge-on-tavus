import { BridgeChips, hasBridge } from "@/app/components/bridge-chips";
import { GoalCard } from "@/app/components/goal-card";
import { GoalChips } from "@/app/components/goal-chips";
import type { Goal, Profile } from "@/lib/types";

/** While the call is live: the callsign, the bridge chips and the goal cards Veronica walks through. */
export function LiveRundown({ profile, goals }: { profile: Profile; goals: Goal[] }) {
  return (
    <section className="animate-rise space-y-6">
      <div>
        <p className="stamp">Your rundown</p>
        <p className="type-hero mt-4 text-6xl text-ink">{profile.callsign ?? "Not called yet"}</p>
      </div>
      {hasBridge(profile) && <BridgeChips profile={profile} />}
      {profile.goals.length > 0 ? (
        <div className="space-y-4">
          {profile.goals.map((goal) => (
            <GoalCard key={goal.goal_id} goal={goal} />
          ))}
        </div>
      ) : (
        <GoalChips goals={goals} />
      )}
    </section>
  );
}
