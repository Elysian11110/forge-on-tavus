// Small brand pieces shared by the screens: the Forge mark and wordmark, the AI chip and the live
// status line.

/** The Forge site's mark: a voice wave stood up into a spine, ember-dim edges to an ember-hot core. */
export function ForgeMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none" aria-hidden>
      <defs>
        <linearGradient id="forge-spine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--ember-dim)" />
          <stop offset="0.5" stopColor="var(--ember-hot)" />
          <stop offset="1" stopColor="var(--ember-dim)" />
        </linearGradient>
      </defs>
      <g fill="url(#forge-spine)">
        <rect x="7" y="56" width="18" height="16" rx="8" />
        <rect x="103" y="56" width="18" height="16" rx="8" />
        <rect x="31" y="48" width="18" height="32" rx="9" />
        <rect x="79" y="48" width="18" height="32" rx="9" />
        <rect x="55" y="20" width="18" height="88" rx="9" />
      </g>
    </svg>
  );
}

/** The mark is the way home from any screen; leaving a live call this way ends it, since the page unloads. */
export function Wordmark() {
  return (
    <a
      href="/homepage"
      aria-label="Forge home"
      className="inline-flex items-center gap-2.5 text-[22px] font-medium tracking-[-0.03em] text-ink hover:text-ember-hot focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ember"
    >
      <ForgeMark />
      Forge
    </a>
  );
}

/** Stays up for the whole call, in case Tavus's own disclosure banner doesn't render in a custom UI. */
export function AiChip() {
  return (
    <span className="type-label inline-flex h-9 items-center gap-2.5 border border-rule px-3 text-ink">
      <span aria-hidden className="size-1.5 bg-ember" />
      AI · not a therapist
    </span>
  );
}

/** A status line led by the breathing ember square: calm, no spinner, no bouncing dots. */
export function StatusLine({ text, live = true }: { text: string; live?: boolean }) {
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-3 text-ink-body">
      <span aria-hidden className={`size-2 shrink-0 ${live ? "animate-breathe bg-ember" : "bg-rule"}`} />
      {text}
    </p>
  );
}
