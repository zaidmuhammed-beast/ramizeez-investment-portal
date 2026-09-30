import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getOnboardingState } from "@/lib/onboarding";
import { Card, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { StepStatusBadge } from "@/components/step-status";
import { FinalRequestForm } from "./final-form";

export const metadata: Metadata = { title: "Final approval" };

export default async function FinalPage() {
  const user = await requireUser();
  const state = await getOnboardingState(user.id);
  const c = state.cases.final;

  return (
    <>
      <PageHeader
        title="RamiZeeZ final approval"
        description="Tier 4. A senior team member reviews your whole file and meets you on a short video call."
        actions={<StepStatusBadge status={state.steps.final} />}
      />
      <Card strong>
        {state.tier < 3 && !c && (
          <Alert tone="info">
            This opens once your role is verified (Tier 3).{" "}
            <Link href="/dashboard" className="underline">
              See your progress
            </Link>
            .
          </Alert>
        )}
        {c?.status === "IN_REVIEW" && (
          <Alert tone="info">
            Requested. We&apos;ll email you an invitation for a video interview.
            {c.interviewAt && <> Scheduled for {c.interviewAt.toUTCString()}.</>}
          </Alert>
        )}
        {c?.status === "APPROVED" && (
          <Alert tone="success">★ You are RamiZeeZ Verified. {user.roles.includes("INVESTOR") ? "Opportunities" : "Pitching"} opens as the next platform phase goes live.</Alert>
        )}
        {c?.status === "REJECTED" && <Alert tone="error">Final approval was declined: {c.decisionReason}</Alert>}
        {state.tier >= 3 && (!c || c.status === "NEEDS_INFO") && (
          <>
            {c?.status === "NEEDS_INFO" && <Alert tone="warn" className="mb-5">Our team asked: {c.decisionReason}</Alert>}
            <FinalRequestForm />
          </>
        )}
      </Card>
    </>
  );
}
