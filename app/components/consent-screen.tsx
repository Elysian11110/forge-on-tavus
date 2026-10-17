import type { ReactNode } from "react";
import { Wordmark } from "@/app/components/brand";
import { SayHiForm } from "@/app/components/say-hi-form";
import type { ActiveSession } from "@/lib/client/forge-state";
import type { Arc } from "@/lib/types";

/** The landing as it looks: the mark, one headline, one subline, and the form beside it. */
export function Landing({ arc, children }: { arc: Arc; children: ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div aria-hidden className="grid-faint pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-6 sm:px-8 lg:px-12">
        <Wordmark />

        <div className="grid flex-1 grid-cols-[minmax(0,1fr)] content-center gap-10 py-8 sm:gap-12 sm:py-12 lg:grid-cols-12 lg:items-center lg:gap-8 lg:py-16">
          <div className="lg:col-span-7">
            <h1 className="type-hero text-[length:clamp(3.5rem,12vw,8rem)] text-ink">
              <span className="block">Let&apos;s figure</span>
              <span className="type-outline block">out how you</span>
              <span className="type-heat block">work.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-quiet sm:mt-10">
              {arc === 7 ? "Seven" : "Five"} minutes on video with a friend who knows way too much about
              personality types. Tell a few stories, leave with your type and a next move for each goal.
            </p>
          </div>

          <div className="lg:col-span-5">{children}</div>
        </div>
      </div>
    </main>
  );
}

interface ConsentScreenProps {
  arc: Arc;
  askPasscode: boolean;
  onStarted: (session: ActiveSession) => void;
}

export function ConsentScreen({ arc, askPasscode, onStarted }: ConsentScreenProps) {
  return (
    <Landing arc={arc}>
      <SayHiForm askPasscode={askPasscode} onStarted={onStarted} />
    </Landing>
  );
}
