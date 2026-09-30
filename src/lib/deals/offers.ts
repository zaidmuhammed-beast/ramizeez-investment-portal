// Offer rules: per-structure terms, who may act, and round capacity. Pure and unit-tested.
import { MIN_AMOUNT_PKR, formatMoney, toPkr } from "@/config/platform";
import { MAX_INVESTOR_EQUITY } from "@/lib/pitch/deal";

export type DealType = "EQUITY" | "MUSHARAKAH" | "MUDARABAH" | "REVENUE_SHARE";
export type Party = "INVESTOR" | "FOUNDER";

export type OfferTerms = {
  equityPercent?: number;
  valuation?: number; // pre-money
  profitSharePercent?: number;
  revenueSharePercent?: number;
  returnCapMultiple?: number;
  termMonths?: number;
};

/** The terms each structure needs, with their allowed ranges. */
export const TERM_FIELDS: Record<DealType, { key: keyof OfferTerms; label: string; min: number; max: number }[]> = {
  EQUITY: [
    { key: "equityPercent", label: "Equity for this investment (%)", min: 0.01, max: MAX_INVESTOR_EQUITY },
    { key: "valuation", label: "Pre-money valuation", min: 1, max: 1e13 },
  ],
  MUSHARAKAH: [
    { key: "profitSharePercent", label: "Investor's share of profit (%)", min: 0.01, max: 99 },
    { key: "termMonths", label: "Term (months)", min: 6, max: 240 },
  ],
  MUDARABAH: [
    { key: "profitSharePercent", label: "Investor's share of profit (%)", min: 0.01, max: 99 },
    { key: "termMonths", label: "Term (months)", min: 6, max: 240 },
  ],
  REVENUE_SHARE: [
    { key: "revenueSharePercent", label: "Share of revenue (%)", min: 0.01, max: 50 },
    { key: "returnCapMultiple", label: "Repayment cap (× amount)", min: 1, max: 5 },
    { key: "termMonths", label: "Maximum term (months)", min: 6, max: 240 },
  ],
};

/** Validates terms for a structure. Returns { field: message } for anything wrong. */
export function termErrors(dealType: DealType, terms: OfferTerms): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of TERM_FIELDS[dealType]) {
    const v = terms[f.key];
    if (v === undefined || v === null || !Number.isFinite(v)) out[f.key] = "Required";
    else if (v < f.min || v > f.max) out[f.key] = `Between ${f.min} and ${f.max}`;
    else if (f.key === "termMonths" && !Number.isInteger(v)) out[f.key] = "Whole months";
  }
  return out;
}

/** Keeps only the terms that belong to the structure. */
export function pickTerms(dealType: DealType, terms: OfferTerms): OfferTerms {
  return Object.fromEntries(TERM_FIELDS[dealType].map((f) => [f.key, terms[f.key]])) as OfferTerms;
}

export function describeTerms(dealType: DealType, t: OfferTerms, currency: string): string {
  switch (dealType) {
    case "EQUITY":
      return `${t.equityPercent}% equity at a ${formatMoney(t.valuation ?? 0, currency)} pre-money valuation`;
    case "MUSHARAKAH":
      return `Musharakah: ${t.profitSharePercent}% of profit to the investor for ${t.termMonths} months, losses shared by capital`;
    case "MUDARABAH":
      return `Mudarabah: ${t.profitSharePercent}% of profit to the investor for ${t.termMonths} months`;
    case "REVENUE_SHARE":
      return `${t.revenueSharePercent}% of revenue until ${t.returnCapMultiple}× is repaid, within ${t.termMonths} months`;
  }
}

/** Whose turn it is on an offer, or null when the negotiation is over. */
export function turnOf(status: string): Party | null {
  if (status === "AWAITING_FOUNDER") return "FOUNDER";
  if (status === "AWAITING_INVESTOR") return "INVESTOR";
  return null;
}

export type CapacityInput = {
  amount: number;
  currency: string;
  minTicket: number;
  raiseTarget: number;
  multipleInvestors: boolean;
  /** Total of other offers already accepted in this round. */
  acceptedElsewhere: number;
  /** The investor's verified budget and what they have committed in other rounds, in PKR. */
  investorBudgetPkr: number;
  investorCommittedPkr: number;
};

/** Why an offer amount can't be made or accepted, or null. */
export function amountBlocker(c: CapacityInput): string | null {
  const fmt = (n: number) => formatMoney(n, c.currency);
  if (!(c.amount > 0)) return "Enter an amount";
  if (toPkr(c.amount, c.currency) < MIN_AMOUNT_PKR) return `The platform minimum is PKR ${MIN_AMOUNT_PKR.toLocaleString("en-US")}`;
  if (c.amount < c.minTicket) return `The minimum investment for this pitch is ${fmt(c.minTicket)}`;
  const remaining = c.raiseTarget - c.acceptedElsewhere;
  if (c.amount > remaining) return remaining > 0 ? `Only ${fmt(remaining)} of the round is still open` : "The round is fully committed";
  if (!c.multipleInvestors && c.amount !== c.raiseTarget) return `This round takes a single investor for the full ${fmt(c.raiseTarget)}`;
  if (c.investorCommittedPkr + toPkr(c.amount, c.currency) > c.investorBudgetPkr) return "This would exceed the investor's verified budget";
  return null;
}
