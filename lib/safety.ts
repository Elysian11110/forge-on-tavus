// The crisis line, chosen by country, and the first-name cleaning. Both land in the model's
// context, so they are built on the server and handed to the screens as plain strings.

// One line per country, the same on screen and in the call context, so voice and screen match.
const CRISIS_LINE_GB = "Samaritans, 116 123, free, any time";
const CRISIS_LINE_US = "call or text 988";
const CRISIS_LINE_ELSEWHERE = "findahelpline.com, which lists free lines where you are";

// A first name is one or two words of letters, each at most this long; the form and the server
// both run the same rule, so what the screen accepts is exactly what reaches the model.
const NAME_WORD_MAX = 20;
export const NAME_MAX_CHARS = NAME_WORD_MAX * 2 + 1;
export const NAME_RULE = "Letters only, one or two words.";

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

/** Why a typed name is not usable as it stands, or null when it is fine (empty counts as fine: the name is optional). */
export function firstNameProblem(raw: string): string | null {
  const typed = raw.trim();
  if (!typed) return null;
  const words = typed.split(/\s+/);
  if (words.length > 2) return NAME_RULE;
  if (words.some((word) => !/^[\p{L}\p{M}]+$/u.test(word))) return NAME_RULE;
  if (words.some((word) => Array.from(word).length > NAME_WORD_MAX)) return "That's a long one. Up to 20 letters a word.";
  return null;
}

function capitalise(word: string): string {
  const letters = Array.from(word).slice(0, NAME_WORD_MAX);
  return letters[0].toUpperCase() + letters.slice(1).join("");
}
