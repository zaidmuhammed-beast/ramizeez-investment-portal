import "server-only";
import type { CaseKind, VerificationCase } from "@prisma/client";
import { db } from "./db";

export const MIN_REFERENCES = 2;

export type StepStatus = "locked" | "todo" | "in_review" | "needs_info" | "rejected" | "done";

const latestCase = (cases: VerificationCase[], kind: CaseKind) => cases.find((c) => c.kind === kind);

const caseStatus = (c: VerificationCase | undefined, unlocked: boolean): StepStatus => {
  if (!unlocked) return "locked";
  if (!c) return "todo";
  return ({ IN_REVIEW: "in_review", NEEDS_INFO: "needs_info", REJECTED: "rejected", APPROVED: "done" } as const)[c.status];
};

/** Everything the dashboard needs to show where a user stands in the verification tiers. */
export async function getOnboardingState(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      personalProfile: true,
      goals: true,
      declaration: true,
      investorProfile: true,
      founderProfile: true,
      addresses: true,
      cases: { orderBy: { createdAt: "desc" } },
      _count: { select: { education: true, experience: true, references: true, pastVentures: true } },
    },
  });

  const sections = {
    personal: !!user.personalProfile,
    education: user._count.education > 0,
    experience: user._count.experience > 0,
    ventures: true, // optional section
    goals: !!user.goals,
    references: user._count.references >= MIN_REFERENCES,
    declarations: !!user.declaration,
  };
  const profileComplete = Object.values(sections).every(Boolean);

  const identityCase = latestCase(user.cases, "IDENTITY");
  const roleCase = latestCase(user.cases, "ROLE");
  const finalCase = latestCase(user.cases, "FINAL");

  const t1 = identityCase?.status === "APPROVED";
  const t2 = t1 && profileComplete;
  const t3 = t2 && roleCase?.status === "APPROVED";
  const t4 = t3 && finalCase?.status === "APPROVED";

  const needsInvestor = user.roles.includes("INVESTOR");
  const needsFounder = user.roles.includes("FOUNDER");
  const roleProfilesReady = (!needsInvestor || !!user.investorProfile) && (!needsFounder || !!user.founderProfile);

  return {
    user,
    sections,
    profileComplete,
    roleProfilesReady,
    tier: t4 ? 4 : t3 ? 3 : t2 ? 2 : t1 ? 1 : 0,
    steps: {
      identity: caseStatus(identityCase, true),
      profile: (profileComplete ? "done" : "todo") as StepStatus,
      role: caseStatus(roleCase, t2),
      final: caseStatus(finalCase, t3),
    },
    cases: { identity: identityCase, role: roleCase, final: finalCase },
  };
}

export async function recomputeTier(userId: string): Promise<number> {
  const { tier, user } = await getOnboardingState(userId);
  if (user.tier !== tier) await db.user.update({ where: { id: userId }, data: { tier } });
  return tier;
}
