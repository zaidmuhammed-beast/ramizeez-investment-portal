import type { ReactNode } from "react";
import { formatMoney } from "@/config/platform";
import type { PitchData } from "@/lib/pitch/data";
import { netOfFee, ownershipAfter, revenueShareTotal } from "@/lib/pitch/deal";
import { COST_CATEGORIES, RISK_CATEGORIES } from "@/lib/pitch/sections";
import { visibleAt, type ConfidentialField } from "@/lib/investor/disclosure";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function Block({ title, children, hidden }: { title: string; children: ReactNode; hidden?: boolean }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-300">{title}</h3>
      {hidden ? (
        <p className="mt-1.5 text-sm text-slate-500">🔒 Shared in the full data room</p>
      ) : (
        <div className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-200">{children || "—"}</div>
      )}
    </div>
  );
}

/**
 * Level 2: the NDA summary. The business name, the founder's identity, documents and exact
 * line items stay hidden, as do any fields the founder marked confidential.
 */
export function SummaryView({ pitch: p }: { pitch: PitchData }) {
  const hide = (f: ConfidentialField) => !visibleAt("SUMMARY", f, p.confidentialFields);
  const money = (v: number | null) => (v === null ? "—" : formatMoney(v, p.currency));
  const fee = p.amount !== null ? netOfFee(p.amount) : null;
  const byCategory = new Map<string, number>();
  for (const c of p.costItems) byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + c.quantity * c.unitCost);
  const label = (list: readonly (readonly [string, string])[], k: string) => list.find(([x]) => x === k)?.[1] ?? k;
  const own = ownershipAfter(p.dealType === "EQUITY" ? p.equityPercent : null);

  return (
    <div className="space-y-6">
      <Card title="The opportunity">
        <p className="text-lg text-white">{p.oneLiner}</p>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <Block title="Problem">{p.problem}</Block>
          <Block title="Solution" hidden={hide("solution")}>
            {p.solution}
          </Block>
          <Block title="Why now">{p.whyNow}</Block>
        </div>
      </Card>

      <Card title="Market & model">
        <div className="grid gap-5 md:grid-cols-2">
          <Block title="Target customers">{p.targetCustomers}</Block>
          <Block title="Market size">{p.marketSize}</Block>
          <Block title="Competitors" hidden={hide("competitors")}>
            {p.competitors}
          </Block>
          <Block title="Differentiation" hidden={hide("differentiation")}>
            {p.differentiation}
          </Block>
          <Block title="Revenue model">{p.revenueModel}</Block>
          <Block title="Pricing" hidden={hide("pricing")}>
            {p.pricing}
          </Block>
          <Block title="Unit economics" hidden={hide("unitEconomics")}>
            {p.unitEconomics}
          </Block>
          <Block title="Suppliers & partners" hidden={hide("partners")}>
            {p.partners}
          </Block>
        </div>
      </Card>

      <Card title="Team">
        <p className="text-sm text-slate-300">
          {p.teamMembers.length} team member(s):{" "}
          {p.teamMembers.map((m) => `${m.role} (${m.commitment === "FULL_TIME" ? "full time" : "part time"})`).join(", ")}. Names and backgrounds are
          shared in the full data room.
        </p>
      </Card>

      <Card title="Terms">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <p>
            <span className="block text-xs text-slate-400">Raising</span>
            <span className="text-white">{money(p.amount)}</span>
          </p>
          <p>
            <span className="block text-xs text-slate-400">Minimum investment</span>
            <span className="text-white">{money(p.minTicket)}</span>
          </p>
          <p>
            <span className="block text-xs text-slate-400">Business receives after the 10% fee</span>
            <span className="text-white">{fee ? money(fee.net) : "—"}</span>
          </p>
          {p.dealType === "EQUITY" && (
            <p className="sm:col-span-3">
              <span className="block text-xs text-slate-400">Equity</span>
              <span className="text-white">
                {p.equityPercent}% to investors at {money(p.valuation)} pre-money. Ownership after: founders {own.founders}%, investors {own.investors}%, RamiZeeZ {own.ramizeez}%.
              </span>
            </p>
          )}
          {(p.dealType === "MUSHARAKAH" || p.dealType === "MUDARABAH") && (
            <p className="sm:col-span-3">
              <span className="block text-xs text-slate-400">{p.dealType === "MUSHARAKAH" ? "Musharakah" : "Mudarabah"}</span>
              <span className="text-white">
                Investors receive {p.profitSharePercent}% of profit over {p.termMonths} months
                {p.dealType === "MUSHARAKAH" && p.founderCapital !== null && `. The founder contributes ${money(p.founderCapital)} of capital`}.
              </span>
            </p>
          )}
          {p.dealType === "REVENUE_SHARE" && (
            <p className="sm:col-span-3">
              <span className="block text-xs text-slate-400">Revenue share</span>
              <span className="text-white">
                {p.revenueSharePercent}% of revenue until {p.returnCapMultiple}× is repaid ({p.amount && p.returnCapMultiple ? money(revenueShareTotal(p.amount, p.returnCapMultiple)) : "—"}), over at most {p.termMonths} months.
              </span>
            </p>
          )}
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Block title="Expected return">{p.expectedReturn}</Block>
          <Block title="Exit / repayment">{p.exitOptions}</Block>
        </div>
      </Card>

      <Card title="Use of funds (by category)">
        <ul className="space-y-1.5 text-sm">
          {[...byCategory].map(([cat, total]) => (
            <li key={cat} className="flex justify-between">
              <span className="text-slate-300">{label(COST_CATEGORIES, cat)}</span>
              <span className="font-mono text-white">{money(total)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          {p.milestones.length} milestones over {p.milestones.at(-1)?.month ?? 0} months. Line items and milestone details are in the full data room.
        </p>
      </Card>

      <Card title="Five-year projections">
        <table className="w-full text-right text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="pb-2 text-left font-medium">Year</th>
              <th className="pb-2 font-medium">Revenue</th>
              <th className="pb-2 font-medium">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {p.projections.map((y) => (
              <tr key={y.year}>
                <td className="py-1.5 text-left font-sans text-slate-400">Year {y.year}</td>
                <td className="py-1.5">{y.revenue?.toLocaleString("en-US") ?? "—"}</td>
                <td className="py-1.5 text-white">{y.revenue !== null && y.costs !== null ? (y.revenue - y.costs).toLocaleString("en-US") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4">
          <Block title="Assumptions" hidden={hide("projectionAssumptions")}>
            {p.projectionAssumptions}
          </Block>
        </div>
      </Card>

      <Card title="Risks">
        <div className="flex flex-wrap gap-2">
          {p.risks.map((r, i) => (
            <Badge key={i} tone="amber">
              {label(RISK_CATEGORIES, r.category)}: {r.risk}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}
