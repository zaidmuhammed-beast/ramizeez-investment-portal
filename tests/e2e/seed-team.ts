// E2E helper: creates a team member (FINANCE by default) with 2FA already on and a known TOTP
// secret, and prints its credentials as JSON. Run with the app's .env loaded.
import { PrismaClient, type TeamRole } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { encryptString } from "../../src/lib/crypto";
import { generateTotpSecret } from "../../src/lib/auth/totp";

const db = new PrismaClient();

async function main() {
  const teamRole = (process.argv[2] ?? "FINANCE") as TeamRole;
  const stamp = Date.now().toString();
  const email = `e2e.${teamRole.toLowerCase()}.${stamp}@ramizeez.test`;
  const password = "Seeded-Team!Ledger-2026";
  const secret = generateTotpSecret();
  const key = Buffer.from(process.env.DATA_ENCRYPTION_KEY!, "base64");
  const user = await db.user.create({
    data: {
      email,
      phone: `+9230${stamp.slice(-8)}`,
      passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
      firstName: "Faisal",
      lastName: "Mirza",
      countryOfResidence: "PK",
      roles: ["TEAM"],
      teamRole,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      totpSecretEnc: encryptString(secret, key),
      totpEnabledAt: new Date(),
    },
  });
  console.log(JSON.stringify({ id: user.id, email, password, secret, name: "Faisal Mirza" }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
