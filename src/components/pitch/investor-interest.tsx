import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { countryName } from "@/lib/countries";
import { formatMoney } from "@/config/platform";
import { INVESTOR_TYPES } from "@/lib/taxonomy";
import { activityFlags, windowStart } from "@/lib/investor/activity";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const typeLabel = (t: string) => INVESTOR_TYPES.find(([k]) => k === t)?.[1] ?? t;

/**
 * Investor activity on a listed pitch. Founders see investors anonymously; the RamiZeeZ team
 * also sees who they are and any misuse flags.
 */
export async function InvestorInterest({
  pitchId,
  audience,
  renderDecision,
}: {
  pitchId: string;
  audience: "FOUNDER" | "TEAM";
  renderDecision?: (requestId: string) => ReactNode;
}) {
  const [views, ndas, requests] = await Promise.all([
    db.pitchViewLog.groupBy({ by: ["level"], where: { pitchId }, _count: { investorId: true } }),
    db.ndaSignature.count({ where: { pitchId } }),
    db.accessRequest.findMany({
      where: { pitchId },
      orderBy: { createdAt: "desc" },
      include: {
        investor: {
          select: { id: true, firstName: true, lastName: true, email: true, countryOfResidence: true, tier: true, investorProfile: { select: { investorType: true, verifiedBudget: true, currency: true } } },
        },
      },
    }),
  ]);
  const distinct = await db.pitchViewLog.findMany({ where: { pitchId }, distinct: ["investorId", "level"], select: { investorId: true, level: true } });
  const viewers = (level: string) => distinct.filter((d) => d.level === level).length;
  const fileOpens = views.find((v) => v.level === "FILE")?._count.investorId ?? 0;

  // Misuse flags are for the team only.
  const flags = new Map<string, string[]>();
  if (audience === "TEAM") {
    const since = windowStart();
    for (const r of requests) {
      const [unlocks, reqCount] = await Promise.all([
        db.ndaSignature.findMany({ where: { investorId: r.investorId, signedAt: { gte: since } }, select: { pitch: { select: { sector: true } } } }),
        db.accessRequest.count({ where: { investorId: r.investorId, createdAt: { gte: since } } }),
      ]);
      flags.set(r.investorId, activityFlags({ unlocks: unlocks.map((u) => ({ sector: u.pitch.sector })), requests: reqCount }));
    }
  }

  return (
    <Card title="Investor interest" description={audience === "FOUNDER" ? "Investors stay anonymous until a deal is agreed through RamiZeeZ." : undefined}>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {(
          [
            ["Saw the teaser", viewers("TEASER")],
            ["Signed the NDA", ndas],
            ["Opened the data room", viewers("FULL")],
            ["Document views", fileOpens],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <dt className="text-xs text-slate-400">{label}</dt>
            <dd className="mt-1 text-xl font-semibold text-white">{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mb-2 mt-5 text-sm font-semibold text-white">Data-room requests</h3>
      <ul className="space-y-3">
        {requests.map((r, i) => {
          const inv = r.investor.investorProfile;
          return (
            <li key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-white">
                  {audience === "TEAM" ? `${r.investor.firstName} ${r.investor.lastName}` : `Investor ${requests.length - i}`}
                </span>
                <Badge tone={r.status === "APPROVED" ? "green" : r.status === "PENDING" ? "blue" : "neutral"}>{r.status.toLowerCase()}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {inv ? typeLabel(inv.investorType) : "Investor"} · {countryName(r.investor.countryOfResidence)} · {r.investor.tier >= 4 ? "RamiZeeZ Verified" : `Tier ${r.investor.tier}`}
                {audience === "TEAM" && inv?.verifiedBudget && ` · verified budget ${formatMoney(Number(inv.verifiedBudget), inv.currency)}`}
              </p>
              <p className="mt-1 text-slate-200">Intends to invest {formatMoney(Number(r.intendedAmount), r.currency)}</p>
              {r.message && <p className="mt-1 whitespace-pre-line text-slate-400">“{r.message}”</p>}
              {flags.get(r.investorId)?.map((f) => (
                <p key={f} className="mt-1 text-xs text-amber-300">⚠ {f}</p>
              ))}
              {r.status === "PENDING" && renderDecision && <div className="mt-3">{renderDecision(r.id)}</div>}
            </li>
          );
        })}
        {!requests.length && <li className="text-sm text-slate-500">No requests yet.</li>}
      </ul>
    </Card>
  );
}
