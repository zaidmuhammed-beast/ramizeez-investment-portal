import Link from "next/link";
import type { Pitch } from "@prisma/client";
import { countryName } from "@/lib/countries";
import { formatMoney } from "@/config/platform";
import { pitchRef, revenueBand, LEVEL_LABEL, type Level } from "@/lib/investor/disclosure";
import { Badge } from "@/components/ui/badge";

const DEAL: Record<string, string> = { EQUITY: "Equity", MUSHARAKAH: "Musharakah", MUDARABAH: "Mudarabah", REVENUE_SHARE: "Revenue share" };

/** Level 1: anonymous facts only. No business name, no founder, no secret sauce. */
export function teaserFacts(p: Pitch) {
  const band = revenueBand(p.revenueLast12 === null ? null : Number(p.revenueLast12), p.currency);
  return [
    ["Sector", p.sector],
    ["Location", [p.city, p.country && countryName(p.country)].filter(Boolean).join(", ")],
    ["Stage", p.type === "IDEA" ? "Idea / pre-launch" : "Operating business"],
    ["Raising", p.amount !== null ? formatMoney(Number(p.amount), p.currency) : "—"],
    ["Minimum investment", p.minTicket !== null ? formatMoney(Number(p.minTicket), p.currency) : "—"],
    ["Structure", p.dealType ? DEAL[p.dealType] : "—"],
    ...(band ? [["Revenue", band] as const] : []),
    ["RamiZeeZ score", p.screeningScore !== null ? `${p.screeningScore}/100` : "—"],
  ] as const;
}

export function TeaserCard({ pitch, level, fit, watching, requestStatus }: { pitch: Pitch; level: Level; fit: number; watching: boolean; requestStatus?: string }) {
  return (
    <Link href={`/opportunities/${pitch.id}`} className="glass block rounded-2xl p-6 transition hover:bg-white/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-brand-300">{pitchRef(pitch.id)}</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {pitch.sector} · {pitch.city}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge tone={fit >= 70 ? "green" : fit >= 40 ? "amber" : "neutral"}>{fit}% fit</Badge>
          {watching && <Badge tone="gold">★ Watching</Badge>}
        </div>
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-slate-300">{pitch.teaser}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {teaserFacts(pitch)
          .slice(3, 6)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-slate-200">{v}</dd>
            </div>
          ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge tone={level === "FULL" ? "gold" : level === "SUMMARY" ? "violet" : "neutral"}>{LEVEL_LABEL[level]}</Badge>
        {requestStatus === "PENDING" && <Badge tone="blue">Data-room request pending</Badge>}
      </div>
    </Link>
  );
}
