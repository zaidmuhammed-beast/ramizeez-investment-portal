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
}
