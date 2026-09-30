// Plain (number-based) view of a pitch, shared by validation, deal maths and rendering.
import type { Pitch, PitchCostItem, PitchMilestone, Prisma } from "@prisma/client";

export type TeamMember = { name: string; role: string; commitment: string; equityPercent: number | null };
export type Projection = { year: number; revenue: number | null; costs: number | null; cashFlow: number | null };
export type Risk = { category: string; risk: string; mitigation: string };
export type CostItem = { category: string; item: string; quantity: number; unitCost: number; timing: string | null };
export type Milestone = { month: number; title: string; successMetric: string; budget: number; owner: string | null };

type Money = Prisma.Decimal | null;
const num = (d: Money) => (d === null ? null : Number(d));

export type PitchData = Omit<
  Pitch,
  | "revenueLast12" | "expensesLast12" | "monthlyRevenue" | "amount" | "minTicket" | "equityPercent" | "profitSharePercent"
  | "founderCapital" | "revenueSharePercent" | "returnCapMultiple" | "valuation" | "teamMembers" | "projections" | "risks"
> & {
  revenueLast12: number | null;
  expensesLast12: number | null;
  monthlyRevenue: number | null;
  amount: number | null;
  minTicket: number | null;
  equityPercent: number | null;
  profitSharePercent: number | null;
  founderCapital: number | null;
  revenueSharePercent: number | null;
  returnCapMultiple: number | null;
  valuation: number | null;
  teamMembers: TeamMember[];
  projections: Projection[];
  risks: Risk[];
  costItems: CostItem[];
  milestones: Milestone[];
};

export function toPitchData(p: Pitch & { costItems: PitchCostItem[]; milestones: PitchMilestone[] }): PitchData {
  const { costItems, milestones, ...rest } = p;
  return {
    ...rest,
    revenueLast12: num(p.revenueLast12),
    expensesLast12: num(p.expensesLast12),
    monthlyRevenue: num(p.monthlyRevenue),
    amount: num(p.amount),
    minTicket: num(p.minTicket),
    equityPercent: num(p.equityPercent),
    profitSharePercent: num(p.profitSharePercent),
    founderCapital: num(p.founderCapital),
    revenueSharePercent: num(p.revenueSharePercent),
    returnCapMultiple: num(p.returnCapMultiple),
    valuation: num(p.valuation),
    teamMembers: (p.teamMembers ?? []) as TeamMember[],
    projections: (p.projections ?? []) as Projection[],
    risks: (p.risks ?? []) as Risk[],
    costItems: [...costItems]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ category: c.category, item: c.item, quantity: Number(c.quantity), unitCost: Number(c.unitCost), timing: c.timing })),
    milestones: [...milestones]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({ month: m.month, title: m.title, successMetric: m.successMetric, budget: Number(m.budget), owner: m.owner })),
  };
}
