import { Wordmark } from "@/app/components/brand";
import { CrisisLine } from "@/app/components/crisis-card";
import { SayHiForm } from "@/app/components/say-hi-form";
import type { ActiveSession } from "@/lib/client/forge-state";
import { corpus } from "@/lib/synth/corpus";
import type { Arc } from "@/lib/types";

// The three facts above the box: what Forge is, what it notices, and what is kept where.
const FACTS = [
  { label: "AI", text: "Forge is an AI on video." },
  {
    label: "What it notices",
    text: "Forge watches for things like pauses and when you light up, so it knows when to give you room. That is Tavus's tech reading your expressions and tone. It never decides your type; your stories do.",
  },
  {
    label: "Your data",
    text: "Forge doesn't record video. It keeps your goals, what you said and your rundown for 24 hours, so it can check every quote against your words and show you the result. Tavus keeps a transcript of the call and a short end-of-call summary of what it saw on camera. Delete my data removes all of it.",
  },
];

const TRC = corpus.credit.trc;

interface ConsentScreenProps {
  arc: Arc;
  askPasscode: boolean;
  crisisLine: string;
  onStarted: (session: ActiveSession) => void;
}

export function ConsentScreen({ arc, askPasscode, crisisLine, onStarted }: ConsentScreenProps) {
  return (
    <main className="forge-night min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-8 sm:px-6 sm:py-12">
        <Wordmark />

        <h1 className="type-display mt-14 text-balance text-[length:clamp(2.75rem,8vw,4.5rem)] text-ink sm:mt-20">
          Let&apos;s figure out how you work.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-quiet">
          {arc === 7 ? "Seven" : "Five"} minutes. A few stories. Your type across four frameworks, what it means for
          the goals you care about, and what to try next. No quiz, no multiple choice.
        </p>

        <dl className="mt-12 space-y-6">
          {FACTS.map((fact) => (
            <div key={fact.label} className="grid gap-1.5 sm:grid-cols-[9.5rem_1fr] sm:gap-6">
              <dt className="type-label pt-1 text-accent-ink">{fact.label}</dt>
              <dd className="text-ink-body">{fact.text}</dd>
            </div>
          ))}
        </dl>

        <SayHiForm askPasscode={askPasscode} onStarted={onStarted} />

        <footer className="mt-auto pt-12 text-sm text-quiet">
          <p>
            Forge is a friend with strong opinions about personality, not a professional. If things are heavy right
            now, talk to a person: <CrisisLine line={crisisLine} />.
          </p>
          <p className="type-label mt-5">
            Frameworks: {TRC.title} by {TRC.author} (
            <a href={TRC.license_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              {TRC.license}
            </a>
            ), Jungian types, Socionics, Enneagram
          </p>
        </footer>
      </div>
    </main>
  );
}
