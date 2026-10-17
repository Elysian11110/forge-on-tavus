import { StatusLine } from "@/app/components/brand";
import { CrisisCard } from "@/app/components/crisis-card";
import { GoalChips } from "@/app/components/goal-chips";
import { LiveRundown } from "@/app/components/live-rundown";
import type { Goal, Profile } from "@/lib/types";

interface CallPanelProps {
  goals: Goal[];
  profile: Profile | null;
  crisis: boolean;
  synthesizing: boolean;
  noReading: boolean;
  forgeHere: boolean;
  crisisLine: string;
  onEndFromCrisisCard: () => void;
}

function statusText({ profile, noReading, synthesizing, forgeHere }: CallPanelProps): string {
  if (profile) return "Your rundown is in.";
  if (noReading) return "No reading this time. Your goals are still here.";
  if (synthesizing) return "Putting it together.";
  return forgeHere ? "Listening." : "Connecting to Forge.";
}

/** Beside the video: the status line, the goal chips, then the live rundown; or the crisis card instead of all of it. */
export function CallPanel(props: CallPanelProps) {
  const { goals, profile, crisis, noReading } = props;
  if (crisis) return <CrisisCard line={props.crisisLine} onEnd={props.onEndFromCrisisCard} />;
  return (
    <>
      <StatusLine text={statusText(props)} live={!noReading || profile !== null} />
      {profile && profile.status !== "withheld_for_safety" ? (
        <LiveRundown profile={profile} goals={goals} />
      ) : (
        <GoalChips goals={goals} />
      )}
    </>
  );
}
