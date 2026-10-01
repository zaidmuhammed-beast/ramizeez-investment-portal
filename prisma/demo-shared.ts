// Shared building blocks for the demo seeds (test sites only).
import type { Prisma } from "@prisma/client";

export const approvedCase = { status: "APPROVED" as const, checks: [], riskLevel: "LOW", provider: "demo-seed", decisionReason: "Demo account for the test site", decidedAt: new Date() };

/** Everything tiers 1–4 require, so a demo applicant starts fully verified. */
export const verifiedApplicant = (bio: string): Partial<Prisma.UserCreateInput> => ({
  tier: 4,
  personalProfile: { create: { dateOfBirth: new Date("1988-04-12"), nationalities: ["PK"], fatherOrSpouseName: "Demo Parent", languages: ["English", "Urdu"], bio } },
  education: { create: { institution: "LUMS", qualification: "BSc Management" } },
  experience: { create: { employer: "Demo Company", title: "Manager", startYear: 2012, responsibilities: "Demo experience for the test site." } },
  references: { create: [0, 1].map((i) => ({ name: `Demo Reference ${i + 1}`, relationship: "Colleague", email: `reference${i + 1}@example.com`, phone: "+923001234567", position: i })) },
  goals: {
    create: {
      goals1y: "Demo goal", goals5y: "Demo goal", goals10y: "Demo goal", motivation: "Demo motivation", causeCare: "Demo cause",
      successDefinition: "Demo definition", timeCommitment: "FULL_TIME", values: "Integrity", setbackStory: "Demo story",
    },
  },
  declaration: {
    create: { hasCriminalRecord: false, hasPendingLitigation: false, hasBankruptcyOrDefault: false, isPep: false, hasConflictOfInterest: false, truthAffirmed: true, consentBackgroundCheck: true, signedAt: new Date() },
  },
  cases: { create: (["IDENTITY", "ROLE", "FINAL"] as const).map((kind) => ({ kind, ...approvedCase })) },
});
