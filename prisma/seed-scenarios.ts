// Fictional businesses, deals and Tank sessions for demonstrating a test (staging) site to
// clients. Every business, person and figure here is made up.
//
// Runs during the Netlify build while DEMO_SCENARIOS is set (scripts/netlify-build.sh):
//   DEMO_SCENARIOS=create  add the scenarios if they aren't there yet (safe to leave on)
//   DEMO_SCENARIOS=reset   delete them and create them again with fresh dates
// Locally: DEMO_SCENARIOS=create npx tsx --env-file=.env prisma/seed-scenarios.ts
//
// If the demo accounts exist (prisma/seed-demo.ts), they take part: demo.investor has offers,
// investments and Tank seats; demo.founder owns two businesses; demo.manager runs execution.
import { PrismaClient, type DealType, type PitchStatus, type Prisma, type User } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { PLATFORM_TERMS } from "../src/config/platform";
import { AGREEMENT_TEMPLATE_VERSION, agreementText, termSheetText } from "../src/config/agreements";
import { NDA_VERSION, ndaText, tankNdaText } from "../src/config/nda";
import { encryptString, sha256Hex } from "../src/lib/crypto";
import { pitchRef } from "../src/lib/investor/disclosure";
import { submissionSnapshot, fingerprint } from "../src/lib/pitch/fingerprint";
import { toPitchData } from "../src/lib/pitch/data";
import { duePeriods, periodLabel } from "../src/lib/execution/rules";
import type { OfferTerms } from "../src/lib/deals/offers";
import { verifiedApplicant } from "./demo-shared";

const db = new PrismaClient();
const DOMAIN = "demo.ramizeez.test";
const MARKER = `zara.hussain@${DOMAIN}`;
const now = Date.now();
const day = (n: number, hourUtc?: number) => {
  const d = new Date(now + n * 86_400_000);
  if (hourUtc !== undefined) d.setUTCHours(hourUtc, 0, 0, 0);
  return d;
};
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const key = () => Buffer.from(process.env.DATA_ENCRYPTION_KEY ?? "", "base64");
const ALL_SECTIONS = ["overview", "team", "market", "model", "traction", "ask", "costing", "roadmap", "financials", "risks", "media"];

// ─── People ───────────────────────────────────────────────────────────────────

let phoneSeq = 1000;
const nextPhone = () => `+9230010${String(phoneSeq++).padStart(5, "0")}`;
let unusableHash: string;

async function person(first: string, last: string, extra: Partial<Prisma.UserCreateInput>): Promise<User> {
  const email = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "") + `@${DOMAIN}`;
  return db.user.create({
    data: {
      email,
      phone: nextPhone(),
      firstName: first,
      lastName: last,
      countryOfResidence: "PK",
      roles: ["FOUNDER"],
      passwordHash: unusableHash, // fictional people can't sign in
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      ...extra,
    },
  });
}

const founder = (first: string, last: string, city: string, sector: string) =>
  person(first, last, {
    ...verifiedApplicant(`Fictional founder for the RamiZeeZ demo. Runs a ${sector.toLowerCase()} business in ${city}.`),
    founderProfile: { create: { stage: "EXISTING", sector, country: "PK", city, currency: "PKR", preferredDealTypes: ["EQUITY", "MUSHARAKAH"], platformTermsVersion: PLATFORM_TERMS.version, platformTermsAcceptedAt: new Date() } },
  });

const investor = (first: string, last: string, country: string) =>
  person(first, last, {
    roles: ["INVESTOR"],
    countryOfResidence: country,
    ...verifiedApplicant("Fictional investor for the RamiZeeZ demo."),
    investorProfile: {
      create: {
        investorType: "HIGH_NET_WORTH", currency: "PKR", declaredBudget: 10_000_000, verifiedBudget: 10_000_000, ticketMin: 250_000, ticketMax: 5_000_000,
        sourceOfFunds: ["BUSINESS"], sourceOfWealth: "Fictional", annualIncomeBand: "USD 150k–500k", netWorthBand: "USD 2M–10M", experience: "Fictional angel investor.",
        sectors: [], stages: [], dealTypes: ["EQUITY", "MUSHARAKAH", "MUDARABAH", "REVENUE_SHARE"], geographies: ["Pakistan", "Global"], riskAnswers: {}, riskScore: 6,
      },
    },
  });

const teamMember = (first: string, last: string, teamRole: Prisma.UserCreateInput["teamRole"]) => person(first, last, { roles: ["TEAM"], teamRole });

// ─── Pitches ──────────────────────────────────────────────────────────────────

type Row = [string, string, number, number, string?]; // category, item, qty, unit cost, timing
type Ms = [number, string, string, number]; // month, title, success metric, budget

type PitchSpec = {
  founder: User;
  title: string;
  type: "IDEA" | "EXISTING";
  sector: string;
  city: string;
  oneLiner: string;
  problem: string;
  solution: string;
  experience: string;
  customers: string;
  market: string;
  competitors: string;
  edge: string;
  revenueModel: string;
  pricing: string;
  unitEconomics: string;
  channels: string;
  traction?: { started: number; employees: number; revenue: number; expenses: number; monthly: number; customers: number; notes: string };
  amount: number;
  minTicket: number;
  multipleInvestors?: boolean;
  dealType: DealType;
  terms: OfferTerms & { founderCapital?: number };
  expectedReturn: string;
  exit: string;
  costs: Row[];
  milestones: Ms[];
  growth: number; // yearly revenue in year 1, grows ×1.6
  risks: [string, string, string][];
  failurePlan: string;
  status: PitchStatus;
  submittedDaysAgo?: number;
  listedDaysAgo?: number;
  teaser?: string;
  score?: number;
};

async function createPitch(s: PitchSpec, reviewers: { analyst: User; committee: User }) {
  const projections = [1, 2, 3, 4, 5].map((y) => {
    const revenue = Math.round(s.growth * 1.6 ** (y - 1));
    const costs = Math.round(revenue * (y === 1 ? 0.92 : 0.8));
    return { year: y, revenue, costs, cashFlow: revenue - costs };
  });
  const pitch = await db.pitch.create({
    data: {
      founderId: s.founder.id,
      status: s.status,
      type: s.type,
      savedSections: s.type === "IDEA" ? ALL_SECTIONS.filter((x) => x !== "traction") : ALL_SECTIONS,
      title: s.title,
      sector: s.sector,
      country: "PK",
      city: s.city,
      oneLiner: s.oneLiner,
      problem: s.problem,
      solution: s.solution,
      whyNow: "Digital payments, smartphone use and demand from overseas Pakistanis have all grown quickly since 2023.",
      teamExperience: s.experience,
      teamMembers: [{ name: `${s.founder.firstName} ${s.founder.lastName}`, role: "Founder & CEO", commitment: "Full time", equityPercent: null }],
      advisors: "A retired industry executive advises monthly.",
      targetCustomers: s.customers,
      marketSize: s.market,
      competitors: s.competitors,
      differentiation: s.edge,
      revenueModel: s.revenueModel,
      pricing: s.pricing,
      unitEconomics: s.unitEconomics,
      channels: s.channels,
      ...(s.traction
        ? {
            startedYear: s.traction.started,
            employees: s.traction.employees,
            revenueLast12: s.traction.revenue,
            expensesLast12: s.traction.expenses,
            monthlyRevenue: s.traction.monthly,
            customers: s.traction.customers,
            tractionNotes: s.traction.notes,
            liabilities: "No outstanding loans.",
          }
        : {}),
      currency: "PKR",
      amount: s.amount,
      minTicket: s.minTicket,
      multipleInvestors: s.multipleInvestors ?? true,
      dealType: s.dealType,
      equityPercent: s.terms.equityPercent,
      valuation: s.terms.valuation,
      valuationMethod: s.terms.valuation ? "Comparable local businesses and three-year revenue" : undefined,
      profitSharePercent: s.terms.profitSharePercent,
      founderCapital: s.terms.founderCapital,
      revenueSharePercent: s.terms.revenueSharePercent,
      returnCapMultiple: s.terms.returnCapMultiple,
      termMonths: s.terms.termMonths,
      nonFinancialAsks: "Introductions to distributors and RamiZeeZ marketing support.",
      expectedReturn: s.expectedReturn,
      exitOptions: s.exit,
      projections,
      projectionAssumptions: "Revenue grows 60% a year as capacity comes online; costs fall to 80% of revenue from year two.",
      risks: s.risks.map(([category, risk, mitigation]) => ({ category, risk, mitigation })),
      failurePlan: s.failurePlan,
      teaser: s.teaser,
      screeningScore: s.score,
      submittedAt: s.submittedDaysAgo !== undefined ? day(-s.submittedDaysAgo) : null,
      listedAt: s.listedDaysAgo !== undefined ? day(-s.listedDaysAgo) : null,
      createdAt: day(-(s.submittedDaysAgo ?? 3) - 7),
      costItems: { create: s.costs.map(([category, item, quantity, unitCost, timing], position) => ({ category, item, quantity, unitCost, timing, position })) },
      milestones: { create: s.milestones.map(([month, title, successMetric, budget], position) => ({ month, title, successMetric, budget, position, owner: "Founder" })) },
    },
    include: { costItems: true, milestones: true },
  });

  // Submission fingerprint and the pipeline history.
  if (s.submittedDaysAgo !== undefined) {
    const snap = submissionSnapshot(toPitchData(pitch), {});
    await db.pitchSubmission.create({ data: { pitchId: pitch.id, version: 1, fingerprint: fingerprint(snap), snapshot: snap as Prisma.InputJsonValue, termsVersion: PLATFORM_TERMS.version, submittedAt: day(-s.submittedDaysAgo) } });
    const path: PitchStatus[] = ["SUBMITTED", "SCREENING", "DUE_DILIGENCE", "COMMITTEE", "LISTED"];
    const target = s.status === "RETURNED" ? 2 : path.indexOf(s.status) + 1;
    const span = s.submittedDaysAgo - (s.listedDaysAgo ?? 0);
    let prev: PitchStatus = "DRAFT";
    for (let i = 0; i < Math.max(target, 1); i++) {
      const at = day(-s.submittedDaysAgo + (span * i) / Math.max(path.length - 1, 1));
      const to = path[i];
      await db.pitchEvent.create({ data: { pitchId: pitch.id, fromStatus: prev, toStatus: to, actorId: i === 0 ? s.founder.id : i === 4 ? reviewers.committee.id : reviewers.analyst.id, createdAt: at, note: to === "LISTED" ? "Approved by the investment committee." : null } });
      prev = to;
    }
    if (s.status === "RETURNED") {
      await db.pitchEvent.create({
        data: { pitchId: pitch.id, fromStatus: "SCREENING", toStatus: "RETURNED", actorId: reviewers.analyst.id, createdAt: day(-(s.submittedDaysAgo - 4)), note: "Please add your PMDC doctor registrations and a signed quotation for the video platform. The unit economics also need the cost per consultation." },
      });
    }
    if (s.score !== undefined) {
      const v = Math.round((s.score / 100) * 5);
      await db.pitchReview.create({
        data: { pitchId: pitch.id, stage: "SCREENING", reviewerId: reviewers.analyst.id, createdAt: day(-s.submittedDaysAgo + 1), scores: { team: v, market: Math.min(5, v + 1), model: v, financials: Math.max(1, v - 1), roadmap: v, risk: v }, notes: "Credible founder with real traction; costing is specific and checkable." },
      });
    }
    if (["DUE_DILIGENCE", "COMMITTEE", "LISTED"].includes(s.status)) {
      const done = s.status === "DUE_DILIGENCE" ? 4 : 6;
      const keys = ["identity", "documents", "financials", "costing", "legal", "references"];
      await db.pitchReview.create({ data: { pitchId: pitch.id, stage: "DUE_DILIGENCE", reviewerId: reviewers.analyst.id, createdAt: day(-s.submittedDaysAgo + 2), checklist: Object.fromEntries(keys.map((k, i) => [k, i < done])), notes: done < 6 ? "Waiting for two supplier references." : "All checks complete." } });
    }
  }
  return pitch;
}

// ─── Deals ────────────────────────────────────────────────────────────────────

type Pitch = Awaited<ReturnType<typeof createPitch>>;
const legalName = (u: User) => `${u.firstName} ${u.lastName}`;

async function grantDataRoom(pitch: Pitch, inv: User, daysAgo: number, amount: number) {
  const text = ndaText({ pitchRef: pitchRef(pitch.id), investorName: legalName(inv), date: dateOnly(day(-daysAgo)) }).join("\n");
  await db.ndaSignature.create({ data: { pitchId: pitch.id, investorId: inv.id, version: NDA_VERSION, typedName: legalName(inv), textHash: sha256Hex(text), signedAt: day(-daysAgo) } });
  await db.accessRequest.create({
    data: { pitchId: pitch.id, investorId: inv.id, intendedAmount: amount, currency: "PKR", message: "Interested in the numbers behind the roadmap.", status: "APPROVED", decidedById: pitch.founderId, decidedAs: "FOUNDER", decidedAt: day(-daysAgo + 1), createdAt: day(-daysAgo) },
  });
}

async function offer(pitch: Pitch, inv: User, o: { amount: number; terms: OfferTerms; daysAgo: number; conditions?: string; counter?: OfferTerms; accept?: boolean }) {
  const founderId = pitch.founderId;
  const revisions: Prisma.OfferRevisionCreateWithoutOfferInput[] = [
    { by: "INVESTOR", actor: { connect: { id: inv.id } }, action: "OFFER", amount: o.amount, terms: o.terms, conditions: o.conditions, createdAt: day(-o.daysAgo) },
  ];
  let terms = o.terms;
  if (o.counter) {
    terms = o.counter;
    revisions.push({ by: "FOUNDER", actor: { connect: { id: founderId } }, action: "COUNTER", amount: o.amount, terms: o.counter, note: "This keeps enough profit in the business to fund growth.", createdAt: day(-o.daysAgo + 1) });
  }
  if (o.accept) revisions.push({ by: o.counter ? "INVESTOR" : "FOUNDER", actor: { connect: { id: o.counter ? inv.id : founderId } }, action: "ACCEPT", amount: o.amount, terms, createdAt: day(-o.daysAgo + 2) });
  return db.offer.create({
    data: {
      pitchId: pitch.id,
      investorId: inv.id,
      status: o.accept ? "ACCEPTED" : o.counter ? "AWAITING_INVESTOR" : "AWAITING_FOUNDER",
      amount: o.amount,
      currency: "PKR",
      terms,
      conditions: o.conditions,
      lastBy: o.accept ? (o.counter ? "INVESTOR" : "FOUNDER") : o.counter ? "FOUNDER" : "INVESTOR",
      acceptedAt: o.accept ? day(-o.daysAgo + 2) : null,
      createdAt: day(-o.daysAgo),
      revisions: { create: revisions },
    },
  });
}

/** Issues a term sheet or agreement and records the given signatures (all three = signed). */
async function document(pitch: Pitch, off: { id: string; amount: Prisma.Decimal; terms: Prisma.JsonValue; conditions: string | null }, inv: User, founderUser: User, kind: "TERM_SHEET" | "AGREEMENT", signers: { party: "INVESTOR" | "FOUNDER" | "RAMIZEEZ"; user: User }[], daysAgo: number, legal: User) {
  const ctx = {
    ref: pitchRef(pitch.id),
    businessTitle: pitch.title,
    founderName: legalName(founderUser),
    investorName: legalName(inv),
    amount: Number(off.amount),
    currency: "PKR",
    dealType: pitch.dealType!,
    terms: off.terms as OfferTerms,
    conditions: off.conditions,
    milestones: pitch.milestones.map((m) => ({ month: m.month, title: m.title, budget: Number(m.budget) })),
    date: dateOnly(day(-daysAgo)),
  };
  const body = kind === "TERM_SHEET" ? termSheetText(ctx) : agreementText(ctx);
  const bodyHash = sha256Hex(body);
  const complete = signers.length === 3;
  return db.dealDocument.create({
    data: {
      offerId: off.id,
      kind,
      title: `${kind === "TERM_SHEET" ? "Term sheet" : "Investment agreement"}: ${ctx.ref}`,
      body,
      bodyHash,
      templateVersion: AGREEMENT_TEMPLATE_VERSION,
      issuedById: kind === "AGREEMENT" ? legal.id : null,
      status: complete ? "SIGNED" : "SIGNING",
      signedAt: complete ? day(-daysAgo + 1) : null,
      createdAt: day(-daysAgo),
      signatures: { create: signers.map((s, i) => ({ party: s.party, userId: s.user.id, typedName: legalName(s.user), bodyHash, signedAt: day(-daysAgo + 0.2 * (i + 1)) })) },
    },
  });
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

async function removeScenarios() {
  const people = await db.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, select: { id: true } });
  const ids = people.map((p) => p.id);
  const demoEmails = ["demo.founder@ramizeez.test", "demo.investor@ramizeez.test"];
  const demoAccounts = await db.user.findMany({ where: { email: { in: demoEmails } }, select: { id: true } });
  const pitches = await db.pitch.findMany({ where: { OR: [{ founderId: { in: ids } }, { founderId: { in: demoAccounts.map((d) => d.id) }, title: { in: ["Solar Chhat", "Kapra Loom"] } }] }, select: { id: true } });
  const pitchIds = pitches.map((p) => p.id);
  await db.tankSession.deleteMany({ where: { pitches: { some: { pitchId: { in: pitchIds } } } } });
  await db.pitch.deleteMany({ where: { id: { in: pitchIds } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`Removed ${pitchIds.length} demo businesses and ${ids.length} fictional people.`);
}

async function main() {
  if (process.env.APP_ENV === "production") throw new Error("Demo data is for test sites only: refusing to run with APP_ENV=production.");
  const mode = (process.env.DEMO_SCENARIOS ?? "create").toLowerCase();
  if (mode === "reset" || mode === "remove") await removeScenarios();
  if (mode === "remove") return;
  if (await db.user.findUnique({ where: { email: MARKER } })) {
    // The past Tank session is created last, so its presence means an earlier run finished.
    const finished = await db.tankSession.findFirst({ where: { title: "Food & dairy Tank", pitches: { some: { pitch: { founder: { email: { endsWith: `@${DOMAIN}` } } } } } } });
    if (finished) {
      console.log("Demo scenarios already exist, left unchanged (set DEMO_SCENARIOS=reset to recreate them).");
      return;
    }
    console.log("Found incomplete demo data from an earlier run that stopped partway: recreating it.");
    await removeScenarios();
  }
  if (key().length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be set to create the demo Tank sessions");
  unusableHash = await hash(randomBytes(32).toString("hex"), { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  // The site's own super admin (the seed account) hosts; fictional staff do the rest.
  const admin =
    (process.env.SEED_ADMIN_EMAIL && (await db.user.findUnique({ where: { email: process.env.SEED_ADMIN_EMAIL.toLowerCase() } }))) ||
    (await db.user.findFirst({ where: { teamRole: "SUPER_ADMIN" }, orderBy: { createdAt: "asc" } })) ||
    (await teamMember("Demo", "Admin", "SUPER_ADMIN"));
  const analyst = await teamMember("Ayesha", "Siddiqui", "DEAL_ANALYST");
  const committee = await teamMember("Bilal", "Ahmed", "INVESTMENT_COMMITTEE");
  const finance = await teamMember("Hina", "Raza", "FINANCE");
  const legal = await teamMember("Usman", "Tariq", "LEGAL");
  const manager = (await db.user.findUnique({ where: { email: "demo.manager@ramizeez.test" } })) ?? (await teamMember("Saad", "Karim", "EXECUTION_MANAGER"));
  const reviewers = { analyst, committee };

  const demoInvestor = (await db.user.findUnique({ where: { email: "demo.investor@ramizeez.test" } })) ?? (await investor("Farah", "Naqvi", "AE"));
  const demoFounder = (await db.user.findUnique({ where: { email: "demo.founder@ramizeez.test" } })) ?? (await founder("Adeel", "Chaudhry", "Islamabad", "Energy & renewables"));
  const omar = await investor("Omar", "Farooq", "GB");
  const sana = await investor("Sana", "Malik", "AE");

  const common = {
    experience: "Eight years in the industry, including four running my own operation. I know the suppliers, the customers and the costs first-hand.",
    risks: [
      ["MARKET", "A larger competitor cuts prices", "Loyalty through service quality and long-term customer contracts"],
      ["OPERATIONAL", "Key equipment breaks down", "Maintenance contract and a spare-parts budget in the costing"],
      ["FINANCIAL", "Customers pay late", "Advance payments and a 30-day credit limit"],
    ] as [string, string, string][],
    failurePlan: "Equipment is sold at market value and the proceeds are returned to investors in proportion to their capital, through RamiZeeZ.",
  };

  // 1. Submitted, waiting for screening.
  await createPitch(
    {
      ...common,
      founder: await founder("Zara", "Hussain", "Lahore", "Food & beverage"),
      title: "Chai Chowk",
      type: "EXISTING",
      sector: "Food & beverage",
      city: "Lahore",
      oneLiner: "Neighbourhood tea cafés with 15-minute delivery",
      problem: "Office workers and students in Lahore want good, affordable chai and snacks delivered fast, but delivery apps list few local tea cafés.",
      solution: "Small kiosks in dense neighbourhoods, each serving walk-in customers and deliveries within a 15-minute radius.",
      customers: "Office workers, students and families within 3 km of each kiosk in Gulberg, Johar Town and DHA.",
      market: "Out-of-home tea and snacks in Lahore: roughly PKR 40bn a year (own estimate from café surveys, 2025).",
      competitors: "Chaye Khana, Chai Wala franchises and roadside dhabas",
      edge: "Consistent recipes, 15-minute delivery and a loyalty app that already has 3,200 users.",
      revenueModel: "Walk-in and delivery sales of tea and snacks; corporate monthly tea subscriptions.",
      pricing: "PKR 180 per cup, PKR 350 average order",
      unitEconomics: "Average order PKR 350, cost PKR 210, contribution PKR 140 before rent. A kiosk breaks even at 60 orders a day.",
      channels: "Foodpanda, Instagram and office partnerships",
      traction: { started: 2023, employees: 7, revenue: 6_000_000, expenses: 5_100_000, monthly: 520_000, customers: 3200, notes: "One kiosk, profitable since month 9." },
      amount: 3_000_000,
      minTicket: 250_000,
      dealType: "REVENUE_SHARE",
      terms: { revenueSharePercent: 8, returnCapMultiple: 1.6, termMonths: 36 },
      expectedReturn: "8% of revenue until investors receive 1.6× their capital, projected within 30 months.",
      exit: "Repayment completes through the revenue share; no equity changes hands.",
      costs: [["CAPEX", "Kiosk fit-out (2 sites)", 2, 700_000], ["INVENTORY", "Tea, milk & packaging (3 months)", 1, 400_000], ["MARKETING", "Launch & delivery-app listings", 1, 300_000], ["SALARIES", "Baristas & riders (3 months)", 1, 450_000], ["CONTINGENCY", "Buffer", 1, 150_000]],
      milestones: [[2, "Two new kiosks open", "Both kiosks trading 7 days a week", 1_400_000], [4, "1,500 orders a week", "Weekly orders across all sites", 850_000], [6, "Break-even at all three sites", "Monthly profit at each kiosk", 450_000]],
      growth: 9_000_000,
      status: "SUBMITTED",
      submittedDaysAgo: 1,
    },
    reviewers,
  );

  // 2. Being screened.
  await createPitch(
    {
      ...common,
      founder: await founder("Hamza", "Iqbal", "Faisalabad", "Agriculture & livestock"),
      title: "AgriSense",
      type: "IDEA",
      sector: "Agriculture & livestock",
      city: "Faisalabad",
      oneLiner: "Low-cost soil sensors that tell smallholders when to water and fertilise",
      problem: "Punjab smallholders over-water and over-fertilise because they can't measure soil moisture or nutrients, losing up to 20% of yield and money.",
      solution: "A PKR 12,000 solar sensor that sends simple Urdu voice notes to the farmer's phone with what to do this week.",
      customers: "Farmers with 5–25 acres of wheat, cotton and sugarcane, through cooperatives.",
      market: "About 2 million farms of that size in Punjab (Agricultural Census 2024).",
      competitors: "Imported IoT sensors (10× the price) and agronomist visits",
      edge: "Built for local soil, priced for smallholders, and advice in Urdu voice notes rather than an app.",
      revenueModel: "Sensor sale plus PKR 300 a month for advice; cooperative bulk contracts.",
      pricing: "PKR 12,000 per sensor, PKR 300 per month",
      unitEconomics: "Sensor cost PKR 7,500; subscription margin PKR 220 a month; payback on a farmer in 8 months.",
      channels: "Farmer cooperatives, field days and seed dealers",
      amount: 3_000_000,
      minTicket: 200_000,
      dealType: "EQUITY",
      terms: { equityPercent: 15, valuation: 17_000_000 },
      expectedReturn: "Equity growth; an exit is expected through a strategic buyer (agri-inputs company) in 5–7 years.",
      exit: "Trade sale to a fertiliser or seed company, or a later funding round.",
      costs: [["TECHNOLOGY", "Sensor prototypes & field kits", 100, 12_000], ["SALARIES", "Two engineers (6 months)", 1, 900_000], ["MARKETING", "Farmer field days", 1, 300_000], ["LEGAL", "Company & IP registration", 1, 100_000], ["CONTINGENCY", "Buffer", 1, 200_000]],
      milestones: [[3, "100 sensors deployed", "Sensors reporting daily", 1_300_000], [6, "Paid pilot with 2 cooperatives", "Signed pilot contracts", 900_000], [9, "500 paying farmers", "Monthly subscriptions", 500_000]],
      growth: 3_500_000,
      status: "SCREENING",
      submittedDaysAgo: 4,
      score: 72,
    },
    reviewers,
  );

  // 3. In due diligence.
  await createPitch(
    {
      ...common,
      founder: await founder("Faraz", "Sheikh", "Karachi", "Logistics & transport"),
      title: "Karachi Cold Chain",
      type: "EXISTING",
      sector: "Logistics & transport",
      city: "Karachi",
      oneLiner: "Refrigerated trucking for seafood and dairy exporters",
      problem: "Exporters lose shipments because refrigerated trucks are scarce and unreliable between farms, factories and Port Qasim.",
      solution: "Contracted refrigerated trucks with live temperature tracking and a cold room at the port.",
      customers: "Seafood processors and dairy exporters in Karachi and interior Sindh.",
      market: "Cold-chain transport in Sindh: about PKR 25bn a year and growing with exports.",
      competitors: "Informal truck owners and two large logistics firms",
      edge: "Temperature logs shared with the customer, and a cold room at the port that removes waiting time.",
      revenueModel: "Monthly route contracts plus per-trip charges and cold-room storage fees.",
      pricing: "PKR 45,000 per trip; PKR 900 per pallet per day of storage",
      unitEconomics: "A truck earns PKR 1.1M a month on contract at 70% utilisation, with PKR 750k of costs.",
      channels: "Direct sales to exporters and freight forwarders",
      traction: { started: 2021, employees: 14, revenue: 18_000_000, expenses: 15_500_000, monthly: 1_600_000, customers: 11, notes: "Three trucks today, all on contract." },
      amount: 8_000_000,
      minTicket: 500_000,
      dealType: "MUSHARAKAH",
      terms: { profitSharePercent: 35, termMonths: 48, founderCapital: 2_000_000 },
      expectedReturn: "35% of profit to investors for 48 months; losses shared in proportion to capital.",
      exit: "Diminishing Musharakah: the founder buys back investors' share from year three.",
      costs: [["CAPEX", "Refrigerated trucks", 2, 2_800_000], ["CAPEX", "Cold room at Port Qasim", 1, 1_000_000], ["OPEX", "Fuel & maintenance (3 months)", 1, 400_000], ["CONTINGENCY", "Buffer", 1, 200_000]],
      milestones: [[2, "Two trucks on contract routes", "Signed route contracts", 5_600_000], [5, "Cold room operating", "Pallets stored per week", 1_200_000], [8, "Utilisation above 75%", "Truck utilisation", 400_000]],
      growth: 26_000_000,
      status: "DUE_DILIGENCE",
      submittedDaysAgo: 9,
      score: 80,
    },
    reviewers,
  );

  // 4. With the investment committee.
  await createPitch(
    {
      ...common,
      founder: await founder("Mahnoor", "Qureshi", "Multan", "Retail & e-commerce"),
      title: "Hunarmand",
      type: "EXISTING",
      sector: "Retail & e-commerce",
      city: "Multan",
      oneLiner: "An online marketplace selling Pakistani artisans' crafts to the diaspora",
      problem: "Skilled artisans earn little because middlemen take most of the price, while overseas Pakistanis struggle to buy authentic crafts.",
      solution: "A marketplace that pays artisans directly and ships to the UK, UAE and North America.",
      customers: "Overseas Pakistanis and craft buyers in the UK, UAE, USA and Canada.",
      market: "Handicraft exports of about USD 300M a year (TDAP 2025), mostly through intermediaries.",
      competitors: "Etsy sellers, Daraz and export houses",
      edge: "Verified artisans, fair prices shown to buyers, and shipping handled end to end.",
      revenueModel: "20% commission on each sale plus shipping margin.",
      pricing: "Average order USD 60",
      unitEconomics: "Commission and shipping margin of USD 14 per order; customer acquisition USD 6.",
      channels: "Instagram, diaspora community groups and Eid gifting campaigns",
      traction: { started: 2024, employees: 5, revenue: 4_500_000, expenses: 4_200_000, monthly: 450_000, customers: 1800, notes: "120 artisans onboarded." },
      amount: 2_500_000,
      minTicket: 150_000,
      dealType: "EQUITY",
      terms: { equityPercent: 12, valuation: 18_000_000 },
      expectedReturn: "Equity growth with a target exit in 5 years.",
      exit: "Acquisition by a regional e-commerce group, or a Series A.",
      costs: [["TECHNOLOGY", "Marketplace app & payments", 1, 900_000], ["INVENTORY", "Artisan advance orders", 1, 600_000], ["MARKETING", "Diaspora launch campaign", 1, 550_000], ["CONTINGENCY", "Buffer", 1, 200_000]],
      milestones: [[2, "App live with 150 artisans", "Artisans with live listings", 900_000], [4, "First export orders to UK and UAE", "Monthly export orders", 800_000], [8, "PKR 1.5M monthly sales", "Gross merchandise value", 550_000]],
      growth: 7_000_000,
      status: "COMMITTEE",
      submittedDaysAgo: 14,
      score: 84,
      teaser: "Retail & e-commerce · Multan · operating. A diaspora craft marketplace raising PKR 2.5M for equity.",
    },
    reviewers,
  );

  // 5. Returned to the founder with feedback.
  await createPitch(
    {
      ...common,
      founder: await founder("Nida", "Farhan", "Rawalpindi", "Healthcare"),
      title: "Sehat Ghar",
      type: "IDEA",
      sector: "Healthcare",
      city: "Rawalpindi",
      oneLiner: "Video consultations with women doctors for families in smaller towns",
      problem: "Families in smaller towns travel hours to see a specialist, and many women prefer a woman doctor who isn't available locally.",
      solution: "Affordable video consultations with women doctors, booked by phone, with medicines delivered by partner pharmacies.",
      customers: "Families in Punjab's smaller towns, and employers offering health benefits.",
      market: "Out-of-pocket outpatient spending in Punjab: about PKR 300bn a year.",
      competitors: "Sehat Kahani, Marham and local clinics",
      edge: "Phone booking for people without apps, and partner pharmacies for delivery.",
      revenueModel: "Per-consultation fees and monthly corporate plans.",
      pricing: "PKR 800 per consultation",
      unitEconomics: "Doctor cost PKR 450, platform cost PKR 80, margin PKR 270 per consultation.",
      channels: "Community health camps, WhatsApp and employers",
      amount: 2_000_000,
      minTicket: 100_000,
      dealType: "MUDARABAH",
      terms: { profitSharePercent: 35, termMonths: 24 },
      expectedReturn: "35% of profit to investors for 24 months.",
      exit: "The founder repays capital from profits at the end of the term.",
      costs: [["TECHNOLOGY", "Video consultation platform", 1, 800_000], ["SALARIES", "Two doctors (3 months)", 1, 600_000], ["MARKETING", "Community health camps", 1, 250_000], ["CONTINGENCY", "Buffer", 1, 150_000]],
      milestones: [[2, "Platform live with 10 doctors", "Doctors taking bookings", 900_000], [4, "1,000 consultations", "Completed consultations", 600_000], [6, "Two corporate clients", "Signed contracts", 300_000]],
      growth: 4_000_000,
      status: "RETURNED",
      submittedDaysAgo: 12,
    },
    reviewers,
  );

  // 6. Listed: offers coming in, Q&A, and a Tank slot (owned by demo.founder).
  const solar = await createPitch(
    {
      ...common,
      founder: demoFounder,
      title: "Solar Chhat",
      type: "EXISTING",
      sector: "Energy & renewables",
      city: "Islamabad",
      oneLiner: "Rooftop solar for middle-income homes, paid in monthly instalments",
      problem: "Electricity bills have tripled since 2022, but most families can't pay PKR 1M upfront for solar.",
      solution: "Rooftop systems installed and maintained by us, paid over 24 months from the savings on the bill.",
      customers: "Homeowners in Islamabad and Rawalpindi with monthly bills above PKR 25,000.",
      market: "Over 400,000 such homes in the twin cities alone.",
      competitors: "Solar installers selling for cash, and bank solar loans",
      edge: "No upfront cost, net-metering paperwork handled for the customer, and a 24-month service guarantee.",
      revenueModel: "Instalment payments with a margin on equipment and installation, plus maintenance plans.",
      pricing: "PKR 42,000 a month for 24 months (5 kW system)",
      unitEconomics: "System cost PKR 850k; customer pays PKR 1.0M over 24 months; default reserve 5%.",
      channels: "Referrals, housing-society WhatsApp groups and rooftop surveys",
      traction: { started: 2022, employees: 9, revenue: 14_000_000, expenses: 12_300_000, monthly: 1_200_000, customers: 64, notes: "64 homes installed; 2 late payers." },
      amount: 5_000_000,
      minTicket: 250_000,
      dealType: "MUDARABAH",
      terms: { profitSharePercent: 40, termMonths: 36 },
      expectedReturn: "40% of profit to investors for 36 months, projected at 22% a year on capital.",
      exit: "Capital repaid from instalment income by month 36.",
      costs: [["INVENTORY", "Panels & inverters for 30 homes", 1, 3_000_000], ["CAPEX", "Installation van & tools", 1, 800_000], ["MARKETING", "Rooftop surveys & referral drive", 1, 400_000], ["CONTINGENCY", "Buffer", 1, 300_000]],
      milestones: [[2, "15 homes installed", "Homes connected to net metering", 1_800_000], [4, "30 homes installed", "Homes connected", 1_800_000], [6, "PKR 900k monthly instalments", "Monthly collections", 900_000]],
      growth: 20_000_000,
      status: "LISTED",
      submittedDaysAgo: 20,
      listedDaysAgo: 10,
      score: 86,
      teaser: "Energy & renewables · Islamabad · operating. Rooftop solar on instalments, raising PKR 5M on Mudarabah terms.",
    },
    reviewers,
  );
  await grantDataRoom(solar, sana, 9, 2_000_000);
  await grantDataRoom(solar, demoInvestor, 7, 1_500_000);
  await db.ndaSignature.create({ data: { pitchId: solar.id, investorId: omar.id, version: NDA_VERSION, typedName: legalName(omar), textHash: sha256Hex("demo"), signedAt: day(-3) } });
  await db.accessRequest.create({ data: { pitchId: solar.id, investorId: omar.id, intendedAmount: 1_000_000, currency: "PKR", message: "Keen to understand default rates on the instalments.", createdAt: day(-2) } });
  const sanaOffer = await offer(solar, sana, { amount: 2_000_000, terms: { profitSharePercent: 40, termMonths: 36 }, daysAgo: 8, accept: true });
  await document(solar, sanaOffer, sana, demoFounder, "TERM_SHEET", [{ party: "INVESTOR", user: sana }, { party: "FOUNDER", user: demoFounder }, { party: "RAMIZEEZ", user: legal }], 5, legal);
  await offer(solar, demoInvestor, { amount: 1_500_000, terms: { profitSharePercent: 45, termMonths: 36 }, daysAgo: 2, conditions: "Quarterly site visits and monthly collection reports" });
  await db.deal.create({ data: { pitchId: solar.id, target: 5_000_000, currency: "PKR", status: "OPEN", createdAt: day(-6) } });
  await db.pitchQuestion.createMany({
    data: [
      { pitchId: solar.id, investorId: demoInvestor.id, body: "What happens if a customer stops paying the instalments?", status: "ANSWERED", shared: true, answer: "We keep a 5% default reserve, and the inverter can be remotely limited after 60 days of non-payment. Two customers have paid late so far; both caught up.", answeredAt: day(-4), moderatedById: analyst.id, moderatedAt: day(-5), createdAt: day(-6) },
      { pitchId: solar.id, investorId: sana.id, body: "Do you hold the net-metering licence yourselves, or does each customer apply?", status: "OPEN", moderatedById: analyst.id, moderatedAt: day(-1), createdAt: day(-2) },
      { pitchId: solar.id, investorId: omar.id, body: "Can you share your panel supplier's warranty terms?", status: "PENDING", createdAt: day(0) },
    ],
  });

  // 7. Listed a few days ago, no offers yet; invited to the next Tank.
  const parcel = await createPitch(
    {
      ...common,
      founder: await founder("Kamran", "Butt", "Karachi", "Logistics & transport"),
      title: "Pak Parcel",
      type: "EXISTING",
      sector: "Logistics & transport",
      city: "Karachi",
      oneLiner: "Same-day electric-bike delivery for online sellers",
      problem: "Small online sellers in Karachi pay high courier fees and wait two to three days for delivery inside the city.",
      solution: "Same-day delivery by electric bikes, booked through WhatsApp, with cash collected on delivery.",
      customers: "Instagram and Daraz sellers with 20–500 orders a month.",
      market: "Karachi's e-commerce parcels: over 150,000 a day.",
      competitors: "TCS, Leopards and informal riders",
      edge: "Same-day delivery at next-day prices, and cash remitted to the seller within 24 hours.",
      revenueModel: "Per-parcel delivery fees and cash-on-delivery handling.",
      pricing: "PKR 180 per parcel within the city",
      unitEconomics: "Rider cost PKR 90, bike and charging PKR 25, contribution PKR 65 per parcel.",
      channels: "Seller communities on Facebook and WhatsApp",
      traction: { started: 2023, employees: 22, revenue: 9_000_000, expenses: 8_600_000, monthly: 800_000, customers: 140, notes: "140 active sellers, 1,800 parcels a week." },
      amount: 4_000_000,
      minTicket: 200_000,
      dealType: "REVENUE_SHARE",
      terms: { revenueSharePercent: 6, returnCapMultiple: 1.5, termMonths: 48 },
      expectedReturn: "6% of revenue until investors receive 1.5× their capital.",
      exit: "Complete through the revenue share.",
      costs: [["CAPEX", "Electric bikes", 20, 120_000], ["TECHNOLOGY", "Routing & tracking app", 1, 600_000], ["SALARIES", "Rider onboarding & training", 1, 400_000], ["CONTINGENCY", "Buffer", 1, 200_000]],
      milestones: [[1, "20 bikes on the road", "Bikes in daily use", 2_400_000], [3, "3,000 deliveries a week", "Weekly deliveries", 800_000], [6, "Three merchant contracts", "Signed monthly contracts", 400_000]],
      growth: 15_000_000,
      status: "LISTED",
      submittedDaysAgo: 12,
      listedDaysAgo: 3,
      score: 78,
      teaser: "Logistics & transport · Karachi · operating. Same-day e-bike delivery raising PKR 4M on revenue-share terms.",
    },
    reviewers,
  );
  await db.watchlistItem.create({ data: { investorId: demoInvestor.id, pitchId: parcel.id } });

  // 8. Committed: offer accepted after a counter; agreement waiting for the founder's signature.
  const rabia = await founder("Rabia", "Anwar", "Lahore", "Food & beverage");
  const dairy = await createPitch(
    {
      ...common,
      founder: rabia,
      title: "Doodh Direct",
      type: "EXISTING",
      sector: "Food & beverage",
      city: "Lahore",
      oneLiner: "Farm-fresh milk delivered to Lahore homes every morning",
      problem: "Families in Lahore can't trust the purity of loose milk, and packaged milk is expensive and processed.",
      solution: "Traceable milk from partner farms, chilled and delivered by subscription before 7am.",
      customers: "Middle-income families with children in Lahore.",
      market: "Packaged and fresh milk in Lahore: about PKR 50bn a year.",
      competitors: "Nestlé, Haleeb and local milkmen",
      edge: "Farm-level testing shared with customers, and a daily cold chain.",
      revenueModel: "Monthly prepaid milk subscriptions.",
      pricing: "PKR 250 per litre",
      unitEconomics: "Cost PKR 170 per litre, margin PKR 80, acquisition cost PKR 400 per home.",
      channels: "Instagram, school partnerships and referrals",
      traction: { started: 2024, employees: 6, revenue: 5_400_000, expenses: 5_000_000, monthly: 480_000, customers: 210, notes: "210 homes subscribed." },
      amount: 1_500_000,
      minTicket: 100_000,
      multipleInvestors: false,
      dealType: "MUSHARAKAH",
      terms: { profitSharePercent: 40, termMonths: 36, founderCapital: 250_000 },
      expectedReturn: "40% of profit for 36 months, projected at 25% a year on capital.",
      exit: "The founder buys out the investor's share at year three.",
      costs: [["CAPEX", "Refrigerated van", 1, 700_000], ["MARKETING", "Launch campaign", 1, 300_000], ["INVENTORY", "Chillers & glass bottles", 1, 200_000], ["CONTINGENCY", "Buffer", 1, 150_000]],
      milestones: [[1, "Van on the road", "Daily deliveries from the van", 700_000], [3, "500 paying subscribers", "Active subscriptions", 400_000], [6, "Break-even", "Monthly cash flow positive", 250_000]],
      growth: 8_000_000,
      status: "LISTED",
      submittedDaysAgo: 55,
      listedDaysAgo: 40,
      score: 82,
      teaser: "Food & beverage · Lahore · operating. A traceable dairy subscription raising PKR 1.5M on Musharakah terms.",
    },
    reviewers,
  );
  await grantDataRoom(dairy, demoInvestor, 32, 1_500_000);
  const dairyOffer = await offer(dairy, demoInvestor, { amount: 1_500_000, terms: { profitSharePercent: 45, termMonths: 36 }, counter: { profitSharePercent: 40, termMonths: 36 }, daysAgo: 22, accept: true, conditions: "Monthly management accounts" });
  await document(dairy, dairyOffer, demoInvestor, rabia, "TERM_SHEET", [{ party: "INVESTOR", user: demoInvestor }, { party: "FOUNDER", user: rabia }, { party: "RAMIZEEZ", user: legal }], 18, legal);
  await document(dairy, dairyOffer, demoInvestor, rabia, "AGREEMENT", [{ party: "INVESTOR", user: demoInvestor }, { party: "RAMIZEEZ", user: legal }], 6, legal);
  await db.deal.create({ data: { pitchId: dairy.id, target: 1_500_000, currency: "PKR", status: "COMMITTED", createdAt: day(-20) } });

  // 9. Funded and in execution (owned by demo.founder, managed by demo.manager).
  const loom = await createPitch(
    {
      ...common,
      founder: demoFounder,
      title: "Kapra Loom",
      type: "EXISTING",
      sector: "Textiles & apparel",
      city: "Faisalabad",
      oneLiner: "Handloom cotton textiles for wholesale buyers and an online store",
      problem: "Faisalabad's small weavers can't meet wholesale order sizes, so buyers go to large mills and weavers lose work.",
      solution: "A shared weaving unit with modern looms, quality control and our own online store.",
      customers: "Wholesale buyers in Lahore and Karachi, and online customers in Pakistan and the Gulf.",
      market: "Pakistan's home textiles market: over PKR 200bn a year.",
      competitors: "Large mills and informal weaving units",
      edge: "Handloom quality at mill volumes, with consistent delivery dates.",
      revenueModel: "Wholesale orders plus online retail sales.",
      pricing: "PKR 1,200 per metre wholesale; PKR 3,500 average online order",
      unitEconomics: "Wholesale margin 28%, online margin 45% after shipping.",
      channels: "Wholesale fairs, Instagram and an online store",
      traction: { started: 2020, employees: 18, revenue: 22_000_000, expenses: 19_500_000, monthly: 1_900_000, customers: 26, notes: "26 wholesale buyers." },
      amount: 4_000_000,
      minTicket: 500_000,
      dealType: "EQUITY",
      terms: { equityPercent: 20, valuation: 16_000_000 },
      expectedReturn: "Equity growth and annual dividends from year two.",
      exit: "Founder buy-back or sale to a textile group after year five.",
      costs: [["CAPEX", "Power looms", 4, 450_000], ["INVENTORY", "Cotton yarn (3 months)", 1, 900_000], ["MARKETING", "Online store & wholesale fairs", 1, 500_000], ["CONTINGENCY", "Buffer", 1, 400_000]],
      milestones: [[1, "Looms installed and running", "Four looms producing daily", 1_800_000], [3, "Wholesale orders of PKR 2M a month", "Monthly wholesale invoices", 1_200_000], [6, "Online store at PKR 500k a month", "Monthly online sales", 600_000]],
      growth: 30_000_000,
      status: "LISTED",
      submittedDaysAgo: 125,
      listedDaysAgo: 110,
      score: 88,
      teaser: "Textiles & apparel · Faisalabad · operating. A handloom textile unit raising PKR 4M for equity.",
    },
    reviewers,
  );
  await grantDataRoom(loom, demoInvestor, 105, 2_500_000);
  await grantDataRoom(loom, omar, 104, 1_500_000);
  const loomA = await offer(loom, demoInvestor, { amount: 2_500_000, terms: { equityPercent: 12.5, valuation: 16_000_000 }, daysAgo: 100, accept: true, conditions: "Board observer seat" });
  const loomB = await offer(loom, omar, { amount: 1_500_000, terms: { equityPercent: 7.5, valuation: 16_000_000 }, daysAgo: 98, accept: true });
  for (const [o, inv] of [[loomA, demoInvestor], [loomB, omar]] as const) {
    const all = [{ party: "INVESTOR" as const, user: inv }, { party: "FOUNDER" as const, user: demoFounder }, { party: "RAMIZEEZ" as const, user: legal }];
    await document(loom, o, inv, demoFounder, "TERM_SHEET", all, 94, legal);
    await document(loom, o, inv, demoFounder, "AGREEMENT", all, 88, legal);
  }
  const fundedAt = day(-80); // long enough ago that at least two monthly reports are due
  const deal = await db.deal.create({
    data: {
      pitchId: loom.id, target: 4_000_000, currency: "PKR", status: "FUNDED", fundedTotal: 4_000_000, fundedAt, createdAt: day(-96),
      managerId: manager.id, health: "AMBER", healthNote: "Two looms were delayed at customs; wholesale orders are on track and the looms arrive next week.", healthUpdatedAt: day(-3),
    },
  });
  const [m1, m2] = [...loom.milestones].sort((a, b) => a.position - b.position);
  const posted = { status: "POSTED" as const, currency: "PKR", recordedById: finance.id, approvedById: admin.id };
  await db.escrowEntry.create({ data: { ...posted, dealId: deal.id, type: "DEPOSIT", amount: 2_500_000, offerId: loomA.id, reference: "MCB-TT-44120", approvedAt: day(-85), createdAt: day(-86) } });
  await db.escrowEntry.create({ data: { ...posted, dealId: deal.id, type: "DEPOSIT", amount: 1_500_000, offerId: loomB.id, reference: "HBL-TT-88031", approvedAt: day(-81), createdAt: day(-82) } });
  await db.escrowEntry.create({ data: { dealId: deal.id, type: "FEE", amount: 400_000, currency: "PKR", status: "POSTED", note: "RamiZeeZ success fee (automatic)", recordedById: null, approvedById: finance.id, approvedAt: day(-79), createdAt: day(-80) } });
  await db.milestoneClaim.create({ data: { dealId: deal.id, milestoneId: m1.id, evidence: "Two of four looms installed and producing 300 metres a day; photos and the installation invoice attached. The other two are at customs.", fileIds: [], status: "APPROVED", reviewedById: manager.id, reviewedAt: day(-55), createdAt: day(-58) } });
  await db.escrowEntry.create({ data: { ...posted, recordedById: finance.id, approvedById: admin.id, dealId: deal.id, type: "RELEASE", amount: 1_800_000, milestoneId: m1.id, reference: "RZ-REL-0001", approvedAt: day(-52), createdAt: day(-53) } });
  await db.milestoneClaim.create({ data: { dealId: deal.id, milestoneId: m2.id, evidence: "Wholesale invoices for last month total PKR 2.1M across 9 buyers. Invoices and bank statement attached.", fileIds: [], status: "SUBMITTED", createdAt: day(-2) } });
  await db.dealTask.createMany({
    data: [
      { dealId: deal.id, title: "Upload the power-loom maintenance contract", area: "EXECUTION", forFounder: true, status: "IN_PROGRESS", dueDate: day(5), founderNote: "Supplier is sending the signed copy on Monday.", createdById: manager.id },
      { dealId: deal.id, title: "Book a stall at the Expo Pakistan textiles hall", area: "MARKETING", assigneeId: manager.id, status: "TODO", dueDate: day(12), createdById: manager.id },
      { dealId: deal.id, title: "Register the Kapra Loom trademark", area: "LEGAL", assigneeId: legal.id, status: "DONE", completedAt: day(-20), dueDate: day(-21), createdById: manager.id },
    ],
  });
  // Every ended month has a report: earlier ones published, the latest one waiting for review.
  const periods = duePeriods(fundedAt, new Date());
  const figures = [
    { revenue: 1_850_000, costs: 1_640_000, cash: 2_600_000, customers: 27, metric: "Output 220 m/day", highlights: "First two looms running; four wholesale buyers placed repeat orders.", challenges: "Two looms held at customs for three weeks." },
    { revenue: 2_050_000, costs: 1_720_000, cash: 2_400_000, customers: 29, metric: "Output 300 m/day (+36%)", highlights: "Three new wholesale buyers signed, including a Karachi exporter.", challenges: "Cotton yarn prices rose 8%." },
    { revenue: 2_380_000, costs: 1_900_000, cash: 2_150_000, customers: 32, metric: "Wholesale PKR 2.1M", highlights: "Wholesale orders passed PKR 2M for the first time; the online store launched.", challenges: "One buyer paid 20 days late." },
  ];
  for (const [i, period] of periods.entries()) {
    const f = figures[Math.min(i, figures.length - 1)];
    const latest = i === periods.length - 1;
    await db.investorReport.create({
      data: {
        dealId: deal.id, period, revenue: f.revenue, costs: f.costs, cashInBank: f.cash, customers: f.customers, keyMetric: f.metric, highlights: f.highlights, challenges: f.challenges,
        asks: i === 0 ? "Introductions to buyers in the Gulf." : null, fileIds: [],
        ...(latest
          ? { status: "SUBMITTED" as const, submittedAt: day(-1) }
          : { status: "PUBLISHED" as const, reviewerId: manager.id, commentary: `Figures checked against the bank statement for ${periodLabel(period)}.`, submittedAt: day(-40 + i * 30), publishedAt: day(-38 + i * 30) }),
      },
    });
  }
  await db.campaign.createMany({
    data: [
      { dealId: deal.id, name: "Eid wholesale push", channel: "Instagram", objective: "20 new wholesale enquiries before Eid", budget: 150_000, currency: "PKR", startDate: day(-25), endDate: day(5), status: "LIVE", reach: 48_000, leads: 310, conversions: 24, resultsNote: "Carousel posts with fabric close-ups performed best.", ownerId: manager.id },
      { dealId: deal.id, name: "Expo Pakistan stall", channel: "Events", objective: "Meet 50 international buyers", budget: 250_000, currency: "PKR", startDate: day(20), status: "PLANNED", ownerId: manager.id },
    ],
  });

  // ─── Tank sessions ───
  const seal = (url: string) => encryptString(url, key());
  const seat = (sessionTitle: string, pitchIds: string[], u: User, status: "REQUESTED" | "APPROVED", joined?: Date) => ({
    userId: u.id,
    status,
    typedName: legalName(u),
    ndaHash: sha256Hex(tankNdaText({ sessionTitle, pitchRefs: pitchIds.map(pitchRef), investorName: legalName(u), date: dateOnly(new Date()) }).join("\n")),
    decidedById: status === "APPROVED" ? admin.id : null,
    decidedAt: status === "APPROVED" ? day(-1) : null,
    joinedAt: joined ?? null,
    joinCount: joined ? 1 : 0,
  });
  const upcomingTitle = "Clean energy & logistics Tank";
  await db.tankSession.create({
    data: {
      title: upcomingTitle,
      description: "Two operating businesses pitch live: rooftop solar on instalments, and same-day electric-bike delivery. Matched, verified investors only.",
      startsAt: day(6, 12), // 5pm in Pakistan
      durationMin: 90,
      capacity: 25,
      videoProvider: "link",
      roomName: "external",
      joinUrlEnc: seal("https://meet.example.com/ramizeez-demo-tank"),
      createdById: admin.id,
      pitches: { create: [{ pitchId: solar.id, position: 0, status: "CONFIRMED", grantAccess: true, respondedAt: day(-2) }, { pitchId: parcel.id, position: 1, status: "INVITED" }] },
      seats: {
        create: [
          seat(upcomingTitle, [solar.id, parcel.id], demoInvestor, "APPROVED"),
          seat(upcomingTitle, [solar.id, parcel.id], sana, "APPROVED"),
          seat(upcomingTitle, [solar.id, parcel.id], omar, "REQUESTED"),
        ],
      },
    },
  });
  const pastTitle = "Food & dairy Tank";
  const past = await db.tankSession.create({
    data: {
      title: pastTitle,
      description: "Fresh-food businesses pitched live to verified investors.",
      startsAt: day(-30, 12),
      durationMin: 60,
      capacity: 20,
      status: "COMPLETED",
      completedAt: day(-30, 14),
      videoProvider: "link",
      roomName: "external",
      joinUrlEnc: seal("https://meet.example.com/ramizeez-demo-food"),
      recordingUrlEnc: seal("https://recordings.example.com/ramizeez-demo-food"),
      createdById: admin.id,
      pitches: { create: [{ pitchId: dairy.id, position: 0, status: "CONFIRMED", grantAccess: true, respondedAt: day(-35) }] },
      seats: { create: [seat(pastTitle, [dairy.id], demoInvestor, "APPROVED", day(-30, 12)), seat(pastTitle, [dairy.id], omar, "APPROVED", day(-30, 12))] },
    },
  });
  await db.tankInterest.createMany({
    data: [
      { sessionId: past.id, pitchId: dairy.id, investorId: demoInvestor.id, amount: 1_500_000, currency: "PKR", note: "Loved the farm-level testing.", createdAt: day(-30, 13) },
      { sessionId: past.id, pitchId: dairy.id, investorId: omar.id, amount: 500_000, currency: "PKR", createdAt: day(-30, 13) },
    ],
  });

  console.log(
    [
      "Created demo scenarios:",
      "  Pipeline: Chai Chowk (submitted), AgriSense (screening), Karachi Cold Chain (due diligence), Hunarmand (committee), Sehat Ghar (returned)",
      "  Listed: Solar Chhat (offers + Q&A + upcoming Tank), Pak Parcel (new listing, invited to Tank)",
      "  Deals: Doodh Direct (committed, agreement awaiting founder), Kapra Loom (funded, in execution)",
      `  Tank: "${upcomingTitle}" in 6 days, "${pastTitle}" completed 30 days ago`,
    ].join("\n"),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
