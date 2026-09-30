// Execution, marketing and monthly-report rules. Pure and unit-tested.
import type { DealType, OfferTerms } from "@/lib/deals/offers";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type Health = "GREEN" | "AMBER" | "RED";
export const HEALTH_LABEL: Record<Health, string> = { GREEN: "On track", AMBER: "Needs attention", RED: "At risk" };

export function healthError(health: Health, note: string | null): string | null {
  if (health !== "GREEN" && (!note || note.trim().length < 10)) return "Explain what's wrong and what's being done (at least 10 characters)";
  return null;
}

export const isOverdue = (t: { status: string; dueDate: Date | null }, now: Date) => t.status !== "DONE" && !!t.dueDate && t.dueDate.getTime() < now.getTime();

// ─── Monthly reports ──────────────────────────────────────────────────────────

/** Reports are due by this day of the month after the period. */
export const REPORT_DUE_DAY = 10;

export const periodOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** End of the due day (UTC) for a period's report. */
export function dueDate(period: string): Date {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, REPORT_DUE_DAY, 23, 59, 59));
}

/** Every month from the funding month up to the last month that has ended. */
export function duePeriods(fundedAt: Date, now: Date): string[] {
  const out: string[] = [];
  let y = fundedAt.getUTCFullYear();
  let m = fundedAt.getUTCMonth();
  const endY = now.getUTCFullYear();
  const endM = now.getUTCMonth();
  while (y < endY || (y === endY && m < endM)) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m++;
    if (m === 12) {
      m = 0;
      y++;
    }
  }
  return out;
}

export type ReportState = "PUBLISHED" | "SUBMITTED" | "RETURNED" | "DUE" | "OVERDUE";

export function reportSchedule(fundedAt: Date, now: Date, reports: { period: string; status: "SUBMITTED" | "RETURNED" | "PUBLISHED" }[]) {
  return duePeriods(fundedAt, now)
    .map((period) => {
      const r = reports.find((x) => x.period === period);
      const due = dueDate(period);
      const state: ReportState = r && r.status !== "RETURNED" ? r.status : now.getTime() > due.getTime() ? "OVERDUE" : r ? "RETURNED" : "DUE";
      return { period, due, state };
    })
    .reverse();
}

export type ReportInput = { period: string; revenue: number; costs: number; cashInBank: number | null; customers: number | null; highlights: string; challenges: string };

export function reportErrors(r: ReportInput, allowedPeriods: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!allowedPeriods.includes(r.period)) out.period = "Choose a month that has ended since funding";
  if (!Number.isFinite(r.revenue) || r.revenue < 0) out.revenue = "Enter the month's revenue (0 or more)";
  if (!Number.isFinite(r.costs) || r.costs < 0) out.costs = "Enter the month's costs (0 or more)";
  if (r.cashInBank !== null && (!Number.isFinite(r.cashInBank) || r.cashInBank < 0)) out.cashInBank = "0 or more";
  if (r.customers !== null && (!Number.isInteger(r.customers) || r.customers < 0)) out.customers = "A whole number";
  if (r.highlights.trim().length < 20) out.highlights = "At least 20 characters";
  if (r.challenges.trim().length < 10) out.challenges = "At least 10 characters: every month has some";
  return out;
}

export type ReturnInput = {
  dealType: DealType;
  terms: OfferTerms;
  amount: number; // this investor's commitment
  fundedTotal: number; // the whole round
  founderCapital: number; // Musharakah: the founder's own capital
  revenue: number;
  costs: number;
  /** Revenue share: what this investor's share has come to in earlier published months. */
  earlierShare: number;
};

/**
 * What one month's figures mean for one investor, before any distribution decision.
 * Indicative only: actual payments follow the signed agreement and audited accounts.
 * Where several investors share a round, each one's share is pro rata to their commitment.
 */
export function indicativeReturn(i: ReturnInput): { label: string; value: number } {
  const profit = i.revenue - i.costs;
  const portion = i.fundedTotal > 0 ? i.amount / i.fundedTotal : 0;
  switch (i.dealType) {
    case "MUSHARAKAH":
      if (profit >= 0) return { label: "Your indicative profit share", value: round2(profit * ((i.terms.profitSharePercent ?? 0) / 100) * portion) };
      // Losses are shared in proportion to capital, including the founder's.
      return { label: "Your indicative share of the loss", value: round2(profit * (i.amount / (i.fundedTotal + i.founderCapital || 1))) };
    case "MUDARABAH":
      if (profit >= 0) return { label: "Your indicative profit share", value: round2(profit * ((i.terms.profitSharePercent ?? 0) / 100) * portion) };
      // The capital provider bears financial loss (absent the founder's negligence).
      return { label: "Your indicative share of the loss", value: round2(profit * portion) };
    case "REVENUE_SHARE": {
      const share = i.revenue * ((i.terms.revenueSharePercent ?? 0) / 100) * portion;
      const cap = i.amount * (i.terms.returnCapMultiple ?? 0);
      return { label: "Your indicative revenue share", value: round2(Math.max(0, Math.min(share, cap - i.earlierShare))) };
    }
    case "EQUITY":
      return { label: "Profit attributable to your stake (not distributed)", value: round2(profit * ((i.terms.equityPercent ?? 0) / 100)) };
  }
}

// ─── Marketing ────────────────────────────────────────────────────────────────

export const CHANNELS = ["Instagram", "Facebook", "TikTok", "YouTube", "Google Ads", "WhatsApp", "Influencers", "Events", "Press", "Email", "Outdoor", "Other"] as const;

export function campaignErrors(c: { name: string; channel: string; objective: string; startDate: Date; endDate: Date | null; budget: number | null }): Record<string, string> {
  const out: Record<string, string> = {};
  if (c.name.trim().length < 3) out.name = "At least 3 characters";
  if (!(CHANNELS as readonly string[]).includes(c.channel)) out.channel = "Choose a channel";
  if (c.objective.trim().length < 10) out.objective = "At least 10 characters";
  if (Number.isNaN(c.startDate.getTime())) out.startDate = "Choose a start date";
  if (c.endDate && !Number.isNaN(c.startDate.getTime()) && c.endDate.getTime() < c.startDate.getTime()) out.endDate = "Ends before it starts";
  if (c.budget !== null && (!Number.isFinite(c.budget) || c.budget < 0)) out.budget = "0 or more";
  return out;
}

/** Conversion rates for a campaign's results, or null where there isn't enough data. */
export function campaignRates(c: { reach: number | null; leads: number | null; conversions: number | null; budget: number | null }) {
  const pct = (a: number | null, b: number | null) => (a !== null && b ? round2((a / b) * 100) : null);
  return {
    leadRate: pct(c.leads, c.reach),
    conversionRate: pct(c.conversions, c.leads),
    costPerConversion: c.budget !== null && c.conversions ? round2(c.budget / c.conversions) : null,
  };
}
