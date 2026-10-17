import { headers } from "next/headers";
import { ForgeApp } from "@/app/components/forge-app";
import { crisisLineFor } from "@/lib/safety";
import { readSwitches } from "@/lib/switches";

// Server-side on purpose: the crisis line comes from the visitor's country header and the arc from env.
export default async function Page() {
  const requestHeaders = await headers();
  return <ForgeApp crisisLine={crisisLineFor(requestHeaders.get("x-vercel-ip-country"))} arc={readSwitches().arc} />;
}
