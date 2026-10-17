import type { Profile } from "@/lib/types";

/** True when at least one of Jungian, Socionics or the Enneagram was called. */
export function hasBridge(profile: Profile): boolean {
  return Boolean(profile.jungian || profile.socionics || profile.enneagram);
}

/** The bridge across the other three frameworks, one quiet chip each. */
export function BridgeChips({ profile }: { profile: Profile }) {
  const chips = [
    profile.jungian ? `Jungian ${profile.jungian}` : "Jungian: not called yet",
    profile.socionics
      ? `Socionics ${profile.socionics}${profile.quadra ? ` · ${profile.quadra}` : ""}`
      : "Socionics: not called yet",
    profile.enneagram ? `Enneagram ${profile.enneagram}` : "Enneagram: not called yet",
  ];
  return (
    <ul className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={chip} className="type-label rounded-full border border-line px-3 py-1.5 text-ink">
          {chip}
        </li>
      ))}
    </ul>
  );
}
