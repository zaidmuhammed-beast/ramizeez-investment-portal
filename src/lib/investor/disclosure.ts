// What each disclosure level reveals. Pure and client-safe.
import { toPkr } from "@/config/platform";

export type Level = "NONE" | "TEASER" | "SUMMARY" | "FULL";

/** Fields a founder can hold back until the approved full data room. */
export const CONFIDENTIAL_CANDIDATES = [
  ["solution", "How the solution works"],
  ["differentiation", "What makes you different"],
  ["competitors", "Competitor list"],
  ["pricing", "Pricing"],
  ["unitEconomics", "Unit economics"],
  ["partners", "Suppliers & partners"],
  ["projectionAssumptions", "Projection assumptions"],
] as const;

export type ConfidentialField = (typeof CONFIDENTIAL_CANDIDATES)[number][0];

/** Anonymous reference used in teasers and NDAs instead of the business name. */
export const pitchRef = (pitchId: string) => `RZ-${pitchId.slice(-6).toUpperCase()}`;

/** Revenue shown as a band in teasers, never as an exact figure. */
export function revenueBand(revenueLast12: number | null, currency: string): string | null {
  if (revenueLast12 === null) return null;
  const pkr = toPkr(revenueLast12, currency);
  if (pkr < 1_000_000) return "Under PKR 1M a year";
  if (pkr < 10_000_000) return "PKR 1–10M a year";
  if (pkr < 50_000_000) return "PKR 10–50M a year";
  return "Over PKR 50M a year";
}

/** True when a field may be shown at `level`. */
export function visibleAt(level: Level, field: ConfidentialField, confidential: string[]): boolean {
  if (level === "FULL") return true;
  if (level === "SUMMARY") return !confidential.includes(field);
  return false;
}

export const LEVEL_LABEL: Record<Level, string> = {
  NONE: "Not available",
  TEASER: "Teaser",
  SUMMARY: "Summary unlocked",
  FULL: "Full data room",
};

/**
 * Removes emails, links, phone numbers and social handles from messages between investors
 * and founders: all contact goes through RamiZeeZ until a deal is agreed (non-circumvention).
 */
export function stripContactDetails(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[removed]")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[removed]")
    .replace(/\b[\w-]+\.(?:com|net|org|pk|io|co|ae|uk)\b\S*/gi, "[removed]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[removed]")
    .replace(/(^|\s)@[\w.]{3,}/g, "$1[removed]");
}
