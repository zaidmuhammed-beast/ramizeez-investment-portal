#!/usr/bin/env bash
# Netlify build: generate the Prisma client, apply database migrations, seed the first
# super admin (only while SEED_ADMIN_PASSWORD is set), then build the Next.js app.
set -euo pipefail

# Netlify DB (Neon) provides these; migrations need the direct (unpooled) connection.
export DATABASE_URL="${DATABASE_URL:-${NETLIFY_DATABASE_URL_UNPOOLED:-${NETLIFY_DATABASE_URL:-}}}"
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Add a PostgreSQL connection string (or enable Netlify DB) in Site configuration → Environment variables." >&2
  exit 1
fi

npx prisma generate
npx prisma migrate deploy
if [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
  echo "Seeding the super admin ${SEED_ADMIN_EMAIL:-admin@ramizeez.test} (remove SEED_ADMIN_PASSWORD after the first deploy)"
  npx prisma db seed
fi
npx next build
