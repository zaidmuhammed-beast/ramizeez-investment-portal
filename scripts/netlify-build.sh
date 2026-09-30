#!/usr/bin/env bash
# Netlify build: generate the Prisma client, apply database migrations, seed the first
# super admin (only while SEED_ADMIN_PASSWORD is set), then build the Next.js app.
set -euo pipefail

# Find the database connection (DATABASE_URL, or the one Netlify's database integration
# provides). Migrations use the direct, unpooled connection when there is one.
DB_LOOKUP=$(npx --yes tsx -e '
import { findDatabaseUrl } from "./src/lib/database-url";
const direct = findDatabaseUrl(process.env, true);
const names = Object.keys(process.env).filter((k) => /DATABASE|POSTGRES|NEON|_DB_|^DB_/.test(k)).sort();
console.error(`Database-related variables present: ${names.join(", ") || "none"}`);
if (direct) { console.error(`Using ${direct.name} for migrations`); console.log(direct.url); }
')
export DATABASE_URL="${DB_LOOKUP:-}"

# Check every required setting first, so a misconfigured site fails here with a clear list
# instead of deploying and then erroring on every page.
node - <<'NODE'
const problems = [];
const e = process.env;
if (!e.DATABASE_URL) problems.push("No database: enable Netlify DB (Data & storage), or set DATABASE_URL to a PostgreSQL connection string.");
for (const k of ["DATA_ENCRYPTION_KEY", "BLIND_INDEX_KEY"]) {
  if (!e[k]) problems.push(`${k} is missing: set it to a random 32-byte base64 key (npm run gen:keys).`);
  else if (Buffer.from(e[k], "base64").length !== 32) problems.push(`${k} isn't a 32-byte base64 key: generate a fresh one (npm run gen:keys) and paste it without quotes or spaces.`);
}
if (e.DATA_ENCRYPTION_KEY && e.DATA_ENCRYPTION_KEY === e.BLIND_INDEX_KEY) problems.push("DATA_ENCRYPTION_KEY and BLIND_INDEX_KEY must be different keys.");
if (e.APP_ENV === "production" && (!e.EMAIL_PROVIDER || e.EMAIL_PROVIDER === "outbox" || !e.SMS_PROVIDER || e.SMS_PROVIDER === "outbox"))
  problems.push("APP_ENV=production needs real EMAIL_PROVIDER and SMS_PROVIDER settings. Use APP_ENV=staging until they're chosen.");
if (problems.length) {
  console.error("\nThe site can't be built yet. Fix these in Project configuration → Environment variables, then redeploy:\n");
  for (const p of problems) console.error(`  • ${p}`);
  console.error("\nSee docs/07-deploying-to-netlify.md for the full list.\n");
  process.exit(1);
}
console.log("Settings check passed.");
NODE

npx prisma generate
npx prisma migrate deploy
if [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
  echo "Seeding the super admin ${SEED_ADMIN_EMAIL:-admin@ramizeez.test} (remove SEED_ADMIN_PASSWORD after the first deploy)"
  npx prisma db seed
fi
npx next build
