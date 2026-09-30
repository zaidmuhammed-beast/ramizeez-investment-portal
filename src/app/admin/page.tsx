import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireTeam, can } from "@/lib/auth/rbac";
import { Card, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { TIER_LABELS } from "@/components/tier-badge";

export const metadata: Metadata = { title: "Team overview" };

const KIND_LABEL = { IDENTITY: "Identity (T1)", ROLE: "Role (T3)", FINAL: "Final (T4)" } as const;

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const user = await requireTeam();
  const { denied } = await searchParams;
  const [tiers, openCases, recent, founders, investors] = await Promise.all([
    db.user.groupBy({ by: ["tier"], where: { NOT: { roles: { has: "TEAM" } } }, _count: true }),
    db.verificationCase.groupBy({ by: ["kind"], where: { status: "IN_REVIEW" }, _count: true }),
    db.user.findMany({
      where: { NOT: { roles: { has: "TEAM" } } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, firstName: true, lastName: true, email: true, roles: true, tier: true, status: true, createdAt: true, countryOfResidence: true },
    }),
    db.user.count({ where: { roles: { has: "FOUNDER" } } }),
    db.user.count({ where: { roles: { has: "INVESTOR" } } }),
  ]);
  const tierCount = (t: number) => tiers.find((x) => x.tier === t)?._count ?? 0;
  const openCount = (k: keyof typeof KIND_LABEL) => openCases.find((x) => x.kind === k)?._count ?? 0;

  return (
    <>
      <PageHeader title={`Good day, ${user.firstName}`} description="Platform health and work waiting for the team." />
      {denied && (
        <Alert tone="warn" className="mb-6">
          Your role does not have access to that page.
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Founders" value={founders} />
        <Stat label="Investors" value={investors} />
        {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).slice(0, 2).map((k) => (
          <Stat key={k} label={`Open ${KIND_LABEL[k]} cases`} value={openCount(k)} href={can(user, "cases.view") ? `/admin/cases?kind=${k}` : undefined} highlight />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card title="Users by tier">
          <ul className="space-y-3">
            {TIER_LABELS.map((label, t) => (
              <li key={label} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">
                  T{t} · {label}
                </span>
                <span className="font-mono text-white">{tierCount(t)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between border-t border-white/10 pt-3 text-sm">
              <span className="text-slate-300">Open final (T4) cases</span>
              <span className="font-mono text-white">{openCount("FINAL")}</span>
            </li>
          </ul>
        </Card>
        <Card title="Latest sign-ups">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Roles</th>
                  <th className="pb-3 font-medium">Country</th>
                  <th className="pb-3 font-medium">Tier</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recent.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5">
                      {can(user, "users.view") ? (
                        <Link href={`/admin/users/${u.id}`} className="text-white hover:text-brand-200">
                          {u.firstName} {u.lastName}
                        </Link>
                      ) : (
                        `${u.firstName} ${u.lastName}`
                      )}
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="py-2.5 text-slate-300">{u.roles.join(", ").toLowerCase()}</td>
                    <td className="py-2.5 text-slate-300">{u.countryOfResidence}</td>
                    <td className="py-2.5 font-mono">T{u.tier}</td>
                    <td className="py-2.5">
                      <StatusBadge status={u.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!recent.length && <p className="text-sm text-slate-400">No sign-ups yet.</p>}
          </div>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, href, highlight }: { label: string; value: number; href?: string; highlight?: boolean }) {
  const body = (
    <div className={`glass rounded-2xl p-5 transition ${href ? "hover:bg-white/10" : ""}`}>
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${highlight && value > 0 ? "text-brand-300" : "text-white"}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
