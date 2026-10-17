import { BridgeChips, hasBridge } from "@/app/components/bridge-chips";
import { GoalCard } from "@/app/components/goal-card";
import { GoalChips } from "@/app/components/goal-chips";
import type { Goal, Profile } from "@/lib/types";

/** While the call is live: the callsign, the bridge chips and the goal cards Forge walks through. */
export function LiveRundown({ profile, goals }: { profile: Profile; goals: Goal[] }) {
  return (
    <section className="animate-rise space-y-5">
      <div>
        <p className="type-label text-quiet">Your rundown</p>
        <p className="type-display mt-3 text-5xl text-ink">{profile.callsign ?? "Not called yet"}</p>
      </div>
      {hasBridge(profile) && <BridgeChips profile={profile} />}
      {profile.goals.length > 0 ? (
        profile.goals.map((goal) => <GoalCard key={goal.goal_id} goal={goal} />)
      ) : (
        <GoalChips goals={goals} />
      )}
      <p className="text-sm text-quiet">The full rundown opens when the call ends.</p>
    </section>
  );
}
