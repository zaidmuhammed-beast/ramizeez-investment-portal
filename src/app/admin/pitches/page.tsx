import type { Metadata } from "next";
import Link from "next/link";
import type { PitchStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/auth/rbac";
import { formatMoney } from "@/config/platform";
import { PITCH_STATUS_LABEL } from "@/lib/pitch/sections";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PitchStatusBadge } from "@/components/pitch/status-badge";

export const metadata: Metadata = { title: "Pitch pipeline" };

const COLUMNS: PitchStatus[] = ["SUBMITTED", "SCREENING", "DUE_DILIGENCE", "COMMITTEE", "LISTED"];
const CLOSED: PitchStatus[] = ["RETURNED", "REJECTED", "WITHDRAWN"];
const DEAL: Record<string, string> = { EQUITY: "Equity", MUSHARAKAH: "Musharakah", MUDARABAH: "Mudarabah", REVENUE_SHARE: "Revenue share" };

const daysSince = (d: Date) => Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));

export default async function PitchPipelinePage() {
  await requireTeam("pitches.view");
  const pitches = await db.pitch.findMany({
    where: { status: { in: [...COLUMNS, ...CLOSED] } },
    orderBy: { updatedAt: "asc" },
    include: {
      founder: { select: { firstName: true, lastName: true, tier: true } },
      assignedTo: { select: { firstName: true } },
      events: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  const card = (p: (typeof pitches)[number]) => (
    <Link key={p.id} href={`/admin/pitches/${p.id}`} className="glass block rounded-xl p-4 transition hover:bg-white/10">
      <p className="font-medium text-white">{p.title}</p>
      <p className="mt-0.5 text-xs text-slate-400">
        {p.founder.firstName} {p.founder.lastName} · T{p.founder.tier}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.amount && <Badge tone="neutral">{formatMoney(Number(p.amount), p.currency)}</Badge>}
        {p.dealType && <Badge tone="violet">{DEAL[p.dealType]}</Badge>}
        {p.screeningScore !== null && <Badge tone={p.screeningScore >= 70 ? "green" : p.screeningScore >= 50 ? "amber" : "red"}>{p.screeningScore}/100</Badge>}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        {daysSince(p.events[0]?.createdAt ?? p.updatedAt)}d in stage{p.assignedTo && ` · ${p.assignedTo.firstName}`}
      </p>
    </Link>
  );

  return (
    <>
      <PageHeader title="Pitch pipeline" description="Submitted pitches move through screening, due diligence and the investment committee before they are listed for investors." />
      <div className="grid gap-4 lg:grid-cols-5">
        {COLUMNS.map((status) => {
          const list = pitches.filter((p) => p.status === status);
          return (
            <section key={status} className="space-y-3">
              <h2 className="flex items-center justify-between px-1 text-sm font-semibold text-slate-200">
                {PITCH_STATUS_LABEL[status]}
                <span className="font-mono text-xs text-slate-500">{list.length}</span>
              </h2>
              {list.map(card)}
              {!list.length && <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">Empty</p>}
            </section>
          );
        })}
      </div>

      <Card title="Returned, rejected & withdrawn" className="mt-8">
        <ul className="divide-y divide-white/5 text-sm">
          {pitches
            .filter((p) => CLOSED.includes(p.status))
            .map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/pitches/${p.id}`} className="text-white hover:text-brand-200">
                  {p.title} <span className="text-slate-500">· {p.founder.firstName} {p.founder.lastName}</span>
                </Link>
                <PitchStatusBadge status={p.status} />
              </li>
            ))}
          {!pitches.some((p) => CLOSED.includes(p.status)) && <li className="py-3 text-slate-500">None.</li>}
        </ul>
      </Card>
    </>
  );
}
