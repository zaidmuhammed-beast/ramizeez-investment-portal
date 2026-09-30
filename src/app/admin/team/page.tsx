import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireTeam, TEAM_ROLE_LABELS } from "@/lib/auth/rbac";
import { COUNTRIES } from "@/lib/countries";
import { Card, PageHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { TeamMemberForm } from "./team-form";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  await requireTeam("team.manage");
  const team = await db.user.findMany({ where: { roles: { has: "TEAM" } }, orderBy: { createdAt: "asc" } });
  return (
    <>
      <PageHeader title="Team" description="RamiZeeZ staff accounts. Each role only gets the access its job needs." />
      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_400px]">
        <Card>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">2FA</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {team.map((m) => (
                <tr key={m.id}>
                  <td className="py-3">
                    <p className="font-medium text-white">
                      {m.firstName} {m.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{m.email}</p>
                  </td>
                  <td className="py-3">
                    <Badge tone="violet">{m.teamRole ? TEAM_ROLE_LABELS[m.teamRole] : "—"}</Badge>
                  </td>
                  <td className="py-3">{m.totpEnabledAt ? "✓" : <span className="text-amber-300">pending</span>}</td>
                  <td className="py-3">
                    <StatusBadge status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Add team member" strong>
          <TeamMemberForm
            roles={Object.entries(TEAM_ROLE_LABELS).map(([value, label]) => ({ value, label }))}
            countries={COUNTRIES.filter((c) => c.dial).map((c) => ({ value: c.code, label: `${c.name} (${c.dial})` }))}
          />
        </Card>
      </div>
    </>
  );
}
