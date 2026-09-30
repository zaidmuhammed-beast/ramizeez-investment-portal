import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Netlify DB (Neon) provides NETLIFY_DATABASE_URL; any other Postgres uses DATABASE_URL.
const datasourceUrl = serverlessUrl(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL);

/** Through a PgBouncer-style pooler (e.g. Neon's "-pooler" host), Prisma needs pgbouncer mode and one connection per function. */
function serverlessUrl(raw: string | undefined) {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (!url.hostname.includes("-pooler")) return raw;
    if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
    return url.toString();
  } catch {
    return raw;
  }
}

export const db = globalForPrisma.prisma ?? new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
