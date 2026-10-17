// The Forge site's shared report, as its /r page reads it: the shape from the site's
// src/lib/types/unified.ts, the decode from its src/lib/report-share.ts (headline and summary
// strings plus a systems object, anything else is "Report not found"), and the link. The report
// lives in the link; the site keeps no copy.

import { isRecord } from "@/lib/guards";

export const FORGE_SITE = "https://forge-jet.vercel.app";

/** The seven systems the site's page draws, in its display order. */
export const SITE_SYSTEMS = ["mbti", "socionics", "enneagram", "temperaments", "moralAlignment", "attitudinalPsyche", "bigFive"] as const;
export type SiteSystemKey = (typeof SITE_SYSTEMS)[number];

/** One "Why this?" row on a system card: a moment from the person's life and what it points to. */
export interface SiteEvidence {
  moment: string;
  signal: string;
}

/** One system card. The page shows code, detail, verdict, then bullets, else evidence plus watchFor, else justification. */
export interface SiteSystem {
  code: string;
  detail?: string;
  justification: string;
  bullets?: string[];
  verdict?: string;
  evidence?: SiteEvidence[];
  watchFor?: string;
  /** Enneagram only: "873", core first. */
  tritype?: string;
  /** Enneagram only: "sp/so/sx". */
  instinctStack?: string;
}

export interface SiteReport {
  headline: string;
  summary: string;
  summaryBullets?: string[];
  method: "phases";
  systems: Record<SiteSystemKey, SiteSystem>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const kept = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return kept.length > 0 ? kept : undefined;
}

function evidenceList(value: unknown): SiteEvidence[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const kept: SiteEvidence[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.moment !== "string" || typeof item.signal !== "string") continue;
    if (item.moment.trim() && item.signal.trim()) kept.push({ moment: item.moment, signal: item.signal });
  }
  return kept.length > 0 ? kept : undefined;
}

/** Drops undefined fields so the encoded link carries only what the page draws. */
export function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;
}

function readSystem(value: unknown): SiteSystem {
  const raw = isRecord(value) ? value : {};
  return compact({
    code: typeof raw.code === "string" && raw.code.trim() ? raw.code : "-",
    detail: optionalString(raw.detail),
    justification: typeof raw.justification === "string" ? raw.justification : "",
    bullets: stringList(raw.bullets),
    verdict: optionalString(raw.verdict),
    evidence: evidenceList(raw.evidence),
    watchFor: optionalString(raw.watchFor),
    tritype: optionalString(raw.tritype),
    instinctStack: optionalString(raw.instinctStack),
  });
}

/**
 * The unified scorer's result, or a decoded link, as a report the page can draw: the fields it
 * reads and nothing else (its confidence and centers fields are server-side only). Null when the
 * headline, summary or systems are missing, which is what the page's own decode refuses.
 */
export function readSiteReport(value: unknown): SiteReport | null {
  if (!isRecord(value) || typeof value.headline !== "string" || typeof value.summary !== "string" || !isRecord(value.systems)) return null;
  const raw = value.systems;
  const systems = Object.fromEntries(SITE_SYSTEMS.map((key) => [key, readSystem(raw[key])])) as Record<SiteSystemKey, SiteSystem>;
  return compact({ headline: value.headline, summary: value.summary, summaryBullets: stringList(value.summaryBullets), method: "phases" as const, systems });
}

/** The report as the site's own encodeReport writes it: base64url of the JSON, no padding. */
export function encodeReport(report: SiteReport): string {
  return Buffer.from(JSON.stringify(report), "utf-8").toString("base64url");
}

/** The site's decodeReport, for checking a link we built; null where the site shows "Report not found". */
export function decodeReport(encoded: string): SiteReport | null {
  try {
    return readSiteReport(JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")));
  } catch {
    return null;
  }
}

export function reportUrl(report: SiteReport): string {
  return `${FORGE_SITE}/r?d=${encodeReport(report)}`;
}

/** The encoded report inside one of our links, or null for any other URL. */
export function encodedFromUrl(url: string): string | null {
  const prefix = `${FORGE_SITE}/r?d=`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

/** What the result page draws before the link is opened: the headline, the summary, a few bullets and the three type codes. */
export interface ReportPreview {
  headline: string;
  summary: string;
  bullets: string[];
  types: { label: string; code: string }[];
}

const PREVIEW_BULLETS = 3;
const PREVIEW_TYPES: { key: SiteSystemKey; label: string }[] = [
  { key: "mbti", label: "Jungian" },
  { key: "socionics", label: "Socionics" },
  { key: "enneagram", label: "Enneagram" },
];

export function previewOf(report: SiteReport): ReportPreview {
  return {
    headline: report.headline,
    summary: report.summary,
    bullets: (report.summaryBullets ?? []).slice(0, PREVIEW_BULLETS),
    types: PREVIEW_TYPES.flatMap(({ key, label }) => {
      const code = report.systems[key].code.trim();
      return code && code !== "-" ? [{ label, code }] : [];
    }),
  };
}

