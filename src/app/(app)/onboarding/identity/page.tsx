import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { COUNTRIES } from "@/lib/countries";
import { Card, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { IdentityWizard } from "./identity-wizard";

export const metadata: Metadata = { title: "Identity verification" };

export default async function IdentityPage() {
  const user = await requireUser();
  const latest = await db.verificationCase.findFirst({
    where: { userId: user.id, kind: "IDENTITY" },
    orderBy: { createdAt: "desc" },
  });

  const header = (
    <PageHeader
      title="Identity verification"
      description="Tier 1. We confirm you are a real person and that your document is genuine. This usually takes under 10 minutes."
      actions={latest && <StatusBadge status={latest.status} />}
    />
  );

  if (latest && latest.status !== "NEEDS_INFO") {
    return (
      <>
        {header}
        <Card>
          {latest.status === "IN_REVIEW" && (
            <Alert tone="info">
              Thank you. Your documents are with our verification team. We&apos;ll notify you by email when the review is complete.
              Meanwhile, you can start your <a className="underline" href="/onboarding/profile">full profile</a>.
            </Alert>
          )}
          {latest.status === "APPROVED" && <Alert tone="success">Your identity is verified.</Alert>}
          {latest.status === "REJECTED" && (
            <Alert tone="error">
              We could not verify your identity. {latest.decisionReason && <>Reason: {latest.decisionReason}. </>}Contact{" "}
              {BRAND.supportEmail} if you think this is a mistake.
            </Alert>
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      {header}
      {latest?.status === "NEEDS_INFO" && (
        <Alert tone="warn" className="mb-6">
          Our team needs you to resubmit: {latest.decisionReason}
        </Alert>
      )}
      <IdentityWizard
        countries={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
        defaultCountry={user.countryOfResidence}
        allowUpload={env().KYC_ALLOW_FILE_UPLOAD}
        accountName={`${user.firstName} ${user.lastName}`}
      />
    </>
  );
}
