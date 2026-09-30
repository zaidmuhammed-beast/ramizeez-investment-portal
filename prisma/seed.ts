// Seeds a super-admin account and a few clearly fictional watchlist entries for testing.
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { normalizeName } from "../src/lib/kyc/names";

const db = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@ramizeez.test").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) throw new Error("Set SEED_ADMIN_PASSWORD in .env");

  const existing = await db.user.findUnique({ where: { email } });
  if (!existing) {
    await db.user.create({
      data: {
        email,
        firstName: "RamiZeeZ",
        lastName: "Admin",
        phone: "+923000000000",
        countryOfResidence: "PK",
        roles: ["TEAM"],
        teamRole: "SUPER_ADMIN",
        passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
        // Contact details are pre-verified for the seed account; 2FA is still set up on first sign-in.
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
      },
    });
    console.log(`Created super admin ${email}`);
  } else {
    console.log(`Super admin ${email} already exists`);
  }

  const entries = [
    { fullName: "Test Sanctioned Person", aliases: ["T. S. Person"], listSource: "INTERNAL", reason: "TEST ENTRY: fictional" },
    { fullName: "Demo Blocked Individual", aliases: [], listSource: "INTERNAL", reason: "TEST ENTRY: fictional" },
  ];
  for (const e of entries) {
    const normalizedName = normalizeName(e.fullName);
    if (!(await db.watchlistEntry.findFirst({ where: { normalizedName } }))) {
      await db.watchlistEntry.create({ data: { ...e, normalizedName } });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
