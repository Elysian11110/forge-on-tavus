// Small brand pieces shared by the screens: the wordmark, the AI chip, the breathing status and
// the TRC credit.

import { corpus } from "@/lib/synth/corpus";

export function Wordmark() {
  return <p className="type-display text-2xl text-ink">Forge</p>;
}

/** Stays up for the whole call, in case Tavus's own disclosure banner doesn't render in a custom UI. */
export function AiChip() {
  return (
    <span className="type-label inline-flex items-center rounded-full border border-line px-3 py-1.5 text-ink">
      AI · not a therapist
    </span>
  );
}

/** A status line with the breathing mark: calm, no spinner, no bouncing dots. */
export function StatusLine({ text, live = true }: { text: string; live?: boolean }) {
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-3 text-quiet">
      <span
        aria-hidden
        className={`size-2.5 shrink-0 rounded-full ${live ? "animate-breathe bg-forge-teal" : "bg-quiet"}`}
      />
      {text}
    </p>
  );
}

/** The CC BY 4.0 attribution from the corpus, which also says which words are Forge's own; the license is linked. */
export function TrcCredit() {
  const { notice, license, license_url: licenseUrl } = corpus.credit.trc;
  const [before, ...rest] = notice.split(license);
  const link = (
    <a href={licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
      {license}
    </a>
  );
  return rest.length > 0 ? (
    <>
      {before}
      {link}
      {rest.join(license)}
    </>
  ) : (
    <>
      {notice} {link}
    </>
  );
}
