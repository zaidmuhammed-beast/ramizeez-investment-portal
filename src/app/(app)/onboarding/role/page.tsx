import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { COUNTRIES } from "@/lib/countries";
import { getOnboardingState } from "@/lib/onboarding";
import { Card, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { StepStatusBadge } from "@/components/step-status";
import { SubmitButton } from "@/components/ui/button";
import { FounderForm, InvestorForm } from "./forms";
import { submitRoleAction } from "./actions";

export const metadata: Metadata = { title: "Role verification" };

export default async function RolePage() {
  const user = await requireUser();
  const state = await getOnboardingState(user.id);
  const { investorProfile: inv, founderProfile: fdr } = state.user;
  const roleCase = state.cases.role;
  const editable = !roleCase || roleCase.status === "NEEDS_INFO";

  const fileIds = [...(inv?.proofOfFundsIds ?? []), ...(inv?.entityDocumentIds ?? []), ...(fdr?.documentIds ?? [])];
  const fileRows = fileIds.length
    ? await db.storedFile.findMany({ where: { id: { in: fileIds }, ownerId: user.id }, select: { id: true, originalName: true, kind: true } })
    : [];
  const fileMap = Object.fromEntries(fileRows.map((f) => [f.id, f]));
  const listFiles = (ids: string[]) => ids.map((id) => fileMap[id]).filter(Boolean);

  const header = (
    <PageHeader
      title="Role verification"
      description="Tier 3. We verify your capacity as an investor, or your business as a founder."
      actions={<StepStatusBadge status={state.steps.role} />}
    />
  );

  if (state.tier < 2 && !roleCase) {
    return (
      <>
        {header}
        <Card>
          <Alert tone="info">
            This step opens once your identity is verified (Tier 1) and your profile is complete (Tier 2).{" "}
            <Link href="/dashboard" className="underline">
              See your progress
            </Link>
            .
          </Alert>
        </Card>
      </>
    );
  }

  const countries = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

  return (
    <>
      {header}
      {roleCase?.status === "IN_REVIEW" && <Alert tone="info" className="mb-6">Submitted. Our team is reviewing your details.</Alert>}
      {roleCase?.status === "APPROVED" && <Alert tone="success" className="mb-6">Role verified. Next: <Link href="/onboarding/final" className="underline">final approval</Link>.</Alert>}
      {roleCase?.status === "NEEDS_INFO" && <Alert tone="warn" className="mb-6">Our team needs more information: {roleCase.decisionReason}</Alert>}
      {roleCase?.status === "REJECTED" && <Alert tone="error" className="mb-6">Role verification was rejected: {roleCase.decisionReason}</Alert>}

      <div className="space-y-6">
        {user.roles.includes("INVESTOR") && (
          <Card strong title="Investor profile" description="Your verified budget controls which opportunities you can see. Declare it honestly and back it with proof.">
            <InvestorForm
              disabled={!editable}
              existingFiles={{ proofOfFunds: listFiles(inv?.proofOfFundsIds ?? []), entityDocs: listFiles(inv?.entityDocumentIds ?? []) }}
              defaults={
                inv
                  ? {
                      investorType: inv.investorType,
                      currency: inv.currency,
                      declaredBudget: String(inv.declaredBudget),
                      ticketMin: String(inv.ticketMin),
                      ticketMax: String(inv.ticketMax),
                      sourceOfFunds: inv.sourceOfFunds,
                      sourceOfWealth: inv.sourceOfWealth,
                      annualIncomeBand: inv.annualIncomeBand,
                      netWorthBand: inv.netWorthBand,
                      experience: inv.experience,
                      sectors: inv.sectors,
                      stages: inv.stages,
                      dealTypes: inv.dealTypes,
                      geographies: inv.geographies,
                      shariahOnly: inv.shariahOnly ? "yes" : "no",
                      entityName: inv.entityName ?? "",
                      entityRegNumber: inv.entityRegNumber ?? "",
                      ...(inv.riskAnswers as Record<string, string>),
                    }
                  : { currency: user.countryOfResidence === "PK" ? "PKR" : "USD" }
              }
            />
          </Card>
        )}
        {user.roles.includes("FOUNDER") && (
          <Card strong title="Founder & business details" description="Tell us about the business you want to raise for. The full pitch builder opens after approval.">
            <FounderForm
              disabled={!editable}
              countries={countries}
              existingFiles={listFiles(fdr?.documentIds ?? [])}
              defaults={
                fdr
                  ? {
                      stage: fdr.stage,
                      businessName: fdr.businessName ?? "",
                      sector: fdr.sector,
                      country: fdr.country,
                      city: fdr.city,
                      entityType: fdr.entityType ?? "",
                      registrationNumber: fdr.registrationNumber ?? "",
                      taxNumber: fdr.taxNumber ?? "",
                      foundedYear: fdr.foundedYear?.toString() ?? "",
                      employees: fdr.employees?.toString() ?? "",
                      personalCapital: fdr.personalCapital?.toString() ?? "",
                      currency: fdr.currency,
                      coFounders: fdr.coFounders ?? "",
                      preferredDealTypes: fdr.preferredDealTypes,
                      platformTermsVersion: fdr.platformTermsVersion ?? "",
                    }
                  : { country: user.countryOfResidence, currency: user.countryOfResidence === "PK" ? "PKR" : "USD" }
              }
            />
          </Card>
        )}

        {editable && (
          <Card title="Submit for verification">
            {state.roleProfilesReady ? (
              <form action={submitRoleAction} className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-slate-400">Once submitted, these details are locked while our team reviews them.</p>
                <SubmitButton pendingText="Submitting…">Submit for role verification</SubmitButton>
              </form>
            ) : (
              <p className="text-sm text-slate-400">Save your {user.roles.includes("INVESTOR") && user.roles.includes("FOUNDER") ? "investor and founder profiles" : "profile"} above first.</p>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
