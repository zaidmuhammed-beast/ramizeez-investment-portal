import { execFileSync } from "node:child_process";

// Seeds a fresh super admin for each run, so the test never depends on (or resets)
// existing data: every account it touches is new.
export default function globalSetup() {
  const email = `e2e.admin.${Date.now()}@ramizeez.test`;
  const password = "E2e-Admin!Harbor-2026";
  execFileSync("npx", ["prisma", "db", "seed"], {
    stdio: "ignore",
    env: { ...process.env, SEED_ADMIN_EMAIL: email, SEED_ADMIN_PASSWORD: password },
  });
  process.env.E2E_ADMIN_EMAIL = email;
  process.env.E2E_ADMIN_PASSWORD = password;

  // A second, already verified investor to browse the founder's listed pitch.
  const out = execFileSync("npx", ["tsx", "--env-file=.env", "tests/e2e/seed-investor.ts"], { encoding: "utf8" });
  process.env.E2E_INVESTOR = out.trim().split("\n").at(-1);
}
