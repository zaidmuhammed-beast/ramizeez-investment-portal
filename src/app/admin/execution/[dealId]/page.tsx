import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can, requireTeam } from "@/lib/auth/rbac";
import { reportSchedule, periodLabel, type Health } from "@/lib/execution/rules";
import { Card, PageHeader } from "@/components/ui/card";
import { HealthPill, ReportCard, ReportStatePill, TaskList, CampaignList } from "@/components/execution/views";
import { AssignManagerForm, HealthForm, ReviewReportForm, TaskForm, TaskStatusForm } from "@/components/execution/forms";

export const metadata: Metadata = { title: "Company execution" };

const AREAS = [
  { value: "EXECUTION", label: "Execution" },
  { value: "MARKETING", label: "Marketing" },
  { value: "LEGAL", label: "Legal" },
  { value: "FINANCE", label: "Finance" },
];

export default async function ExecutionDealPage({ params }: PageProps<"/admin/execution/[dealId]">) {
  const me = await requireTeam("deals.execution");
  const { dealId } = await params;
  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: {
      pitch: { select: { id: true, title: true, founder: { select: { firstName: true, lastName: true } } } },
      tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }], include: { assignee: { select: { firstName: true } } } },
      reports: { orderBy: { period: "desc" } },
      campaigns: { orderBy: { startDate: "desc" } },
    },
  });
  if (!deal) notFound();
  await audit("execution.viewed", { actorId: me.id, targetType: "Deal", targetId: deal.id });
  const team = await db.user.findMany({ where: { roles: { has: "TEAM" }, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, teamRole: true }, orderBy: { firstName: "asc" } });
  const managers = team.filter((u) => can({ roles: ["TEAM"], teamRole: u.teamRole }, "deals.execution"));
  const now = new Date();
  const schedule = deal.fundedAt ? reportSchedule(deal.fundedAt, now, deal.reports) : [];
  const files = await db.storedFile.findMany({ where: { id: { in: deal.reports.flatMap((r) => r.fileIds) } }, select: { id: true, originalName: true } });

  return (
    <>
      <Link href="/admin/execution" className="text-sm text-slate-400 hover:text-white">
        ← Execution
      </Link>
      <PageHeader
        title={deal.pitch.title}
        description={`Founder ${deal.pitch.founder.firstName} ${deal.pitch.founder.lastName} · funded ${deal.fundedAt?.toISOString().slice(0, 10) ?? "—"}`}
        actions={
          <div className="flex items-center gap-3">
            <HealthPill health={deal.health as Health} />
            <Link href={`/admin/deals/${deal.pitch.id}`} className="text-sm text-brand-300 hover:underline">
              Round, escrow & milestones →
            </Link>
          </div>
        }
      />
      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card title="Monthly investor reports" description="Due by the 10th of the following month. Nothing reaches investors until you publish it.">
            <ul className="mb-5 flex flex-wrap gap-2">
              {schedule.map((x) => (
                <li key={x.period} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300">
                  {periodLabel(x.period)} <ReportStatePill state={x.state} />
                </li>
              ))}
              {!schedule.length && <li className="text-sm text-slate-500">The first report is due after the funding month ends.</li>}
            </ul>
            <div className="space-y-4">
              {deal.reports.map((r) => (
                <ReportCard key={r.id} report={r} currency={deal.currency} files={files} fileHref={(id) => `/api/reports/${r.id}/files/${id}`}>
                  {r.status === "SUBMITTED" ? <ReviewReportForm reportId={r.id} /> : undefined}
                </ReportCard>
              ))}
            </div>
          </Card>
          <Card title="Tasks">
            <TaskList tasks={deal.tasks} now={now} showOwner renderAction={(t) => <TaskStatusForm taskId={t.id} status={t.status} />} />
            <div className="mt-6 border-t border-white/10 pt-5">
              <h3 className="mb-3 text-sm font-semibold text-white">Add a task</h3>
              <TaskForm dealId={deal.id} areas={AREAS} assignees={team.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))} />
            </div>
          </Card>
        </div>
        <aside className="space-y-6">
          <Card title="Ownership">
            <AssignManagerForm dealId={deal.id} current={deal.managerId ?? undefined} managers={managers.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))} />
          </Card>
          <Card title="Status" description={deal.healthUpdatedAt ? `Updated ${deal.healthUpdatedAt.toISOString().slice(0, 10)}` : undefined}>
            <HealthForm dealId={deal.id} current={deal.health} note={deal.healthNote ?? undefined} />
          </Card>
          <Card title="Marketing" actions={can(me, "marketing.manage") ? <Link href={`/admin/marketing?deal=${deal.id}`} className="text-sm text-brand-300 hover:underline">Manage →</Link> : undefined}>
            <CampaignList campaigns={deal.campaigns} />
          </Card>
        </aside>
      </div>
    </>
  );
}
