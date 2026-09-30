"use server";

import { refresh } from "next/cache";
import type { EscrowEntryType } from "@prisma/client";
import { requireTeam } from "@/lib/auth/rbac";
import type { FormState } from "@/lib/form-state";
import { DealError, closeRoundEarly, decideEntry, issueAgreement, moderateQuestion, recordEntry, reviewClaim } from "@/lib/deals/service";

async function guard(fn: () => Promise<unknown>, ok: string): Promise<FormState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof DealError) return { message: e.message };
    throw e;
  }
  refresh();
  return { ok: true, message: ok };
}

export async function moderateQuestionAction(questionId: string, approve: boolean, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("deals.view");
  return guard(() => moderateQuestion(me, questionId, approve, String(fd.get("note") ?? "").trim() || undefined), approve ? "Question passed to the founder." : "Question rejected.");
}

export async function issueAgreementAction(offerId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("deals.view");
  return guard(() => issueAgreement(me, offerId, String(fd.get("body") ?? "")), "Agreement issued for signature.");
}

const TYPES: EscrowEntryType[] = ["DEPOSIT", "RELEASE", "REFUND"];

export async function recordEntryAction(pitchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("deals.view");
  const type = String(fd.get("type") ?? "") as EscrowEntryType;
  if (!TYPES.includes(type)) return { errors: { type: "Choose an entry type" } };
  const amount = Number(fd.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) return { errors: { amount: "Enter an amount" } };
  const text = (k: string) => String(fd.get(k) ?? "").trim().slice(0, 500) || null;
  return guard(
    () => recordEntry(me, pitchId, { type, amount, offerId: text("offerId"), milestoneId: text("milestoneId"), reference: text("reference"), note: text("note") }),
    "Entry recorded. A second team member must approve it before it posts.",
  );
}

export async function decideEntryAction(entryId: string, approve: boolean): Promise<FormState> {
  const me = await requireTeam("deals.view");
  return guard(() => decideEntry(me, entryId, approve), approve ? "Entry posted." : "Entry rejected.");
}

export async function reviewClaimAction(claimId: string, approve: boolean, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("deals.view");
  return guard(() => reviewClaim(me, claimId, approve, String(fd.get("note") ?? "").trim() || undefined), approve ? "Milestone approved. Finance can now release its funds." : "Sent back to the founder.");
}

export async function closeRoundAction(pitchId: string): Promise<FormState> {
  const me = await requireTeam("deals.view");
  return guard(() => closeRoundEarly(me, pitchId), "Round closed at the committed amount.");
}
