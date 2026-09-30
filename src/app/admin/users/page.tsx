import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/auth/rbac";
import { Card, PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireTeam("users.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const role = sp.role === "FOUNDER" || sp.role === "INVESTOR" ? sp.role : undefined;
  const tier = typeof sp.tier === "string" && /^[0-4]$/.test(sp.tier) ? Number(sp.tier) : undefined;

  const where: Prisma.UserWhereInput = {
    NOT: { roles: { has: "TEAM" } },
    ...(role ? { roles: { has: role } } : {}),
    ...(tier !== undefined ? { tier } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q.replace(/\s/g, "") } },
          ],
        }
      : {}),
  };
  const users = await db.user.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <>
      <PageHeader title="Users" description="Founders and investors on the platform." />
      <Card className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <input name="q" defaultValue={q} placeholder="Search name, email or phone" className="field-control max-w-sm" />
          <select name="role" defaultValue={role ?? ""} className="field-control max-w-44">
            <option value="">All roles</option>
            <option value="FOUNDER">Founders</option>
            <option value="INVESTOR">Investors</option>
          </select>
          <select name="tier" defaultValue={tier?.toString() ?? ""} className="field-control max-w-36">
            <option value="">Any tier</option>
            {[0, 1, 2, 3, 4].map((t) => (
              <option key={t} value={t}>
                Tier {t}
              </option>
            ))}
          </select>
          <button className="glass rounded-xl px-4 py-2.5 text-sm text-white hover:bg-white/10">Search</button>
        </form>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Roles</th>
                <th className="pb-3 font-medium">Country</th>
                <th className="pb-3 font-medium">Tier</th>
                <th className="pb-3 font-medium">2FA</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.03]">
                  <td className="py-3">
                    <Link href={`/admin/users/${u.id}`} className="font-medium text-white hover:text-brand-200">
                      {u.firstName} {u.lastName}
                    </Link>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="py-3 text-slate-300">{u.roles.join(", ").toLowerCase()}</td>
                  <td className="py-3 text-slate-300">{u.countryOfResidence}</td>
                  <td className="py-3 font-mono">T{u.tier}</td>
                  <td className="py-3">{u.totpEnabledAt ? "✓" : "—"}</td>
                  <td className="py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="py-3 text-slate-400">{u.createdAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length && <p className="py-6 text-center text-sm text-slate-400">No users found.</p>}
        </div>
      </Card>
    </>
  );
}
