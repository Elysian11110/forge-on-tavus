// The crisis line, chosen by country, and the first-name cleaning. Both land in the model's
// context, so they are built on the server and handed to the screens as plain strings.

// One line per country, the same on screen and in the call context, so voice and screen match.
const CRISIS_LINE_GB = "Samaritans, 116 123, free, any time";
const CRISIS_LINE_US = "call or text 988";
const CRISIS_LINE_ELSEWHERE = "findahelpline.com, which lists free lines where you are";

// Longest word kept from a first name, in characters.
const NAME_WORD_MAX = 20;

/** The crisis line for a country code from x-vercel-ip-country; everyone outside GB and the US gets the helpline directory. */
export function crisisLineFor(country: string | null | undefined): string {
  const code = (country ?? "").trim().toUpperCase();
  if (code === "GB") return CRISIS_LINE_GB;
  if (code === "US") return CRISIS_LINE_US;
  return CRISIS_LINE_ELSEWHERE;
}

/** One or two words of letters, each capitalised, since the name lands in the model's instructions; null when nothing usable is left. */
export function cleanFirstName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const words = raw
    .normalize("NFC")
    .split(/[^\p{L}\p{M}]+/u)
    .filter((word) => /^\p{L}/u.test(word))
    .slice(0, 2)
    .map(capitalise);
  return words.length > 0 ? words.join(" ") : null;
}

function capitalise(word: string): string {
  const letters = Array.from(word).slice(0, NAME_WORD_MAX);
  return letters[0].toUpperCase() + letters.slice(1).join("");
}
