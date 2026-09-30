import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/auth/rbac";
import { Card, PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireTeam("audit.view");
  const sp = await searchParams;
  const action = typeof sp.action === "string" ? sp.action.trim().slice(0, 80) : "";
  const target = typeof sp.target === "string" ? sp.target.trim().slice(0, 80) : "";
  const logs = await db.auditLog.findMany({
    where: {
      ...(action ? { action: { startsWith: action } } : {}),
      ...(target ? { OR: [{ targetId: target }, { actorId: target }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { actor: { select: { firstName: true, lastName: true, email: true } } },
  });
  return (
    <>
      <PageHeader title="Audit log" description="Every sign-in, decision, document view and profile change. Entries can't be edited." />
      <Card className="mb-6">
        <form method="get" className="flex flex-wrap gap-3">
          <input name="action" defaultValue={action} placeholder="Action prefix, e.g. kyc. or auth.login" className="field-control max-w-xs" />
          <input name="target" defaultValue={target} placeholder="User / target ID" className="field-control max-w-xs" />
          <button className="glass rounded-xl px-4 py-2.5 text-sm text-white hover:bg-white/10">Filter</button>
        </form>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-3 font-medium">When (UTC)</th>
                <th className="pb-3 font-medium">Actor</th>
                <th className="pb-3 font-medium">Action</th>
                <th className="pb-3 font-medium">Target</th>
                <th className="pb-3 font-medium">IP</th>
                <th className="pb-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap py-2 text-slate-400">{l.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                  <td className="py-2 text-slate-200">{l.actor ? l.actor.email : "—"}</td>
                  <td className="py-2 text-brand-200">{l.action}</td>
                  <td className="py-2 text-slate-400">{l.targetType ? `${l.targetType}:${l.targetId?.slice(-8)}` : "—"}</td>
                  <td className="py-2 text-slate-400">{l.ip ?? "—"}</td>
                  <td className="max-w-xs truncate py-2 text-slate-500">{l.metadata ? JSON.stringify(l.metadata) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
