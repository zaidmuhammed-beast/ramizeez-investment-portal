// Deal maths for the proposal and costing sections. Pure and client-safe.
import { PLATFORM_TERMS } from "@/config/platform";

/** Maximum stake investors can take: RamiZeeZ holds its share, founders keep at least 10%. */
export const MAX_INVESTOR_EQUITY = 100 - PLATFORM_TERMS.businessSharePercent - 10;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The 10% success fee and what the business actually receives. Costing and milestones must add up to `net`. */
export function netOfFee(amount: number) {
  const fee = round2((amount * PLATFORM_TERMS.successFeePercent) / 100);
  return { amount, fee, net: round2(amount - fee) };
}

export type Ownership = { investors: number; ramizeez: number; founders: number };

/** Ownership after the raise for an equity deal. RamiZeeZ's share applies to every funded business. */
export function ownershipAfter(equityPercent: number | null): Ownership {
  const investors = equityPercent ?? 0;
  const ramizeez = PLATFORM_TERMS.businessSharePercent;
  return { investors, ramizeez, founders: round2(100 - investors - ramizeez) };
}

/** The pre-money valuation implied by `amount` buying `equityPercent`. */
export function impliedPreMoney(amount: number, equityPercent: number): number {
  return round2(amount / (equityPercent / 100) - amount);
}

/** Revenue share: the total investors receive before payments stop. */
export const revenueShareTotal = (amount: number, capMultiple: number) => round2(amount * capMultiple);

export const costTotal = (items: { quantity: number; unitCost: number }[]) =>
  round2(items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0));

export const milestoneTotal = (items: { budget: number }[]) => round2(items.reduce((sum, m) => sum + (Number(m.budget) || 0), 0));

/** Totals may differ from the target by rounding (≤ 1 unit). */
export const matchesTarget = (total: number, target: number) => Math.abs(total - target) <= 1;
