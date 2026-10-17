// The Jungian and Socionics code patterns, matched the way the Forge site's own normalizer reads
// them: Jungian in any case, Socionics in capitals only, because "lie" and "see" are words. The
// lint and the report pinning both read codes off these.

export const JUNGIAN_CODE = /\b[IE][NS][TF][JP]\b/i;

export const SOCIONICS_CODE = /\b(?:SLI|SEI|SLE|SEE|ILI|IEI|ILE|IEE|LSI|LII|LSE|LIE|ESI|EII|ESE|EIE)\b/;
