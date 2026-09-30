"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { getOnboardingState } from "@/lib/onboarding";
import { screenPerson } from "@/lib/kyc/aml";
import { riskFrom, type CheckResult } from "@/lib/kyc/types";
import { fieldErrors, requiredText } from "@/lib/validation/common";
import { formValues, type FormState } from "@/lib/form-state";

const schema = z.object({
  availability: requiredText(1000, 10),
  timezone: requiredText(60),
});

export async function requestFinalAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const state = await getOnboardingState(user.id);
  const existing = state.cases.final;
  if (state.tier < 3 || (existing && existing.status !== "NEEDS_INFO")) redirect("/onboarding/final");
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: formValues(fd) };

  // Re-screen at the final gate: watchlists change after the Tier 1 check.
  const doc = await db.identityDocument.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const aml = await screenPerson(user.id, doc?.fullNameOnDoc ?? `${user.firstName} ${user.lastName}`, doc?.dateOfBirth);

  const checks: CheckResult[] = [
    { id: "final.tiers", label: "Tiers 1–3", status: "PASS", detail: "Identity, profile and role are all approved" },
    { id: "final.aml", label: "Sanctions / PEP re-screening", status: aml.result === "CLEAR" ? "PASS" : "WARN", detail: aml.result === "CLEAR" ? "No watchlist matches" : "Potential watchlist match. Review the hits." },
    { id: "final.declarations", label: "Integrity declarations", status: declarationFlag(state.user.declaration) ? "WARN" : "PASS", detail: declarationFlag(state.user.declaration) ? "One or more “yes” answers need discussing" : "No adverse declarations" },
    { id: "final.interview", label: "Video interview", status: "MANUAL", detail: "Confirm identity live, discuss goals and check the applicant understands the risks" },
    { id: "final.references", label: "Reference checks", status: "MANUAL", detail: "Contact at least one reference (required for large investors and founders)" },
  ];

  const c = await db.verificationCase.create({
    data: {
      userId: user.id,
      kind: "FINAL",
      checks,
      riskLevel: riskFrom(checks),
      provider: "internal",
      applicantNote: `Availability: ${parsed.data.availability}\nTime zone: ${parsed.data.timezone}`,
    },
  });
  await audit("kyc.final.requested", { actorId: user.id, targetType: "VerificationCase", targetId: c.id });
  redirect("/onboarding/final");
}

function declarationFlag(d: { hasCriminalRecord: boolean; hasPendingLitigation: boolean; hasBankruptcyOrDefault: boolean; isPep: boolean; hasConflictOfInterest: boolean } | null) {
  return !!d && (d.hasCriminalRecord || d.hasPendingLitigation || d.hasBankruptcyOrDefault || d.isPep || d.hasConflictOfInterest);
}
