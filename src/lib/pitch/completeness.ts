// What a pitch still needs before it can be submitted. Pure: used by the builder, the
// submit action and the screening view.
import { MIN_AMOUNT_PKR, formatMoney, meetsMinimum, minimumIn } from "@/config/platform";
import type { PitchData } from "./data";
import type { PitchSectionKey } from "./sections";
import { MAX_INVESTOR_EQUITY, costTotal, matchesTarget, milestoneTotal, netOfFee } from "./deal";

export type Issue = { section: PitchSectionKey; field?: string; message: string };

const MIN_COST_ITEMS = 3;
const MIN_MILESTONES = 3;
const MIN_RISKS = 3;
const PROJECTION_YEARS = 5;

const text = (v: string | null | undefined, min = 1) => !!v && v.trim().length >= min;
const pct = (v: number | null, lo: number, hi: number) => v !== null && v > lo && v <= hi;

export function pitchIssues(p: PitchData): Issue[] {
  const out: Issue[] = [];
  const need = (section: PitchSectionKey, ok: boolean, message: string, field?: string) => {
    if (!ok) out.push({ section, field, message });
  };
  const min = (c: string) => formatMoney(minimumIn(c), c);

  // Overview
  need("overview", text(p.title), "Give the pitch a title", "title");
  need("overview", text(p.sector), "Choose a sector", "sector");
  need("overview", text(p.country) && text(p.city), "Enter where the business operates", "city");
  need("overview", text(p.oneLiner, 20), "Write a one-line summary (at least 20 characters)", "oneLiner");
  need("overview", text(p.problem, 80), "Describe the problem (at least 80 characters)", "problem");
  need("overview", text(p.solution, 80), "Describe your solution (at least 80 characters)", "solution");
  need("overview", text(p.whyNow, 30), "Explain why now", "whyNow");

  // Team
  need("team", text(p.teamExperience, 150), "Explain your experience and knowledge of this business (at least 150 characters)", "teamExperience");
  need("team", p.teamMembers.length > 0, "List at least one team member (yourself)", "teamMembers");
  const equityTotal = p.teamMembers.reduce((s, m) => s + (m.equityPercent ?? 0), 0);
  need("team", equityTotal <= 100, "Team equity adds up to more than 100%", "teamMembers");

  // Market
  need("market", text(p.targetCustomers, 50), "Describe your target customers", "targetCustomers");
  need("market", text(p.marketSize, 50), "Estimate the market size and give sources", "marketSize");
  need("market", text(p.competitors, 10), "List your competitors", "competitors");
  need("market", text(p.differentiation, 50), "Explain what makes you different", "differentiation");

  // Business model
  need("model", text(p.revenueModel, 50), "Explain how the business makes money", "revenueModel");
  need("model", text(p.pricing, 10), "Describe your pricing", "pricing");
  need("model", text(p.unitEconomics, 50), "Give your unit economics (cost per unit, margin, acquisition cost)", "unitEconomics");
  need("model", text(p.channels, 20), "Describe your sales and marketing channels", "channels");

  // Current status
  if (p.type === "EXISTING") {
    need("traction", p.startedYear !== null, "Enter the year the business started", "startedYear");
    need("traction", p.employees !== null, "Enter the number of employees", "employees");
    need("traction", p.revenueLast12 !== null && p.expensesLast12 !== null, "Enter revenue and expenses for the last 12 months", "revenueLast12");
    need("traction", text(p.tractionNotes, 50), "Describe your traction: customers, growth, key numbers", "tractionNotes");
  }

  // The ask
  const amount = p.amount;
  need("ask", amount !== null && meetsMinimum(amount, p.currency), `Raise at least PKR ${MIN_AMOUNT_PKR.toLocaleString("en-US")} (≈ ${min(p.currency)})`, "amount");
  need("ask", p.minTicket !== null && meetsMinimum(p.minTicket, p.currency), `The minimum investment must be at least PKR ${MIN_AMOUNT_PKR.toLocaleString("en-US")} (≈ ${min(p.currency)})`, "minTicket");
  if (amount !== null && p.minTicket !== null) need("ask", p.minTicket <= amount, "The minimum investment can't exceed the amount raised", "minTicket");
  need("ask", !!p.dealType, "Choose a deal structure", "dealType");
  if (p.dealType === "EQUITY") {
    need("ask", pct(p.equityPercent, 0, MAX_INVESTOR_EQUITY), `Offer investors between 0% and ${MAX_INVESTOR_EQUITY}% equity`, "equityPercent");
    need("ask", p.valuation !== null && p.valuation > 0, "Enter the pre-money valuation", "valuation");
    need("ask", text(p.valuationMethod, 30), "Explain how you arrived at the valuation", "valuationMethod");
  }
  if (p.dealType === "MUSHARAKAH" || p.dealType === "MUDARABAH") {
    need("ask", pct(p.profitSharePercent, 0, 99), "Set the investors' share of profit (1–99%)", "profitSharePercent");
    need("ask", p.termMonths !== null && p.termMonths >= 6, "Set the partnership term (at least 6 months)", "termMonths");
  }
  if (p.dealType === "MUSHARAKAH") need("ask", p.founderCapital !== null, "Enter the capital you contribute to the partnership (0 if none)", "founderCapital");
  if (p.dealType === "REVENUE_SHARE") {
    need("ask", pct(p.revenueSharePercent, 0, 50), "Set the share of revenue paid to investors (up to 50%)", "revenueSharePercent");
    need("ask", p.returnCapMultiple !== null && p.returnCapMultiple >= 1 && p.returnCapMultiple <= 5, "Set the repayment cap (1×–5× the amount raised)", "returnCapMultiple");
    need("ask", p.termMonths !== null && p.termMonths >= 6, "Set the maximum term (at least 6 months)", "termMonths");
  }
  need("ask", text(p.expectedReturn, 30), "Explain the expected return for investors", "expectedReturn");
  need("ask", text(p.exitOptions, 20), "Describe the exit or repayment options", "exitOptions");

  // Costing & roadmap must add up to what the business receives after the fee.
  const target = amount !== null ? netOfFee(amount).net : null;
  need("costing", p.costItems.length >= MIN_COST_ITEMS, `Add at least ${MIN_COST_ITEMS} cost lines`, "items");
  if (target !== null && p.costItems.length) {
    const total = costTotal(p.costItems);
    need("costing", matchesTarget(total, target), `Cost lines total ${formatMoney(total, p.currency)}, but must equal ${formatMoney(target, p.currency)} (the raise after the 10% RamiZeeZ fee)`, "items");
  }
  need("roadmap", p.milestones.length >= MIN_MILESTONES, `Add at least ${MIN_MILESTONES} milestones`, "items");
  if (p.milestones.length) {
    need("roadmap", p.milestones.every((m, i) => i === 0 || m.month >= p.milestones[i - 1].month), "List milestones in date order", "items");
    need("roadmap", p.milestones.every((m) => m.budget > 0), "Every milestone needs a budget", "items");
    if (target !== null) {
      const total = milestoneTotal(p.milestones);
      need("roadmap", matchesTarget(total, target), `Milestone budgets total ${formatMoney(total, p.currency)}, but must equal ${formatMoney(target, p.currency)}`, "items");
    }
  }

  // Financials
  const years = p.projections.filter((y) => y.revenue !== null && y.costs !== null);
  need("financials", years.length >= PROJECTION_YEARS, `Give revenue and costs for all ${PROJECTION_YEARS} years`, "projections");
  need("financials", text(p.projectionAssumptions, 80), "Explain the assumptions behind your projections", "projectionAssumptions");

  // Risks
  need("risks", p.risks.length >= MIN_RISKS, `Describe at least ${MIN_RISKS} risks and how you will handle them`, "items");
  need("risks", text(p.failurePlan, 50), "Explain what happens to investors' money if the business fails", "failurePlan");

  // Media
  need("media", !!p.deckFileId, "Upload your pitch deck (PDF)", "deck");

  return out;
}

export const issuesBySection = (issues: Issue[]) =>
  issues.reduce<Partial<Record<PitchSectionKey, Issue[]>>>((acc, i) => ((acc[i.section] ??= []).push(i), acc), {});
