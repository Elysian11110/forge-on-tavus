import { corpus, type PatternEntry } from "@/lib/synth/corpus";
import type { EvidenceQuote } from "@/lib/types";

/** Pattern labels for "points to"; an id the corpus does not know gets no label. */
const PATTERNS: Partial<Record<string, PatternEntry>> = corpus.patterns;

/** Only the words the server matched against what the person actually said, ruled in gold. */
export function InYourWords({ quotes }: { quotes: EvidenceQuote[] }) {
  return (
    <ul className="space-y-7">
      {quotes.map((quote) => {
        const label = PATTERNS[quote.pattern_id]?.label;
        return (
          <li key={`${quote.pattern_id}:${quote.words}`} className="border-l-2 border-gold pl-6">
            <p className="type-quote text-[length:clamp(1.25rem,3vw,1.5rem)] leading-snug text-ink">{quote.words}</p>
            {label && <p className="type-label mt-2.5 text-quiet">Points to {label}</p>}
          </li>
        );
      })}
    </ul>
  );
}
