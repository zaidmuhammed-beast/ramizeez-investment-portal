import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/auth/rbac";
import { Card, PageHeader } from "@/components/ui/card";
import { CampaignList, TaskList } from "@/components/execution/views";
import { CampaignForm, CampaignResultsForm, TaskStatusForm } from "@/components/execution/forms";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Marketing" };

/** Campaigns for funded companies. Marketing sees the business, never KYC or deal financials. */
export default async function MarketingPage({ searchParams }: PageProps<"/admin/marketing">) {
  await requireTeam("marketing.manage");
  const { deal: selected } = await searchParams;
  const deals = await db.deal.findMany({
    where: { status: { in: ["FUNDED", "COMPLETED"] } },
    orderBy: { fundedAt: "desc" },
    select: {
      id: true,
      currency: true,
      pitch: { select: { title: true, sector: true, city: true, oneLiner: true, targetCustomers: true, channels: true } },
      campaigns: { orderBy: { startDate: "desc" } },
      tasks: { where: { area: "MARKETING" }, orderBy: { dueDate: "asc" } },
    },
  });
  const current = deals.find((d) => d.id === selected) ?? deals[0];
  const now = new Date();

  return (
    <>
      <PageHeader title="Marketing" description="Launch and growth campaigns for funded businesses. The Tank events page is managed under Tank." />
      {!current ? (
        <Card>
          <p className="text-sm text-slate-400">No funded businesses yet.</p>
        </Card>
      ) : (
        <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[260px_1fr]">
          <nav className="glass h-fit rounded-2xl p-2">
            {deals.map((d) => (
              <Link key={d.id} href={`/admin/marketing?deal=${d.id}`} className={cn("block rounded-xl px-3 py-2 text-sm", d.id === current.id ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}>
                {d.pitch.title}
                <span className="block text-xs text-slate-500">
                  {d.campaigns.filter((c) => c.status === "LIVE").length} live · {d.campaigns.length} campaigns
                </span>
              </Link>
            ))}
          </nav>
          <div className="space-y-6">
            <Card title={current.pitch.title} description={`${current.pitch.sector} · ${current.pitch.city}`}>
              <p className="text-sm text-slate-300">{current.pitch.oneLiner}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Target customers</dt>
                  <dd className="text-slate-200">{current.pitch.targetCustomers ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Channels in the plan</dt>
                  <dd className="text-slate-200">{current.pitch.channels ?? "—"}</dd>
                </div>
              </dl>
            </Card>
            <Card title="Campaigns">
              <CampaignList campaigns={current.campaigns} renderAction={(c) => <CampaignResultsForm campaign={c} />} />
              <div className="mt-6 border-t border-white/10 pt-5">
                <h3 className="mb-3 text-sm font-semibold text-white">New campaign</h3>
                <CampaignForm dealId={current.id} currency={current.currency} />
              </div>
            </Card>
            <Card title="Marketing tasks">
              <TaskList tasks={current.tasks} now={now} renderAction={(t) => <TaskStatusForm taskId={t.id} status={t.status} />} />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
