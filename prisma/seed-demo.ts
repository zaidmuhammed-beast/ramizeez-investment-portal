// Creates three demo accounts for trying out a test (staging) site: a verified investor, a
// verified founder and a team member. Runs during the Netlify build while DEMO_USERS_PASSWORD
// is set (see scripts/netlify-build.sh); locally: DEMO_USERS_PASSWORD=… npx tsx prisma/seed-demo.ts
// Accounts that already exist are left untouched. Everyone sets up 2FA at first sign-in.
import { PrismaClient, type Prisma } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { PLATFORM_TERMS } from "../src/config/platform";
import { SECTORS, STAGES } from "../src/lib/taxonomy";

const db = new PrismaClient();

const approved = { status: "APPROVED" as const, checks: [], riskLevel: "LOW", provider: "demo-seed", decisionReason: "Demo account for the test site", decidedAt: new Date() };

/** Everything tiers 1–4 require, so the demo applicants start fully verified. */
const verifiedApplicant = (bio: string): Partial<Prisma.UserCreateInput> => ({
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
  cases: { create: (["IDENTITY", "ROLE", "FINAL"] as const).map((kind) => ({ kind, ...approved })) },
});

async function main() {
  const password = process.env.DEMO_USERS_PASSWORD;
  if (!password || password.length < 12) throw new Error("Set DEMO_USERS_PASSWORD (12+ characters) to create the demo accounts");
  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const base = { passwordHash, emailVerifiedAt: new Date(), phoneVerifiedAt: new Date() };

  const accounts: { label: string; data: Prisma.UserCreateInput }[] = [
    {
      label: "Investor (Tier 4, verified budget PKR 5,000,000)",
      data: {
        ...base,
        ...verifiedApplicant("Demo investor account for the RamiZeeZ test site. Overseas Pakistani based in Dubai."),
        email: "demo.investor@ramizeez.test",
        phone: "+971500000001",
        firstName: "Demo",
        lastName: "Investor",
        countryOfResidence: "AE",
        roles: ["INVESTOR"],
        investorProfile: {
          create: {
            investorType: "HIGH_NET_WORTH", currency: "PKR", declaredBudget: 5_000_000, verifiedBudget: 5_000_000, ticketMin: 100_000, ticketMax: 2_000_000,
            sourceOfFunds: ["SALARY", "BUSINESS"], sourceOfWealth: "Demo: salary and business income", annualIncomeBand: "USD 75k–150k", netWorthBand: "USD 500k–2M",
            experience: "Demo: two angel investments in Lahore.", sectors: [...SECTORS], stages: STAGES.map(([v]) => v), dealTypes: ["EQUITY", "MUSHARAKAH", "MUDARABAH", "REVENUE_SHARE"],
            geographies: ["Pakistan", "GCC", "Global"], riskAnswers: {}, riskScore: 7,
          },
        },
      },
    },
    {
      label: "Founder (Tier 4, ready to build and submit a pitch)",
      data: {
        ...base,
        ...verifiedApplicant("Demo founder account for the RamiZeeZ test site. Runs a small food business in Lahore."),
        email: "demo.founder@ramizeez.test",
        phone: "+923000000002",
        firstName: "Demo",
        lastName: "Founder",
        countryOfResidence: "PK",
        roles: ["FOUNDER"],
        founderProfile: {
          create: {
            stage: "EXISTING", businessName: "Demo Foods", sector: "Food & beverage", country: "PK", city: "Lahore", entityType: "SOLE_PROPRIETOR",
            foundedYear: 2022, employees: 6, currency: "PKR", preferredDealTypes: ["EQUITY", "MUSHARAKAH"],
            platformTermsVersion: PLATFORM_TERMS.version, platformTermsAcceptedAt: new Date(),
          },
        },
      },
    },
    {
      label: "Team member (Execution Manager: funded companies, reports, marketing)",
      data: { ...base, email: "demo.manager@ramizeez.test", phone: "+923000000003", firstName: "Demo", lastName: "Manager", countryOfResidence: "PK", roles: ["TEAM"], teamRole: "EXECUTION_MANAGER" },
    },
  ];

  for (const a of accounts) {
    const existing = await db.user.findUnique({ where: { email: a.data.email } });
    if (existing) {
      console.log(`Demo account already exists, left unchanged: ${a.data.email}`);
      continue;
    }
    await db.user.create({ data: a.data });
    console.log(`Created demo account: ${a.data.email} — ${a.label}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
