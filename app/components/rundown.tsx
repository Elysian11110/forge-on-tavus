import type { ReactNode } from "react";
import { BridgeChips, hasBridge } from "@/app/components/bridge-chips";
import { FrameworkRows } from "@/app/components/framework-rows";
import { GoalCard } from "@/app/components/goal-card";
import { InYourWords } from "@/app/components/in-your-words";
import { TRIGGER_LINES } from "@/lib/client/words";
import type { Profile } from "@/lib/types";

// The checked rundown, as the server stored it: every label was picked from a fixed list and every
// quote matched the person's own words. This file only lays it out.

/** The callsign as one big line, the focal point of the result. */
function RundownHero({ profile }: { profile: Profile }) {
  return (
    <header>
      <p className="stamp">{profile.callsign ? "Here's how you work" : "The honest version"}</p>
      {profile.callsign ? (
        // Sized so the longest callsign, Understanding, fits a phone and the column.
        <h1 className="type-hero mt-6 text-[length:clamp(3.75rem,15vw,9rem)] text-ink">
          <span className="block">{profile.callsign}</span>
          <span className="type-heat block">lens.</span>
        </h1>
      ) : (
        <h1 className="type-hero mt-6 text-[length:clamp(3.25rem,11vw,6.5rem)] text-ink">
          <span className="block">Not called</span>
          <span className="type-outline block">yet.</span>
        </h1>
      )}
      {profile.trc && profile.lens && profile.tool && (
        <p className="type-label mt-8 normal-case tracking-[0.06em] text-quiet">
          TRC {profile.trc} · lens {profile.lens} · tool {profile.tool}
        </p>
      )}
      {hasBridge(profile) && (
        <div className="mt-4">
          <BridgeChips profile={profile} />
        </div>
      )}
    </header>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-20">
      <h2 className="stamp">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** The whole rundown below the hero, in reading order: what I said, your goals, your words, the four frameworks. */
export function Rundown({ profile }: { profile: Profile }) {
  // The spoken reveal already carries the how-you-work line when a type was called, and the
  // settling question under F01, so neither is printed twice.
  const howYouWork = profile.how_you_work && !profile.spoken_reveal.includes(profile.how_you_work) ? profile.how_you_work : null;
  const settleQuestion =
    profile.settle_question && !profile.spoken_reveal.includes(profile.settle_question) ? profile.settle_question : null;

  return (
    <>
      <RundownHero profile={profile} />

      <figure className="mt-14 border-l-2 border-ember pl-6">
        <blockquote className="type-quote text-[length:clamp(1.5rem,4vw,2rem)] leading-snug text-ink">
          {profile.spoken_reveal}
        </blockquote>
        <figcaption className="type-label mt-4 text-quiet">What I said, word for word</figcaption>
      </figure>

      {howYouWork && (
        <Section title="How you work">
          <p className="max-w-prose text-lg text-ink-body">{howYouWork}</p>
        </Section>
      )}

      {profile.goals.length > 0 && (
        <Section title="For your goals">
          <div className="space-y-5">
            {profile.goals.map((goal) => (
              <GoalCard key={goal.goal_id} goal={goal} />
            ))}
          </div>
        </Section>
      )}

      {profile.in_your_words.length > 0 && (
        <Section title="In your words">
          <InYourWords quotes={profile.in_your_words} />
        </Section>
      )}

      {(profile.callsign || hasBridge(profile)) && (
        <Section title="Across four frameworks">
          <FrameworkRows profile={profile} />
        </Section>
      )}

      {profile.triggers.length > 0 && (
        <Section title="What I can't call yet">
          <ul className="space-y-3 text-lg text-ink-body">
            {profile.triggers.map((id) => (
              <li key={id}>{TRIGGER_LINES[id]}</li>
            ))}
          </ul>
          {settleQuestion && (
            <p className="mt-6 text-lg text-ink-body">
              <span className="text-quiet">The one question that would settle it: </span>
              {settleQuestion}
            </p>
          )}
        </Section>
      )}
    </>
  );
}
