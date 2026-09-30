import { describe, expect, it } from "vitest";
import type { PitchData } from "@/lib/pitch/data";
import { pitchIssues } from "@/lib/pitch/completeness";
import { MAX_INVESTOR_EQUITY, costTotal, impliedPreMoney, matchesTarget, netOfFee, ownershipAfter, revenueShareTotal } from "@/lib/pitch/deal";
import { canonicalJson, fingerprint, submissionSnapshot } from "@/lib/pitch/fingerprint";
import { scorePercent, transitionBlocker, type TransitionContext } from "@/lib/pitch/workflow";

const long = (s: string, n = 160) => (s + " ").repeat(Math.ceil(n / (s.length + 1))).trim();

/** A complete PKR 1,000,000 equity pitch: costs and milestones add up to the PKR 900,000 net. */
function completePitch(overrides: Partial<PitchData> = {}): PitchData {
  return {
    id: "p1", founderId: "u1", status: "DRAFT", type: "IDEA", savedSections: [], confidentialFields: [],
    title: "Organic dairy delivery", sector: "Food & beverage", country: "PK", city: "Lahore",
    oneLiner: "Farm-fresh milk delivered daily to homes", problem: long("Families cannot trust the milk they buy"), solution: long("Traceable milk from our own farms"),
    whyNow: long("Rising food safety awareness", 40),
    teamExperience: long("Ten years running a dairy farm and a distribution business"), teamMembers: [{ name: "Ahmed", role: "CEO", commitment: "FULL_TIME", equityPercent: 100 }],
    advisors: null, plannedHires: null,
    targetCustomers: long("Middle-class families in Lahore", 60), marketSize: long("PKR 50bn dairy market (PDDB)", 60), competitors: long("Nestlé, local milkmen", 40), differentiation: long("Traceability and daily delivery", 60),
    revenueModel: long("Monthly subscriptions", 60), pricing: "PKR 250 per litre", unitEconomics: long("Cost PKR 170, margin PKR 80 per litre", 60), channels: "Instagram and referrals", partners: null,
    startedYear: null, employees: null, revenueLast12: null, expensesLast12: null, monthlyRevenue: null, customers: null, tractionNotes: null, liabilities: null, existingInvestors: null,
    currency: "PKR", amount: 1_000_000, minTicket: 100_000, multipleInvestors: true, dealType: "EQUITY",
    equityPercent: 20, profitSharePercent: null, founderCapital: null, revenueSharePercent: null, returnCapMultiple: null, termMonths: null,
    valuation: 4_000_000, valuationMethod: long("Multiple of projected year-two revenue", 40), nonFinancialAsks: null,
    expectedReturn: long("3x in five years", 40), exitOptions: "Founder buy-back after year 5",
    projections: [1, 2, 3, 4, 5].map((year) => ({ year, revenue: year * 1_000_000, costs: year * 800_000, cashFlow: null })),
    projectionAssumptions: long("Subscribers grow 20% a month in year one", 90),
    risks: [
      { category: "MARKET", risk: "Price competition", mitigation: "Premium positioning" },
      { category: "OPERATIONAL", risk: "Cold chain failure", mitigation: "Backup generators" },
      { category: "FINANCIAL", risk: "Slow payments", mitigation: "Prepaid subscriptions" },
    ],
    failurePlan: long("Refrigerated vans and equipment are sold and proceeds returned", 60),
    videoUrl: null, deckFileId: "f1", imageFileIds: [], documentFileIds: [],
    teaser: null, screeningScore: null, assignedToId: null, submittedAt: null, listedAt: null,
    createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
    costItems: [
      { category: "CAPEX", item: "Refrigerated van", quantity: 1, unitCost: 500_000, timing: "Month 1" },
      { category: "MARKETING", item: "Launch campaign", quantity: 1, unitCost: 200_000, timing: "Month 2" },
      { category: "CONTINGENCY", item: "Buffer", quantity: 1, unitCost: 200_000, timing: null },
    ],
    milestones: [
      { month: 1, title: "Van on the road", successMetric: "First 100 subscribers", budget: 500_000, owner: null },
      { month: 3, title: "Launch campaign", successMetric: "500 subscribers", budget: 200_000, owner: null },
      { month: 6, title: "Break-even", successMetric: "Positive monthly cash flow", budget: 200_000, owner: null },
    ],
    ...overrides,
  };
}

const fields = (p: PitchData) => pitchIssues(p).map((i) => `${i.section}.${i.field}`);

describe("deal maths", () => {
  it("takes the 10% fee from the raise", () => {
    expect(netOfFee(1_000_000)).toEqual({ amount: 1_000_000, fee: 100_000, net: 900_000 });
  });
  it("splits ownership with RamiZeeZ's 25%", () => {
    expect(ownershipAfter(20)).toEqual({ investors: 20, ramizeez: 25, founders: 55 });
    expect(MAX_INVESTOR_EQUITY).toBe(65);
  });
  it("computes implied valuation and revenue-share totals", () => {
    expect(impliedPreMoney(1_000_000, 20)).toBe(4_000_000);
    expect(revenueShareTotal(1_000_000, 1.5)).toBe(1_500_000);
    expect(costTotal([{ quantity: 2, unitCost: 1500.5 }, { quantity: 3, unitCost: 100 }])).toBe(3301);
    expect(matchesTarget(900_000.4, 900_000)).toBe(true);
    expect(matchesTarget(899_000, 900_000)).toBe(false);
  });
});

describe("pitch completeness", () => {
  it("accepts a complete pitch", () => {
    expect(pitchIssues(completePitch())).toEqual([]);
  });

  it("requires costs and milestones to equal the raise after the fee", () => {
    const p = completePitch({ costItems: completePitch().costItems.map((c, i) => (i === 0 ? { ...c, unitCost: 600_000 } : c)) });
    const issue = pitchIssues(p).find((i) => i.section === "costing");
    expect(issue?.message).toMatch(/must equal PKR 900,000/);
    const q = completePitch({ milestones: completePitch().milestones.slice(0, 2) });
    expect(fields(q)).toContain("roadmap.items");
  });

  it("enforces the PKR 100,000 minimum on the raise and the ticket", () => {
    expect(fields(completePitch({ amount: 90_000 }))).toContain("ask.amount");
    expect(fields(completePitch({ minTicket: 50_000 }))).toContain("ask.minTicket");
    expect(fields(completePitch({ minTicket: 2_000_000 }))).toContain("ask.minTicket");
  });

  it("validates each deal structure", () => {
    expect(fields(completePitch({ equityPercent: 70 }))).toContain("ask.equityPercent");
    const musharakah = completePitch({ dealType: "MUSHARAKAH", equityPercent: null, valuation: null, profitSharePercent: 40, termMonths: 36, founderCapital: 0 });
    expect(pitchIssues(musharakah)).toEqual([]);
    expect(fields({ ...musharakah, founderCapital: null })).toContain("ask.founderCapital");
    const rev = completePitch({ dealType: "REVENUE_SHARE", equityPercent: null, valuation: null, revenueSharePercent: 8, returnCapMultiple: 1.6, termMonths: 48 });
    expect(pitchIssues(rev)).toEqual([]);
    expect(fields({ ...rev, returnCapMultiple: 7 })).toContain("ask.returnCapMultiple");
  });

  it("requires current-status figures only for operating businesses", () => {
    expect(fields(completePitch({ type: "EXISTING" }))).toEqual(expect.arrayContaining(["traction.startedYear", "traction.revenueLast12", "traction.tractionNotes"]));
  });

  it("requires the deck, five projection years and three risks", () => {
    expect(fields(completePitch({ deckFileId: null }))).toContain("media.deck");
    expect(fields(completePitch({ projections: completePitch().projections.slice(0, 4) }))).toContain("financials.projections");
    expect(fields(completePitch({ risks: [] }))).toContain("risks.items");
  });
});

describe("screening workflow", () => {
  const base: TransitionContext = {
    from: "COMMITTEE", to: "LISTED", actorId: "committee", note: "", hasScreeningReview: true, diligenceComplete: true,
    founderTier: 4, teaser: "Food & beverage · Lahore · idea stage, raising PKR 1M for a traceable dairy subscription", earlierReviewerIds: ["analyst"],
  };
  it("allows a verified founder's pitch to be listed by a fresh committee member", () => {
    expect(transitionBlocker(base)).toBeNull();
  });
  it("blocks listing without Tier 4, a teaser, or by an earlier reviewer", () => {
    expect(transitionBlocker({ ...base, founderTier: 3 })).toMatch(/Tier 4/);
    expect(transitionBlocker({ ...base, teaser: "short" })).toMatch(/teaser/);
    expect(transitionBlocker({ ...base, actorId: "analyst" })).toMatch(/different committee member/);
  });
  it("needs a scorecard, a full checklist and feedback at the right stages", () => {
    expect(transitionBlocker({ ...base, from: "SCREENING", to: "DUE_DILIGENCE", hasScreeningReview: false })).toMatch(/scorecard/);
    expect(transitionBlocker({ ...base, from: "DUE_DILIGENCE", to: "COMMITTEE", diligenceComplete: false })).toMatch(/due-diligence/);
    expect(transitionBlocker({ ...base, from: "SCREENING", to: "RETURNED" })).toMatch(/feedback/);
    expect(transitionBlocker({ ...base, from: "SCREENING", to: "RETURNED", note: "Please add quotes" })).toBeNull();
  });
  it("rejects moves that skip stages", () => {
    expect(transitionBlocker({ ...base, from: "SUBMITTED", to: "LISTED" })).toMatch(/can't move/);
  });
  it("scores the scorecard out of 100", () => {
    expect(scorePercent({ team: 5, market: 5, model: 5, financials: 5, roadmap: 5, risk: 5 })).toBe(100);
    expect(scorePercent({ team: 3, market: 3, model: 3, financials: 3, roadmap: 3, risk: 3 })).toBe(60);
  });
});

describe("submission fingerprint", () => {
  it("is independent of key order and ignores workflow fields", () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
    const a = fingerprint(submissionSnapshot(completePitch(), { f1: "abc" }));
    const b = fingerprint(submissionSnapshot(completePitch({ status: "SUBMITTED", updatedAt: new Date(), screeningScore: 80 }), { f1: "abc" }));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("changes when the content or a file changes", () => {
    const a = fingerprint(submissionSnapshot(completePitch(), { f1: "abc" }));
    expect(fingerprint(submissionSnapshot(completePitch({ problem: "Different" }), { f1: "abc" }))).not.toBe(a);
    expect(fingerprint(submissionSnapshot(completePitch(), { f1: "abd" }))).not.toBe(a);
  });
});
