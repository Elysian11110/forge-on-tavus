/** Numerals 0 to 20 as words, indexed by value; the rundown reads the Enneagram type off it too. */
export const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];

// Curly quotes, modifier letters and accents that stand in for an apostrophe.
const APOSTROPHE_LIKE = /[\u2018\u2019\u02BC\u2032`\u00B4]/g;

const WHOLE_WORDS = new Map<string, string>([
  ["can't", "can not"],
  ["cannot", "can not"],
  ["won't", "will not"],
  ["shan't", "shall not"],
  ["ain't", "is not"],
  ["i'm", "i am"],
  ["let's", "let us"],
  ["y'all", "you all"],
  ["'cause", "because"],
  ["gonna", "going to"],
  ["wanna", "want to"],
  ["gotta", "got to"],
]);

// In these words 's means is. Anywhere else it's a possessive and only loses its apostrophe.
const S_MEANS_IS = new Set([
  "it's", "that's", "there's", "here's", "what's", "who's", "where's", "when's", "why's", "how's", "he's", "she's",
]);

const SUFFIXES: ReadonlyArray<readonly [string, string]> = [
  ["n't", " not"],
  ["'re", " are"],
  ["'ve", " have"],
  ["'ll", " will"],
  ["'d", " would"],
];

function expandContraction(word: string): string {
  const whole = WHOLE_WORDS.get(word);
  if (whole) return whole;
  if (S_MEANS_IS.has(word)) return `${word.slice(0, -2)} is`;
  for (const [suffix, replacement] of SUFFIXES) {
    if (word.length > suffix.length && word.endsWith(suffix)) return word.slice(0, -suffix.length) + replacement;
  }
  return word;
}

// Both sides of a quote match go through this: lower case, no punctuation, common contractions
// expanded and numerals 0 to 20 as words, so "I'm" matches "I am" and "5" matches "five".
function normalizeToken(token: string): string[] {
  const words: string[] = [];
  const cleaned = token.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(APOSTROPHE_LIKE, "'");
  for (const piece of cleaned.split(/[^\p{L}\p{N}']+/u)) {
    if (!piece) continue;
    for (const expanded of expandContraction(piece).split(" ")) {
      let word = expanded.replace(/'/g, "");
      if (!word) continue;
      if (/^\d+$/.test(word)) {
        const value = Number(word);
        if (String(value) === word && value <= 20) word = NUMBER_WORDS[value];
      }
      words.push(word);
    }
  }
  return words;
}

// The normalized words and the way back to the original text. origin is the token each word came
// from and spans is where each token sits, which is how the result shows the person's own words.
export interface WordMap {
  words: string[];
  origin: number[];
  spans: Array<[number, number]>;
}

export function normalizeWithMap(text: string): WordMap {
  const map: WordMap = { words: [], origin: [], spans: [] };
  for (const match of text.matchAll(/\S+/g)) {
    const start = match.index ?? 0;
    const tokenIndex = map.spans.push([start, start + match[0].length]) - 1;
    for (const word of normalizeToken(match[0])) {
      map.words.push(word);
      map.origin.push(tokenIndex);
    }
  }
  return map;
}

export function normalizeWords(text: string): string[] {
  return normalizeWithMap(text).words;
}

export function normalizeText(text: string): string {
  return normalizeWords(text).join(" ");
}

function wordsMatchAt(haystack: readonly string[], needle: readonly string[], start: number): boolean {
  return needle.every((word, offset) => haystack[start + offset] === word);
}

export function findWords(haystack: readonly string[], needle: readonly string[]): number {
  if (needle.length === 0 || needle.length > haystack.length) return -1;
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    if (wordsMatchAt(haystack, needle, start)) return start;
  }
  return -1;
}

/** The person's original words behind normalized words start to start + length, edge punctuation trimmed. */
export function originalSpan(text: string, map: WordMap, start: number, length: number): string {
  const from = map.spans[map.origin[start]][0];
  const to = map.spans[map.origin[start + length - 1]][1];
  return text.slice(from, to).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}
