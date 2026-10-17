import { Fragment } from "react";

// The words come from the server (chosen by country from x-vercel-ip-country); only the numbers
// and the helpline site become tappable.
const LINKS: Record<string, string> = {
  "116 123": "tel:116123",
  "988": "tel:988",
  "findahelpline.com": "https://findahelpline.com",
};

export function CrisisLine({ line }: { line: string }) {
  return (
    <>
      {line.split(/(116 123|988|findahelpline\.com)/).map((part, index) =>
        LINKS[part] ? (
          <a key={index} href={LINKS[part]} className="font-medium underline underline-offset-4">
            {part}
          </a>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** Shown when the crisis guardrail fires: a calm daylight card, never type talk. */
export function CrisisCard({ line, onEnd }: { line: string; onEnd?: () => void }) {
  return (
    <section role="alert" className="forge-day animate-rise rounded-card p-6 sm:p-8">
      <h2 className="type-display text-3xl">Let&apos;s put the type stuff down for now.</h2>
      <p className="mt-4 text-ink-body">
        If things are heavy, talk to a person: <CrisisLine line={line} />. If you&apos;re in danger right now, call
        your local emergency number.
      </p>
      {onEnd && (
        <button
          type="button"
          onClick={onEnd}
          className="mt-6 h-11 rounded-btn bg-ink px-5 text-page transition-opacity duration-150 hover:opacity-90"
        >
          End the call
        </button>
      )}
    </section>
  );
}
