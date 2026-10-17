// The env switches and the arc table. Read at call time, never at import, so a redeploy with a
// changed variable is the whole rollout.

import type { Arc, SessionTiming } from "@/lib/types";

export interface Switches {
  /** FORGE_EU_POLICY=always adds policy eu to the create body. */
  euPolicy: boolean;
  /** FORGE_REQUIRE_AUTH=false drops require_auth; on otherwise. */
  requireAuth: boolean;
  /** FORGE_ARC=5 for the free trial's five-minute speed round; an open call otherwise. */
  arc: Arc;
}

export function readSwitches(env: NodeJS.ProcessEnv = process.env): Switches {
  const setting = (name: string) => (env[name] ?? "").trim().toLowerCase();
  return {
    euPolicy: setting("FORGE_EU_POLICY") === "always",
    requireAuth: setting("FORGE_REQUIRE_AUTH") !== "false",
    arc: setting("FORGE_ARC") === "5" ? 5 : 30,
  };
}

/** The arc table: the call cap Tavus gets, when the browser sends the time check, when it gives up waiting for a reading, and when it tells Veronica to say bye. */
export function arcTiming(arc: Arc): SessionTiming {
  return arc === 5
    ? { arc: 5, maxCallSec: 300, timeCheckSec: 195, watchdogSec: 255, wrapUpSec: 265 }
    : { arc: 30, maxCallSec: 1800, timeCheckSec: 1620, watchdogSec: 1710, wrapUpSec: 1760 };
}
