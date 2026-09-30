import type { ReactNode } from "react";
import { countryName } from "@/lib/countries";
import { formatMoney } from "@/config/platform";
import type { PitchData } from "@/lib/pitch/data";
import { costTotal, impliedPreMoney, milestoneTotal, netOfFee, ownershipAfter, revenueShareTotal } from "@/lib/pitch/deal";
import { COST_CATEGORIES, RISK_CATEGORIES } from "@/lib/pitch/sections";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const label = (list: readonly (readonly [string, string])[], key: string) => list.find(([k]) => k === key)?.[1] ?? key;
const DEAL_LABEL: Record<string, string> = { EQUITY: "Equity", MUSHARAKAH: "Musharakah", MUDARABAH: "Mudarabah", REVENUE_SHARE: "Revenue share" };

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-300">{title}</h3>
      <div className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-200">{children || <span className="text-slate-500">—</span>}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-white">{value ?? "—"}</p>
    </div>
  );
}

type FileRow = { id: string; originalName: string | null; mimeType: string };

export function PitchView({ pitch: p, files }: { pitch: PitchData; files: Record<string, FileRow> }) {
  const money = (v: number | null) => (v === null ? "—" : formatMoney(v, p.currency));
  const fee = p.amount !== null ? netOfFee(p.amount) : null;
  const own = ownershipAfter(p.dealType === "EQUITY" ? p.equityPercent : null);

  return (
    <div className="space-y-6">
      <Card title={p.title} description={[p.sector, p.city, p.country && countryName(p.country)].filter(Boolean).join(" · ")} actions={<Badge tone="violet">{p.type === "IDEA" ? "Idea stage" : "Operating business"}</Badge>}>
        <p className="text-lg text-white">{p.oneLiner}</p>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <Block title="Problem">{p.problem}</Block>
          <Block title="Solution">{p.solution}</Block>
          <Block title="Why now">{p.whyNow}</Block>
        </div>
      </Card>

      <Card title="The proposal">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Raising" value={money(p.amount)} />
          <Stat label="Minimum investment" value={money(p.minTicket)} />
          <Stat label="Structure" value={p.dealType ? DEAL_LABEL[p.dealType] : "—"} />
          <Stat label="Business receives (after 10% fee)" value={fee ? money(fee.net) : "—"} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {p.dealType === "EQUITY" && (
            <>
              <Stat label="Equity to investors" value={p.equityPercent !== null ? `${p.equityPercent}%` : "—"} />
              <Stat label="Pre-money valuation" value={money(p.valuation)} />
              <Stat
                label="Implied by amount / equity"
                value={p.amount && p.equityPercent ? money(impliedPreMoney(p.amount, p.equityPercent)) : "—"}
              />
              <Stat label="Ownership after" value={`Founders ${own.founders}% · Investors ${own.investors}% · RamiZeeZ ${own.ramizeez}%`} />
            </>
          )}
          {(p.dealType === "MUSHARAKAH" || p.dealType === "MUDARABAH") && (
            <>
              <Stat label="Investors' profit share" value={p.profitSharePercent !== null ? `${p.profitSharePercent}%` : "—"} />
              {p.dealType === "MUSHARAKAH" && <Stat label="Founder capital" value={money(p.founderCapital)} />}
              <Stat label="Term" value={p.termMonths ? `${p.termMonths} months` : "—"} />
            </>
          )}
          {p.dealType === "REVENUE_SHARE" && (
            <>
              <Stat label="Share of revenue" value={p.revenueSharePercent !== null ? `${p.revenueSharePercent}%` : "—"} />
              <Stat label="Repayment cap" value={p.returnCapMultiple ? `${p.returnCapMultiple}× (${money(p.amount ? revenueShareTotal(p.amount, p.returnCapMultiple) : null)})` : "—"} />
              <Stat label="Maximum term" value={p.termMonths ? `${p.termMonths} months` : "—"} />
            </>
          )}
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {p.dealType === "EQUITY" && <Block title="Valuation method">{p.valuationMethod}</Block>}
          <Block title="Expected return">{p.expectedReturn}</Block>
          <Block title="Exit / repayment">{p.exitOptions}</Block>
          <Block title="Beyond money">{p.nonFinancialAsks}</Block>
        </div>
      </Card>

      <Card title="Team & experience">
        <Block title="Experience & knowledge of this business">{p.teamExperience}</Block>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {p.teamMembers.map((m, i) => (
            <li key={i} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              <span className="text-white">{m.name}</span> · {m.role} · {m.commitment === "FULL_TIME" ? "full time" : "part time"}
              {m.equityPercent !== null && ` · ${m.equityPercent}%`}
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <Block title="Advisors">{p.advisors}</Block>
          <Block title="Planned hires">{p.plannedHires}</Block>
        </div>
      </Card>

      <Card title="Market & business model">
        <div className="grid gap-5 md:grid-cols-2">
          <Block title="Target customers">{p.targetCustomers}</Block>
          <Block title="Market size">{p.marketSize}</Block>
          <Block title="Competitors">{p.competitors}</Block>
          <Block title="Differentiation">{p.differentiation}</Block>
          <Block title="Revenue model">{p.revenueModel}</Block>
          <Block title="Pricing">{p.pricing}</Block>
          <Block title="Unit economics">{p.unitEconomics}</Block>
          <Block title="Channels">{p.channels}</Block>
          <Block title="Partners & suppliers">{p.partners}</Block>
        </div>
      </Card>

      {p.type === "EXISTING" && (
        <Card title="Current status">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Started" value={p.startedYear} />
            <Stat label="Employees" value={p.employees} />
            <Stat label="Revenue, last 12 months" value={money(p.revenueLast12)} />
            <Stat label="Expenses, last 12 months" value={money(p.expensesLast12)} />
            <Stat label="Current monthly revenue" value={money(p.monthlyRevenue)} />
            <Stat label="Customers" value={p.customers} />
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <Block title="Traction">{p.tractionNotes}</Block>
            <Block title="Liabilities & loans">{p.liabilities}</Block>
            <Block title="Existing investors">{p.existingInvestors}</Block>
          </div>
        </Card>
      )}

      <Card title="Use of funds" description={fee ? `Cost lines total ${money(costTotal(p.costItems))} of ${money(fee.net)} available after the ${money(fee.fee)} RamiZeeZ fee.` : undefined}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Unit cost</th>
                <th className="pb-2 text-right font-medium">Total</th>
                <th className="pb-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {p.costItems.map((c, i) => (
                <tr key={i}>
                  <td className="py-2 text-slate-400">{label(COST_CATEGORIES, c.category)}</td>
                  <td className="py-2 text-white">{c.item}</td>
                  <td className="py-2 text-right font-mono">{c.quantity}</td>
                  <td className="py-2 text-right font-mono">{c.unitCost.toLocaleString("en-US")}</td>
                  <td className="py-2 text-right font-mono text-white">{(c.quantity * c.unitCost).toLocaleString("en-US")}</td>
                  <td className="py-2 text-slate-400">{c.timing}</td>
                </tr>
              ))}
              {fee && (
                <tr className="text-slate-400">
                  <td className="py-2">Platform</td>
                  <td className="py-2">RamiZeeZ success fee (10%)</td>
                  <td />
                  <td />
                  <td className="py-2 text-right font-mono">{fee.fee.toLocaleString("en-US")}</td>
                  <td className="py-2">On funding</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Execution roadmap" description={`Milestone budgets total ${money(milestoneTotal(p.milestones))}. Once funded, money is released against these milestones.`}>
        <ol className="relative space-y-4 border-l border-white/10 pl-5">
          {p.milestones.map((m, i) => (
            <li key={i}>
              <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full bg-brand-400" />
              <p className="text-sm text-white">
                <span className="font-mono text-brand-200">Month {m.month}</span> · {m.title}
              </p>
              <p className="text-sm text-slate-400">
                Success: {m.successMetric} · Budget {money(m.budget)}
                {m.owner && ` · Owner: ${m.owner}`}
              </p>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Financial projections">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-2 text-left font-medium">Year</th>
                <th className="pb-2 font-medium">Revenue</th>
                <th className="pb-2 font-medium">Costs</th>
                <th className="pb-2 font-medium">Profit</th>
                <th className="pb-2 font-medium">Cash flow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {p.projections.map((y) => (
                <tr key={y.year}>
                  <td className="py-2 text-left font-sans text-slate-400">Year {y.year}</td>
                  <td className="py-2">{y.revenue?.toLocaleString("en-US") ?? "—"}</td>
                  <td className="py-2">{y.costs?.toLocaleString("en-US") ?? "—"}</td>
                  <td className="py-2 text-white">{y.revenue !== null && y.costs !== null ? (y.revenue - y.costs).toLocaleString("en-US") : "—"}</td>
                  <td className="py-2">{y.cashFlow?.toLocaleString("en-US") ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Block title="Assumptions">{p.projectionAssumptions}</Block>
        </div>
      </Card>

      <Card title="Risks">
        <ul className="space-y-3">
          {p.risks.map((r, i) => (
            <li key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <Badge tone="amber">{label(RISK_CATEGORIES, r.category)}</Badge>
              <p className="mt-2 text-white">{r.risk}</p>
              <p className="mt-1 text-slate-400">Plan: {r.mitigation}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Block title="If the business fails">{p.failurePlan}</Block>
        </div>
      </Card>

      <Card title="Deck & media">
        <ul className="space-y-1 text-sm">
          {[p.deckFileId, ...p.imageFileIds, ...p.documentFileIds]
            .filter((id): id is string => !!id && !!files[id])
            .map((id) => (
              <li key={id}>
                <a href={`/api/files/${id}`} target="_blank" className="text-brand-300 hover:underline">
                  📎 {files[id].originalName ?? "file"}
                </a>
                {id === p.deckFileId && <Badge tone="violet" className="ml-2">Deck</Badge>}
              </li>
            ))}
        </ul>
        {p.videoUrl && (
          <p className="mt-3 text-sm">
            Video:{" "}
            <a href={p.videoUrl} target="_blank" rel="noreferrer noopener" className="text-brand-300 hover:underline">
              {p.videoUrl}
            </a>
          </p>
        )}
      </Card>
    </div>
  );
}
