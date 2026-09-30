import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { can, requireTeam } from "@/lib/auth/rbac";
import { formatMoney } from "@/config/platform";
import { balance } from "@/lib/deals/escrow";
import { Card, PageHeader } from "@/components/ui/card";
import { DEAL_STATUS, OFFER_STATUS, StatusPill } from "@/components/deals/views";
import { ModerateQuestionForm } from "@/components/deals/forms";

export const metadata: Metadata = { title: "Deals" };

export default async function DealsPage() {
  const me = await requireTeam("deals.view");
  const [questions, claims, pendingEntries, deals, negotiating] = await Promise.all([
    db.pitchQuestion.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { pitch: { select: { id: true, title: true } }, investor: { select: { firstName: true, lastName: true } } },
    }),
    db.milestoneClaim.findMany({ where: { status: "SUBMITTED" }, include: { milestone: true, deal: { include: { pitch: { select: { id: true, title: true } } } } } }),
    db.escrowEntry.findMany({ where: { status: "PENDING" }, include: { deal: { include: { pitch: { select: { id: true, title: true } } } } } }),
    db.deal.findMany({
      orderBy: { updatedAt: "desc" },
      include: { entries: true, pitch: { select: { id: true, title: true, offers: { where: { status: "ACCEPTED" }, select: { amount: true } } } } },
    }),
    db.offer.findMany({
      where: { status: { in: ["AWAITING_FOUNDER", "AWAITING_INVESTOR"] } },
      orderBy: { updatedAt: "asc" },
      include: { pitch: { select: { id: true, title: true } }, investor: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader title="Deals" description="Moderation, offers, agreements, escrow and milestone releases across every round." />
      <div className="grid gap-6 lg:grid-cols-2">
        {can(me, "deals.moderate") && (
          <Card title={`Questions to moderate (${questions.length})`} description="Check each question is appropriate and contains no contact details before it reaches the founder.">
            <ul className="space-y-3">
              {questions.map((q) => (
                <li key={q.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                  <p className="text-xs text-slate-500">
                    {q.investor.firstName} {q.investor.lastName} →{" "}
                    <Link href={`/admin/deals/${q.pitch.id}`} className="text-brand-300 hover:underline">
                      {q.pitch.title}
                    </Link>
                  </p>
                  <p className="mt-1 text-white">{q.body}</p>
                  <div className="mt-3">
                    <ModerateQuestionForm questionId={q.id} />
                  </div>
                </li>
              ))}
              {!questions.length && <li className="text-sm text-slate-500">Nothing waiting.</li>}
            </ul>
          </Card>
        )}
        <Card title="Waiting on the team">
          <ul className="space-y-2 text-sm">
            {claims.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/deals/${c.deal.pitch.id}`} className="text-brand-300 hover:underline">
                  Milestone evidence: {c.milestone.title} ({c.deal.pitch.title})
                </Link>
              </li>
            ))}
            {pendingEntries.map((e) => (
              <li key={e.id}>
                <Link href={`/admin/deals/${e.deal.pitch.id}`} className="text-brand-300 hover:underline">
                  Escrow {e.type.toLowerCase()} awaiting approval: {formatMoney(Number(e.amount), e.currency)} ({e.deal.pitch.title})
                </Link>
              </li>
            ))}
            {negotiating.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 text-slate-300">
                <StatusPill map={OFFER_STATUS} status={o.status} />
                <Link href={`/admin/deals/${o.pitch.id}`} className="hover:underline">
                  {o.investor.firstName} {o.investor.lastName}: {formatMoney(Number(o.amount), o.currency)} on {o.pitch.title}
                </Link>
              </li>
            ))}
            {!claims.length && !pendingEntries.length && !negotiating.length && <li className="text-slate-500">Nothing waiting.</li>}
          </ul>
        </Card>
      </div>

      <Card title="Rounds" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-3 font-medium">Pitch</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 text-right font-medium">Committed</th>
                <th className="pb-3 text-right font-medium">In escrow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {deals.map((d) => (
                <tr key={d.id}>
                  <td className="py-2.5">
                    <Link href={`/admin/deals/${d.pitch.id}`} className="text-white hover:text-brand-200">
                      {d.pitch.title}
                    </Link>
                  </td>
                  <td className="py-2.5">
                    <StatusPill map={DEAL_STATUS} status={d.status} />
                  </td>
                  <td className="py-2.5 text-right font-mono">
                    {formatMoney(d.pitch.offers.reduce((s, o) => s + Number(o.amount), 0), d.currency)} / {Number(d.target).toLocaleString("en-US")}
                  </td>
                  <td className="py-2.5 text-right font-mono">{formatMoney(balance(d.entries.map((e) => ({ ...e, amount: Number(e.amount) }))), d.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!deals.length && <p className="py-3 text-sm text-slate-500">No rounds yet. A round opens when a founder accepts the first offer.</p>}
        </div>
      </Card>
    </>
  );
}
