import type { ReactNode } from "react";
import { corpus } from "@/lib/synth/corpus";
import { confidenceWord } from "@/lib/synth/templates";
import type { Confidence, Profile } from "@/lib/types";

/** "one-to-one" for sexual and so on; nothing for undetermined. */
const INSTINCT_WORDS: Partial<Record<string, string>> = corpus.enneagram_instincts;

function Row(props: { label: string; value: string | null; confidence: Confidence; children?: ReactNode }) {
  const word = confidenceWord(props.value ? props.confidence : "insufficient");
  return (
    <div className="border-t border-line py-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="type-label text-quiet">{props.label}</p>
        <p className={`type-label ${props.value ? "text-ember" : "text-quiet"}`}>{word}</p>
      </div>
      {props.value && <p className="mt-3 text-2xl font-medium tracking-[-0.02em] text-ink">{props.value}</p>}
      {props.value && props.children && <div className="mt-3 text-ink-body">{props.children}</div>}
    </div>
  );
}

/** The four slots of the TRC row, each in Forge's plain words. */
function Stack({ profile }: { profile: Profile }) {
  const slots = [
    ["lens", profile.lens],
    ["tool", profile.tool],
    ["spark", profile.spark],
    ["drain", profile.drain],
  ] as const;
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {slots.map(([slot, fn]) =>
        fn ? (
          <div key={slot}>
            <dt className="type-label normal-case tracking-[0.06em] text-quiet">
              {slot} {fn}
            </dt>
            <dd className="mt-1">{corpus.functions[fn].plain}</dd>
          </div>
        ) : null,
      )}
    </dl>
  );
}

/** Four rows with confidence in words; the Jungian row shares TRC's confidence, since it is read off the TRC row. */
export function FrameworkRows({ profile }: { profile: Profile }) {
  const labels = profile.enneagram_labels;
  const instinct = INSTINCT_WORDS[profile.enneagram_instinct];
  return (
    <div className="border-b border-line">
      <Row
        label="TRC"
        value={profile.callsign && profile.trc ? `${profile.callsign}, ${profile.trc}` : null}
        confidence={profile.trc_confidence}
      >
        <Stack profile={profile} />
      </Row>
      <Row label="Jungian" value={profile.jungian} confidence={profile.trc_confidence} />
      <Row
        label="Socionics"
        value={profile.socionics ? `${profile.socionics}${profile.quadra ? ` · ${profile.quadra}` : ""}` : null}
        confidence={profile.socionics_confidence}
      />
      <Row label="Enneagram" value={profile.enneagram ? `Type ${profile.enneagram}` : null} confidence={profile.enneagram_confidence}>
        {labels && `${labels.triad} triad · fixation ${labels.fixation} · passion ${labels.passion} · trap ${labels.trap}`}
        {labels && instinct && ` · ${instinct}`}
      </Row>
    </div>
  );
}
