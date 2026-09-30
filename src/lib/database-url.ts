// Finds the PostgreSQL connection string, whichever host provides it. Netlify's database
// integration, Neon, Vercel/Supabase-style setups and plain DATABASE_URL all use different names.
// Also used by scripts/netlify-build.sh (via `node`), so it stays plain and dependency-free.

const RUNTIME_NAMES = ["DATABASE_URL", "NETLIFY_DATABASE_URL", "NETLIFY_DB_URL", "NETLIFY_DATABASE_CONNECTION_STRING", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "NEON_DATABASE_URL"];
// Migrations should bypass connection poolers.
const DIRECT_NAMES = ["DATABASE_URL", "NETLIFY_DATABASE_URL_UNPOOLED", "NETLIFY_DB_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DIRECT_URL", "DATABASE_URL_UNPOOLED", ...RUNTIME_NAMES];

const isPostgres = (v: string | undefined): v is string => !!v && /^postgres(ql)?:\/\//.test(v.trim());

export function findDatabaseUrl(env: Record<string, string | undefined>, direct = false): { name: string; url: string } | null {
  for (const name of direct ? DIRECT_NAMES : RUNTIME_NAMES) if (isPostgres(env[name])) return { name, url: env[name]!.trim() };
  // Fallback: any variable holding a PostgreSQL connection string (unpooled ones first when migrating).
  const rest = Object.entries(env).filter(([, v]) => isPostgres(v)).sort(([a], [b]) => Number(/UNPOOLED|NON_POOLING|DIRECT/.test(b)) - Number(/UNPOOLED|NON_POOLING|DIRECT/.test(a)));
  const pick = direct ? rest[0] : (rest.find(([k]) => !/UNPOOLED|NON_POOLING|DIRECT/.test(k)) ?? rest[0]);
  return pick ? { name: pick[0], url: pick[1]!.trim() } : null;
}
