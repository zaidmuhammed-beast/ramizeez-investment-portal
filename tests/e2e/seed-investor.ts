// E2E helper: creates a fully verified (Tier 4) investor directly in the database, with a known
// TOTP secret, and prints its credentials as JSON. Run with the app's .env loaded.
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { encryptString } from "../../src/lib/crypto";
import { generateTotpSecret } from "../../src/lib/auth/totp";

const db = new PrismaClient();

async function main() {
  const stamp = Date.now().toString();
  const email = `e2e.investor.${stamp}@example.com`;
  const password = "Seeded-Investor!Kite-2026";
  const secret = generateTotpSecret();
  const key = Buffer.from(process.env.DATA_ENCRYPTION_KEY!, "base64");
  const approved = { status: "APPROVED" as const, checks: [], riskLevel: "LOW", provider: "e2e-seed", decidedAt: new Date() };

  const user = await db.user.create({
    data: {
      email,
      phone: `+9233${stamp.slice(-8)}`,
      passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
      firstName: "Sara",
      lastName: "Qureshi",
      countryOfResidence: "GB",
      roles: ["INVESTOR"],
      tier: 4,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      totpSecretEnc: encryptString(secret, key),
      totpEnabledAt: new Date(),
      personalProfile: {
        create: { dateOfBirth: new Date("1985-02-02"), nationalities: ["GB", "PK"], fatherOrSpouseName: "Imran Qureshi", languages: ["English", "Urdu"], bio: "Seeded investor for end-to-end tests. ".repeat(4) },
      },
      education: { create: { institution: "LSE", qualification: "MSc Finance" } },
      experience: { create: { employer: "HSBC", title: "Director", startYear: 2010, responsibilities: "Seeded experience for tests." } },
      references: { create: [0, 1].map((i) => ({ name: `Reference ${i}`, relationship: "Colleague", email: `ref${i}@example.com`, phone: "+447700900000", position: i })) },
      goals: {
        create: {
          goals1y: "Seeded", goals5y: "Seeded", goals10y: "Seeded", motivation: "Seeded", causeCare: "Seeded",
          successDefinition: "Seeded", timeCommitment: "PART_TIME", values: "Seeded", setbackStory: "Seeded",
        },
      },
      declaration: {
        create: {
          hasCriminalRecord: false, hasPendingLitigation: false, hasBankruptcyOrDefault: false, isPep: false,
          hasConflictOfInterest: false, truthAffirmed: true, consentBackgroundCheck: true, signedAt: new Date(),
        },
      },
      investorProfile: {
        create: {
          investorType: "HIGH_NET_WORTH", currency: "PKR", declaredBudget: 5_000_000, verifiedBudget: 5_000_000,
          ticketMin: 100_000, ticketMax: 2_000_000, sourceOfFunds: ["SALARY"], sourceOfWealth: "Seeded", annualIncomeBand: "USD 75k–150k",
          netWorthBand: "USD 500k–2M", experience: "Seeded", sectors: ["Food & beverage"], stages: ["IDEA"], dealTypes: ["MUSHARAKAH", "EQUITY"],
          geographies: ["Pakistan"], riskAnswers: {}, riskScore: 7,
        },
      },
      cases: { create: (["IDENTITY", "ROLE", "FINAL"] as const).map((kind) => ({ kind, ...approved })) },
    },
  });
  console.log(JSON.stringify({ id: user.id, email, password, secret, name: "Sara Qureshi" }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
