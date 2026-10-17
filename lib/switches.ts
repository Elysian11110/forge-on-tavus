// The env switches and the arc table. Read at call time, never at import, so a redeploy with a
// changed variable is the whole rollout.

import type { Arc, SessionTiming } from "@/lib/types";

export interface Switches {
  /** FORGE_EU_POLICY=always adds policy eu to the create body. */
  euPolicy: boolean;
  /** FORGE_TEST_MODE=true adds test_mode: Tavus creates the call as ended and the PAL never joins. */
  testMode: boolean;
  /** FORGE_REQUIRE_AUTH=false drops require_auth; on otherwise. */
  requireAuth: boolean;
  /** FORGE_ARC=7 for the seven-minute arc; 5 otherwise. */
  arc: Arc;
}

export function readSwitches(env: NodeJS.ProcessEnv = process.env): Switches {
  const setting = (name: string) => (env[name] ?? "").trim().toLowerCase();
  return {
    euPolicy: setting("FORGE_EU_POLICY") === "always",
    testMode: setting("FORGE_TEST_MODE") === "true",
    requireAuth: setting("FORGE_REQUIRE_AUTH") !== "false",
    arc: setting("FORGE_ARC") === "7" ? 7 : 5,
  };
}

/** The arc table: the call cap Tavus gets, when the browser sends the time check, and when it gives up waiting for a reading. */
export function arcTiming(arc: Arc): SessionTiming {
  return arc === 7
    ? { arc: 7, maxCallSec: 600, timeCheckSec: 255, watchdogSec: 390 }
    : { arc: 5, maxCallSec: 300, timeCheckSec: 165, watchdogSec: 240 };
}
