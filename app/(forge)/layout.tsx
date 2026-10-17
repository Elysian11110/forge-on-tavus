import { headers } from "next/headers";
import type { ReactNode } from "react";
import { ForgeApp } from "@/app/components/forge-app";
import { crisisLineFor } from "@/lib/safety";
import { readSwitches } from "@/lib/switches";

// Server-side on purpose: the crisis line comes from the visitor's country header and the arc from env.
// The app sits in the layout so it stays mounted while /homepage, /veronica-talks and /report swap.
export default async function ForgeLayout({ children }: Readonly<{ children: ReactNode }>) {
  const requestHeaders = await headers();
  return (
    <>
      <ForgeApp crisisLine={crisisLineFor(requestHeaders.get("x-vercel-ip-country"))} arc={readSwitches().arc} />
      {children}
    </>
  );
}
