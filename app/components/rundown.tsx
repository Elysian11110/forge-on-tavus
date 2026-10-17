import type { ReactNode } from "react";
import { BridgeChips, hasBridge } from "@/app/components/bridge-chips";
import { FrameworkRows } from "@/app/components/framework-rows";
import { GoalCard } from "@/app/components/goal-card";
import { InYourWords } from "@/app/components/in-your-words";
import { TRIGGER_LINES } from "@/lib/client/words";
import type { Profile } from "@/lib/types";

// The checked rundown, as the server stored it: every label was picked from a fixed list and every
// quote matched the person's own words. This file only lays it out.

/** The callsign and its codes: the one focal point of the result. */
function RundownHero({ profile }: { profile: Profile }) {
  return (
    <header>
      <p className="type-display text-2xl text-accent">{profile.callsign ? "Here's how you work" : "The honest version"}</p>
      {/* Sized so the longest callsign, Understanding, fits a phone and the column. */}
      <h1
        className={`type-display mt-4 text-ink ${
          profile.callsign ? "text-[length:clamp(3rem,12vw,7rem)]" : "text-[length:clamp(2.75rem,9vw,5rem)]"
        }`}
      >
        {profile.callsign ?? "Not called yet"}
      </h1>
      {profile.trc && profile.lens && profile.tool && (
        <p className="type-label mt-5 normal-case text-quiet">
          TRC · {profile.trc} · lens {profile.lens}, tool {profile.tool}
        </p>
      )}
    </header>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-16">
      <h2 className="type-label text-quiet">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** The whole rundown below the hero, in reading order. */
export function Rundown({ profile }: { profile: Profile }) {
  // The spoken reveal already carries the how-you-work line when a type was called, and the
  // settling question under F01, so neither is printed twice.
  const howYouWork = profile.how_you_work && !profile.spoken_reveal.includes(profile.how_you_work) ? profile.how_you_work : null;
  const settleQuestion =
    profile.settle_question && !profile.spoken_reveal.includes(profile.settle_question) ? profile.settle_question : null;

  return (
    <>
      <RundownHero profile={profile} />

      <figure className="mt-10 border-l-2 border-accent pl-5">
        <blockquote className="font-display text-2xl italic leading-snug text-ink">{profile.spoken_reveal}</blockquote>
        <figcaption className="type-label mt-3 text-quiet">What I said, word for word</figcaption>
      </figure>

      {hasBridge(profile) && (
        <div className="mt-8">
          <BridgeChips profile={profile} />
        </div>
      )}

      <Section title="The rundown">
        <FrameworkRows profile={profile} />
      </Section>

      {howYouWork && (
        <Section title="How you work">
          <p className="max-w-prose text-lg text-ink-body">{howYouWork}</p>
        </Section>
      )}

      {profile.in_your_words.length > 0 && (
        <Section title="In your words">
          <InYourWords quotes={profile.in_your_words} />
        </Section>
      )}

      {profile.goals.length > 0 && (
        <Section title="For your goals">
          <div className="space-y-4">
            {profile.goals.map((goal) => (
              <GoalCard key={goal.goal_id} goal={goal} />
            ))}
          </div>
        </Section>
      )}

      {profile.triggers.length > 0 && (
        <Section title="What I can't call yet">
          <ul className="space-y-2 text-ink-body">
            {profile.triggers.map((id) => (
              <li key={id}>{TRIGGER_LINES[id]}</li>
            ))}
          </ul>
          {settleQuestion && (
            <p className="mt-5 text-ink-body">
              <span className="text-quiet">The one question that would settle it: </span>
              {settleQuestion}
            </p>
          )}
        </Section>
      )}
    </>
  );
}
