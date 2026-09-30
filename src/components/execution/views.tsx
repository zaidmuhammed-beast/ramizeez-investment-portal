import type { ReactNode } from "react";
import type { Campaign, DealTask, InvestorReport } from "@prisma/client";
import { formatMoney } from "@/config/platform";
import { HEALTH_LABEL, campaignRates, isOverdue, periodLabel, type Health } from "@/lib/execution/rules";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const n = (d: unknown) => (d === null || d === undefined ? null : Number(d));

export const HealthPill = ({ health }: { health: Health }) => <Badge tone={health === "GREEN" ? "green" : health === "AMBER" ? "amber" : "red"}>{HEALTH_LABEL[health]}</Badge>;

const TASK: Record<string, { tone: BadgeTone; label: string }> = {
  TODO: { tone: "neutral", label: "To do" },
  IN_PROGRESS: { tone: "blue", label: "In progress" },
  BLOCKED: { tone: "red", label: "Blocked" },
  DONE: { tone: "green", label: "Done" },
};

export function TaskList({ tasks, now, renderAction, showOwner }: { tasks: (DealTask & { assignee?: { firstName: string } | null })[]; now: Date; renderAction?: (t: DealTask) => ReactNode; showOwner?: boolean }) {
  if (!tasks.length) return <p className="text-sm text-slate-500">No tasks.</p>;
  return (
    <ul className="space-y-3">
      {tasks.map((t) => (
        <li key={t.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={t.status === "DONE" ? "text-slate-400 line-through" : "text-white"}>{t.title}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="neutral">{t.area.toLowerCase()}</Badge>
              {t.forFounder && <Badge tone="gold">Founder</Badge>}
              {isOverdue(t, now) && <Badge tone="red">Overdue</Badge>}
              <Badge tone={TASK[t.status].tone}>{TASK[t.status].label}</Badge>
            </div>
          </div>
          {t.detail && <p className="mt-1 text-slate-400">{t.detail}</p>}
          <p className="mt-1 text-xs text-slate-500">
            {t.dueDate && `Due ${t.dueDate.toISOString().slice(0, 10)}`}
            {showOwner && t.assignee && ` · ${t.assignee.firstName}`}
          </p>
          {t.founderNote && <p className="mt-1 text-xs text-amber-200">Founder: {t.founderNote}</p>}
          {renderAction && <div className="mt-3">{renderAction(t)}</div>}
        </li>
      ))}
    </ul>
  );
}

const REPORT: Record<string, { tone: BadgeTone; label: string }> = {
  PUBLISHED: { tone: "green", label: "Published" },
  SUBMITTED: { tone: "blue", label: "With RamiZeeZ" },
  RETURNED: { tone: "amber", label: "Returned" },
  DUE: { tone: "gold", label: "Due" },
  OVERDUE: { tone: "red", label: "Overdue" },
};
export const ReportStatePill = ({ state }: { state: string }) => <Badge tone={REPORT[state].tone}>{REPORT[state].label}</Badge>;

export function ReportCard({ report, currency, children, fileHref, files }: { report: InvestorReport; currency: string; children?: ReactNode; fileHref: (fileId: string) => string; files?: { id: string; originalName: string | null }[] }) {
  const revenue = n(report.revenue)!;
  const costs = n(report.costs)!;
  const profit = revenue - costs;
  const fmt = (v: number) => formatMoney(v, currency);
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-white">{periodLabel(report.period)}</h3>
        <ReportStatePill state={report.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Revenue", fmt(revenue)],
          ["Costs", fmt(costs)],
          [profit >= 0 ? "Profit" : "Loss", fmt(Math.abs(profit))],
          ["Cash in bank", n(report.cashInBank) === null ? "—" : fmt(n(report.cashInBank)!)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className={`font-mono ${k === "Loss" ? "text-rose-300" : "text-white"}`}>{v}</dd>
          </div>
        ))}
      </dl>
      {(report.customers !== null || report.keyMetric) && (
        <p className="mt-3 text-slate-300">
          {report.customers !== null && `${report.customers.toLocaleString("en-US")} customers`}
          {report.customers !== null && report.keyMetric && " · "}
          {report.keyMetric}
        </p>
      )}
      <div className="mt-4 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Highlights</p>
          <p className="whitespace-pre-line text-slate-200">{report.highlights}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Challenges</p>
          <p className="whitespace-pre-line text-slate-200">{report.challenges}</p>
        </div>
        {report.asks && (
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">How investors can help</p>
            <p className="whitespace-pre-line text-slate-200">{report.asks}</p>
          </div>
        )}
        {report.commentary && <p className="rounded-xl border border-brand-400/20 bg-brand-400/5 p-3 text-brand-100">RamiZeeZ: {report.commentary}</p>}
        {report.status === "RETURNED" && report.returnNote && <p className="text-amber-200">Returned: {report.returnNote}</p>}
      </div>
      {report.fileIds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {report.fileIds.map((id) => (
            <a key={id} href={fileHref(id)} target="_blank" className="text-xs text-brand-300 hover:underline">
              📎 {files?.find((f) => f.id === id)?.originalName ?? "attachment"}
            </a>
          ))}
        </div>
      )}
      {children && <div className="mt-4 border-t border-white/10 pt-4">{children}</div>}
    </article>
  );
}

const CAMPAIGN: Record<string, BadgeTone> = { PLANNED: "neutral", LIVE: "green", ENDED: "violet" };

export function CampaignList({ campaigns, renderAction, showBudget = true }: { campaigns: Campaign[]; renderAction?: (c: Campaign) => ReactNode; showBudget?: boolean }) {
  if (!campaigns.length) return <p className="text-sm text-slate-500">No campaigns yet.</p>;
  return (
    <ul className="space-y-3">
      {campaigns.map((c) => {
        const rates = campaignRates({ reach: c.reach, leads: c.leads, conversions: c.conversions, budget: n(c.budget) });
        return (
          <li key={c.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-white">
                {c.name} <span className="text-slate-500">· {c.channel}</span>
              </p>
              <Badge tone={CAMPAIGN[c.status]}>{c.status.toLowerCase()}</Badge>
            </div>
            <p className="mt-1 text-slate-400">{c.objective}</p>
            <p className="mt-1 text-xs text-slate-500">
              {c.startDate.toISOString().slice(0, 10)}
              {c.endDate && ` → ${c.endDate.toISOString().slice(0, 10)}`}
              {showBudget && c.budget !== null && ` · budget ${formatMoney(Number(c.budget), c.currency)}`}
            </p>
            {(c.reach !== null || c.leads !== null || c.conversions !== null) && (
              <p className="mt-2 text-xs text-slate-300">
                {c.reach !== null && `${c.reach.toLocaleString("en-US")} reached`}
                {c.leads !== null && ` · ${c.leads.toLocaleString("en-US")} leads${rates.leadRate !== null ? ` (${rates.leadRate}%)` : ""}`}
                {c.conversions !== null && ` · ${c.conversions.toLocaleString("en-US")} customers${rates.conversionRate !== null ? ` (${rates.conversionRate}%)` : ""}`}
                {showBudget && rates.costPerConversion !== null && ` · ${formatMoney(rates.costPerConversion, c.currency)} per customer`}
              </p>
            )}
            {c.resultsNote && <p className="mt-1 text-xs text-slate-400">{c.resultsNote}</p>}
            {renderAction && <div className="mt-3">{renderAction(c)}</div>}
          </li>
        );
      })}
    </ul>
  );
}
