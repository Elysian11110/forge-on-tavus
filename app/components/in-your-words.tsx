import { corpus, type PatternEntry } from "@/lib/synth/corpus";
import type { EvidenceQuote } from "@/lib/types";

/** Pattern labels for "points to"; an id the corpus does not know gets no label. */
const PATTERNS: Partial<Record<string, PatternEntry>> = corpus.patterns;

/** Only the words the server matched against what the person actually said. */
export function InYourWords({ quotes }: { quotes: EvidenceQuote[] }) {
  return (
    <ul className="space-y-6">
      {quotes.map((quote) => {
        const label = PATTERNS[quote.pattern_id]?.label;
        return (
          <li key={`${quote.pattern_id}:${quote.words}`} className="border-l-2 border-emph pl-5">
            <p className="font-display text-xl italic leading-snug text-ink">{quote.words}</p>
            {label && <p className="type-label mt-2 text-quiet">points to {label}</p>}
          </li>
        );
      })}
    </ul>
  );
}
