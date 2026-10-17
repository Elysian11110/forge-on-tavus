import { headers } from "next/headers";
import { ForgeApp } from "@/app/components/forge-app";
import { crisisLineFor } from "@/lib/safety";
import { readSwitches } from "@/lib/switches";

/** ?clock=10 runs the call timers ten times faster; honored only in test mode, never on a real call. */
function readClock(raw: string | string[] | undefined, testMode: boolean): number {
  if (!testMode || typeof raw !== "string") return 1;
  const speed = Number(raw);
  return Number.isFinite(speed) && speed >= 1 && speed <= 60 ? speed : 1;
}

// Server-side on purpose: the crisis line comes from the visitor's country header, the arc and test
// mode from env, and the passcode field shows whenever DEMO_PASSCODE is set (its value never leaves).
export default async function Page(props: PageProps<"/">) {
  const [requestHeaders, query] = await Promise.all([headers(), props.searchParams]);
  const switches = readSwitches();

  return (
    <ForgeApp
      crisisLine={crisisLineFor(requestHeaders.get("x-vercel-ip-country"))}
      arc={switches.arc}
      askPasscode={Boolean(process.env.DEMO_PASSCODE)}
      presenter={query.presenter === "1"}
      testMode={switches.testMode}
      clock={readClock(query.clock, switches.testMode)}
    />
  );
}
