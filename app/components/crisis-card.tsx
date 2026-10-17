import { Fragment } from "react";

// The words come from the server (chosen by country from x-vercel-ip-country); only the numbers
// and the helpline site become tappable.
const LINKS: Record<string, string> = {
  "116 123": "tel:116123",
  "988": "tel:988",
  "findahelpline.com": "https://findahelpline.com",
};

function CrisisLine({ line }: { line: string }) {
  return (
    <>
      {line.split(/(116 123|988|findahelpline\.com)/).map((part, index) =>
        LINKS[part] ? (
          <a key={index} href={LINKS[part]} className="font-medium text-ink underline decoration-ember underline-offset-6">
            {part}
          </a>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** Shown when the crisis guardrail fires: calm, steel not ember, never type talk. The line gets its own big row so it is easy to tap. */
export function CrisisCard({ line, onEnd }: { line: string; onEnd?: () => void }) {
  return (
    <section role="alert" className="animate-rise border border-rule bg-surface p-6 sm:p-8">
      <h2 className="text-3xl font-medium leading-[1.1] tracking-[-0.03em] text-ink sm:text-4xl">
        Let&apos;s put the type stuff down for now.
      </h2>
      <p className="mt-6 text-ink-body">If things are heavy, talk to a person:</p>
      <p className="mt-2 text-2xl leading-snug text-ink">
        <CrisisLine line={line} />.
      </p>
      <p className="mt-6 text-ink-body">If you&apos;re in danger right now, call your local emergency number.</p>
      {onEnd && (
        <button type="button" onClick={onEnd} className="line-btn mt-8">
          End the call
        </button>
      )}
    </section>
  );
}
