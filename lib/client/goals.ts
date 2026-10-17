// Goals in the browser: reading save_goal arguments, merging them with what the server stored,
// and the "by when" label. The server validates everything again; this only feeds the screen.

import { GOAL_IDS, type Goal, type GoalId } from "@/lib/types";

const isGoalId = (value: unknown): value is GoalId => GOAL_IDS.includes(value as GoalId);

/** save_goal arguments arrive as a JSON string (sometimes an object); null when they are unusable. */
export function parseGoalArgs(raw: unknown): Goal | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const args = value as Record<string, unknown>;
  if (!isGoalId(args.goal_id) || typeof args.goal !== "string" || !args.goal.trim()) return null;
  return {
    goal_id: args.goal_id,
    goal: args.goal,
    by_when: typeof args.by_when === "string" ? args.by_when : "not said",
    user_quote: typeof args.user_quote === "string" ? args.user_quote : "",
  };
}

/** One goal per slot, g1 to g3; the live app message wins over the stored copy, since it is newer. */
export function mergeGoals(stored: Goal[], live: Goal[]): Goal[] {
  const bySlot = new Map<GoalId, Goal>();
  for (const goal of stored) bySlot.set(goal.goal_id, goal);
  for (const goal of live) bySlot.set(goal.goal_id, goal);
  return GOAL_IDS.flatMap((id) => bySlot.get(id) ?? []);
}

/** "by spring" stays; "not said" and blanks show nothing. */
export function byWhenLabel(byWhen: string): string {
  const text = byWhen.trim();
  return text && text.toLowerCase() !== "not said" ? text : "";
}
