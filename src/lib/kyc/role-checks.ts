// Automated checks for Tier 3 (role verification). Pure functions, unit-tested.
import type { CheckResult } from "./types";

export const ENTITY_INVESTOR_TYPES = ["COMPANY", "FUND", "FAMILY_OFFICE"] as const;

export const RISK_QUESTIONS = {
  horizon: {
    label: "How long can you leave money invested before you need it back?",
    options: [
      ["LT1", "Less than 1 year"],
      ["1TO3", "1–3 years"],
      ["3TO5", "3–5 years"],
      ["GT5", "More than 5 years"],
    ],
  },
  portion: {
    label: "What share of your total net worth do you plan to put into private businesses?",
    options: [
      ["GT50", "More than 50%"],
      ["25TO50", "25–50%"],
      ["10TO25", "10–25%"],
      ["LT10", "Less than 10%"],
    ],
  },
  reaction: {
    label: "If an investment lost half its value in a year, what would you do?",
    options: [
      ["EXIT", "Try to get out at any cost"],
      ["WORRY", "Worry, but wait"],
      ["HOLD", "Hold and follow the plan"],
      ["MORE", "Consider investing more"],
    ],
  },
} as const;

export type RiskAnswers = {
  understandsLoss: boolean;
  understandsIlliquidity: boolean;
  horizon: string;
  portion: string;
  reaction: string;
};

/** 0 (low suitability) … 9 (high suitability for long-term private investments). */
export function riskScore(a: RiskAnswers): number {
  const idx = (key: keyof typeof RISK_QUESTIONS, v: string) =>
    Math.max(0, RISK_QUESTIONS[key].options.findIndex(([k]) => k === v));
  return idx("horizon", a.horizon) + idx("portion", a.portion) + idx("reaction", a.reaction);
}

export type InvestorCheckInput = {
  investorType: string;
  declaredBudget: number;
  ticketMin: number;
  ticketMax: number;
  currency: string;
  sourceOfFunds: string[];
  proofOfFundsCount: number;
  entityName?: string | null;
  entityRegNumber?: string | null;
  entityDocumentCount: number;
  risk: RiskAnswers;
};

export function investorChecks(i: InvestorCheckInput): CheckResult[] {
  const out: CheckResult[] = [];
  const fmt = (n: number) => `${i.currency} ${n.toLocaleString("en-US")}`;
  const ticketsOk = i.ticketMin > 0 && i.ticketMin <= i.ticketMax && i.ticketMax <= i.declaredBudget;
  out.push({
    id: "inv.tickets",
    label: "Ticket sizes",
    status: ticketsOk ? "PASS" : "FAIL",
    detail: ticketsOk
      ? `${fmt(i.ticketMin)}–${fmt(i.ticketMax)} per deal within a budget of ${fmt(i.declaredBudget)}`
      : "The minimum ticket must be ≤ the maximum ticket, and the maximum ticket ≤ the total budget",
  });
  out.push({
    id: "inv.sof",
    label: "Source of funds",
    status: i.sourceOfFunds.length ? "PASS" : "FAIL",
    detail: i.sourceOfFunds.length ? i.sourceOfFunds.join(", ") : "No source of funds declared",
  });
  out.push({
    id: "inv.pof",
    label: "Proof of funds",
    status: i.proofOfFundsCount > 0 ? "PASS" : "FAIL",
    detail: i.proofOfFundsCount > 0 ? `${i.proofOfFundsCount} document(s) uploaded` : "Upload a bank statement, balance certificate or wealth statement",
  });
  if ((ENTITY_INVESTOR_TYPES as readonly string[]).includes(i.investorType)) {
    const ok = !!i.entityName && !!i.entityRegNumber && i.entityDocumentCount > 0;
    out.push({
      id: "inv.entity",
      label: "Entity documents",
      status: ok ? "PASS" : "FAIL",
      detail: ok ? `${i.entityName} (${i.entityRegNumber})` : "Company, fund or family-office investors must give the entity name, registration number and incorporation documents",
    });
    out.push({
      id: "inv.ubo",
      label: "Beneficial owners",
      status: "MANUAL",
      detail: "Identify every owner with 10% or more, and confirm each has completed identity verification",
    });
  }
  const understands = i.risk.understandsLoss && i.risk.understandsIlliquidity;
  out.push({
    id: "inv.risk_ack",
    label: "Risk acknowledgement",
    status: understands ? "PASS" : "FAIL",
    detail: understands ? "Understands capital loss and illiquidity" : "The investor must accept that they can lose all their capital and that money may be locked in for years",
  });
  const score = riskScore(i.risk);
  out.push({
    id: "inv.suitability",
    label: "Suitability score",
    status: score >= 4 ? "PASS" : "WARN",
    detail: `${score}/9${score < 4 ? ": short horizon or high concentration. Discuss suitability in the interview." : ""}`,
  });
  out.push({
    id: "inv.budget_verify",
    label: "Verified budget",
    status: "MANUAL",
    detail: "Compare the proof of funds with the declared budget, and set the verified budget when approving",
  });
  return out;
}

export type FounderCheckInput = {
  stage: "IDEA" | "EXISTING";
  businessName?: string | null;
  registrationNumber?: string | null;
  documentCount: number;
};

export function founderChecks(f: FounderCheckInput): CheckResult[] {
  const out: CheckResult[] = [];
  if (f.stage === "EXISTING") {
    const ok = !!f.businessName && !!f.registrationNumber && f.documentCount > 0;
    out.push({
      id: "fdr.registration",
      label: "Business registration",
      status: ok ? "PASS" : "FAIL",
      detail: ok ? `${f.businessName} (${f.registrationNumber}), ${f.documentCount} document(s)` : "Existing businesses must give the business name, registration number and supporting documents",
    });
    out.push({
      id: "fdr.registry",
      label: "Registry lookup",
      status: "MANUAL",
      detail: "Confirm the registration with SECP or the relevant foreign registry, and check the founder's ownership",
    });
  } else {
    out.push({
      id: "fdr.registration",
      label: "Business registration",
      status: "PASS",
      detail: f.documentCount ? `Idea stage, ${f.documentCount} supporting document(s)` : "Idea stage: registration not required yet",
    });
  }
  return out;
}
