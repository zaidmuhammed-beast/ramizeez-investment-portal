import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/auth/rbac";
import { isOverdue, reportSchedule, type Health } from "@/lib/execution/rules";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HealthPill } from "@/components/execution/views";
import { SendRemindersForm } from "@/components/execution/forms";

export const metadata: Metadata = { title: "Execution" };

export default async function ExecutionPage({ searchParams }: PageProps<"/admin/execution">) {
  const me = await requireTeam("deals.execution");
  const { mine } = await searchParams;
  const deals = await db.deal.findMany({
    where: { status: { in: ["FUNDED", "COMPLETED"] }, ...(mine ? { managerId: me.id } : {}) },
    orderBy: [{ health: "desc" }, { fundedAt: "asc" }],
    include: {
      pitch: { select: { title: true, sector: true, city: true } },
      manager: { select: { firstName: true, lastName: true } },
      tasks: { select: { status: true, dueDate: true } },
      reports: { select: { period: true, status: true } },
      claims: { select: { status: true } },
    },
  });
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Execution"
        description="Funded companies: status, tasks, monthly investor reports and milestones. Every company has one RamiZeeZ execution manager."
        actions={
          <div className="flex items-center gap-3">
            <Link href={mine ? "/admin/execution" : "/admin/execution?mine=1"} className="text-sm text-brand-300 hover:underline">
              {mine ? "Show all companies" : "Only mine"}
            </Link>
            <SendRemindersForm />
          </div>
        }
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-3 pr-3 font-medium">Company</th>
                <th className="pb-3 pr-3 font-medium">Status</th>
                <th className="pb-3 pr-3 font-medium">Manager</th>
                <th className="pb-3 pr-3 font-medium">Open tasks</th>
                <th className="pb-3 font-medium">Reports & evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {deals.map((d) => {
                const open = d.tasks.filter((t) => t.status !== "DONE");
                const overdueTasks = open.filter((t) => isOverdue(t, now)).length;
                const schedule = d.fundedAt ? reportSchedule(d.fundedAt, now, d.reports) : [];
                const overdueReports = schedule.filter((x) => x.state === "OVERDUE").length;
                const toReview = d.reports.filter((r) => r.status === "SUBMITTED").length + d.claims.filter((c) => c.status === "SUBMITTED").length;
                return (
                  <tr key={d.id}>
                    <td className="py-3 pr-3">
                      <Link href={`/admin/execution/${d.id}`} className="font-medium text-white hover:text-brand-200">
                        {d.pitch.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {d.pitch.sector} · {d.pitch.city} · {d.status === "COMPLETED" ? "completed" : `funded ${d.fundedAt?.toISOString().slice(0, 10)}`}
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      <HealthPill health={d.health as Health} />
                    </td>
                    <td className="py-3 pr-3 text-slate-300">{d.manager ? `${d.manager.firstName} ${d.manager.lastName}` : <Badge tone="amber">Unassigned</Badge>}</td>
                    <td className="py-3 pr-3 text-slate-300">
                      {open.length}
                      {overdueTasks > 0 && <span className="text-rose-300"> ({overdueTasks} overdue)</span>}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {toReview > 0 && <Badge tone="blue">{toReview} to review</Badge>}
                        {overdueReports > 0 && <Badge tone="red">{overdueReports} report{overdueReports > 1 ? "s" : ""} overdue</Badge>}
                        {!toReview && !overdueReports && <span className="text-xs text-slate-500">Up to date</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!deals.length && <p className="py-3 text-sm text-slate-500">No funded companies{mine ? " assigned to you" : ""} yet.</p>}
        </div>
      </Card>
    </>
  );
}
