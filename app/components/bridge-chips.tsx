import type { Profile } from "@/lib/types";

/** True when at least one of Jungian, Socionics or the Enneagram was called. */
export function hasBridge(profile: Profile): boolean {
  return Boolean(profile.jungian || profile.socionics || profile.enneagram);
}

/** The bridge across the other three frameworks, one quiet chip each. A framework not called yet stays dim. */
export function BridgeChips({ profile }: { profile: Profile }) {
  const chips = [
    { framework: "Jungian", value: profile.jungian },
    { framework: "Socionics", value: profile.socionics ? `${profile.socionics}${profile.quadra ? ` · ${profile.quadra}` : ""}` : null },
    { framework: "Enneagram", value: profile.enneagram ? String(profile.enneagram) : null },
  ];
  return (
    <ul className="flex flex-wrap gap-2">
      {chips.map(({ framework, value }) => (
        <li
          key={framework}
          className={`type-label border px-3 py-2 normal-case tracking-[0.06em] ${value ? "border-rule text-ink" : "border-line text-quiet"}`}
        >
          {framework} {value ?? "not called yet"}
        </li>
      ))}
    </ul>
  );
}
