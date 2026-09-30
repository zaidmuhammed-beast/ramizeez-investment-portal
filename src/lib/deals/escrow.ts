// Escrow ledger and round-status rules. Pure and unit-tested.
import { PLATFORM_TERMS } from "@/config/platform";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type Entry = {
  type: "DEPOSIT" | "FEE" | "RELEASE" | "REFUND";
  status: "PENDING" | "POSTED" | "REJECTED";
  amount: number;
  offerId?: string | null;
  milestoneId?: string | null;
  recordedById?: string | null;
};

const posted = (entries: Entry[]) => entries.filter((e) => e.status === "POSTED");
const sum = (entries: Entry[]) => round2(entries.reduce((s, e) => s + e.amount, 0));

/** Money held in escrow now: posted deposits minus posted fees, releases and refunds. */
export function balance(entries: Entry[]): number {
  const p = posted(entries);
  return round2(sum(p.filter((e) => e.type === "DEPOSIT")) - sum(p.filter((e) => e.type !== "DEPOSIT")));
}

export const depositedFor = (entries: Entry[], offerId: string) => sum(posted(entries).filter((e) => e.type === "DEPOSIT" && e.offerId === offerId));
export const releasedFor = (entries: Entry[], milestoneId: string) => sum(posted(entries).filter((e) => e.type === "RELEASE" && e.milestoneId === milestoneId));
export const feeFor = (fundedTotal: number) => round2((fundedTotal * PLATFORM_TERMS.successFeePercent) / 100);

/** A milestone's release, scaled if the round closed below its target. */
export const releaseAmount = (budget: number, fundedTotal: number, target: number) => round2(budget * Math.min(1, fundedTotal / target));

/** Maker-checker: nobody approves an entry they recorded. */
export function approvalBlocker(entry: Entry & { status: string }, approverId: string): string | null {
  if (entry.status !== "PENDING") return "This entry has already been decided.";
  if (entry.recordedById && entry.recordedById === approverId) return "A different team member must approve an entry you recorded.";
  return null;
}

/** Why a new entry can't be recorded, or null. */
export function entryBlocker(e: Entry, ctx: { balance: number; dealStatus: string; claimApproved?: boolean; alreadyReleased?: number; releaseCap?: number }): string | null {
  if (!(e.amount > 0)) return "Enter an amount";
  if (e.type === "DEPOSIT" && !e.offerId) return "Choose the investor's offer the deposit belongs to";
  if (e.type === "RELEASE") {
    if (ctx.dealStatus !== "FUNDED") return "Funds can only be released once the round is funded";
    if (!e.milestoneId) return "Choose the milestone";
    if (!ctx.claimApproved) return "The milestone's evidence must be approved first";
    if ((ctx.alreadyReleased ?? 0) + e.amount > (ctx.releaseCap ?? Infinity) + 0.01) return "That's more than the milestone's budget";
  }
  if (e.type !== "DEPOSIT" && e.amount > ctx.balance + 0.01) return "Not enough money in escrow";
  return null;
}

export type RoundInput = {
  cancelled: boolean;
  target: number;
  closedEarly: boolean;
  accepted: { offerId: string; amount: number; agreementSigned: boolean }[];
  entries: Entry[];
  milestones: { id: string; budget: number }[];
};

export type RoundState = {
  status: "OPEN" | "COMMITTED" | "FUNDED" | "COMPLETED" | "CANCELLED";
  committed: number;
  fundedTotal: number;
};

/** Derives the round's status from its offers, agreements and ledger. */
export function evaluateRound(r: RoundInput): RoundState {
  const committed = round2(r.accepted.reduce((s, o) => s + o.amount, 0));
  if (r.cancelled) return { status: "CANCELLED", committed, fundedTotal: 0 };
  const full = committed >= r.target - 0.01 || (r.closedEarly && committed > 0);
  if (!full) return { status: "OPEN", committed, fundedTotal: 0 };
  const allFunded = r.accepted.every((o) => o.agreementSigned && depositedFor(r.entries, o.offerId) >= o.amount - 0.01);
  if (!allFunded) return { status: "COMMITTED", committed, fundedTotal: 0 };
  const done = r.milestones.length > 0 && r.milestones.every((m) => releasedFor(r.entries, m.id) >= releaseAmount(m.budget, committed, r.target) - 0.01);
  return { status: done ? "COMPLETED" : "FUNDED", committed, fundedTotal: committed };
}
