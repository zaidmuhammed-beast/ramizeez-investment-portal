import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney, toPkr } from "@/config/platform";
import { pitchRef } from "@/lib/investor/disclosure";
import { Card, PageHeader } from "@/components/ui/card";
import { DEAL_STATUS, OFFER_STATUS, StatusPill } from "@/components/deals/views";

export const metadata: Metadata = { title: "My investments" };

export default async function InvestmentsPage() {
  const user = await requireUser();
  if (!user.roles.includes("INVESTOR")) redirect("/dashboard");
  const [profile, offers] = await Promise.all([
    db.investorProfile.findUnique({ where: { userId: user.id } }),
    db.offer.findMany({
      where: { investorId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { pitch: { select: { id: true, title: true, sector: true, city: true, deal: { select: { status: true } } } } },
    }),
  ]);
  const committedPkr = offers.filter((o) => o.status === "ACCEPTED").reduce((s, o) => s + toPkr(Number(o.amount), o.currency), 0);
  const budget = profile?.verifiedBudget ? Number(profile.verifiedBudget) : 0;
  const ccy = profile?.currency ?? "PKR";
  const committedInCcy = Math.round(committedPkr / (toPkr(1, ccy) || 1));

  return (
    <>
      <PageHeader title="My investments" description="Your offers, agreements, escrow deposits and the progress of the businesses you back." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-slate-400">Verified budget</p>
          <p className="mt-1 text-xl font-semibold text-white">{formatMoney(budget, ccy)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Committed (accepted offers)</p>
          <p className="mt-1 text-xl font-semibold text-white">{formatMoney(committedInCcy, ccy)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400">Remaining</p>
          <p className="mt-1 text-xl font-semibold text-white">{formatMoney(Math.max(budget - committedInCcy, 0), ccy)}</p>
        </Card>
      </div>
      <Card>
        <ul className="divide-y divide-white/5">
          {offers.map((o) => (
            <li key={o.id}>
              <Link href={`/investments/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-white/[0.02]">
                <span>
                  <span className="font-medium text-white">{o.pitch.title}</span>
                  <span className="block text-xs text-slate-500">
                    {pitchRef(o.pitch.id)} · {o.pitch.sector} · {o.pitch.city}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-slate-200">{formatMoney(Number(o.amount), o.currency)}</span>
                  <StatusPill map={OFFER_STATUS} status={o.status} />
                  {o.status === "ACCEPTED" && o.pitch.deal && <StatusPill map={DEAL_STATUS} status={o.pitch.deal.status} />}
                </span>
              </Link>
            </li>
          ))}
          {!offers.length && (
            <li className="py-4 text-sm text-slate-400">
              No offers yet. Offers can be made from an opportunity&apos;s full data room.{" "}
              <Link href="/opportunities" className="text-brand-300 underline">
                Browse opportunities
              </Link>
            </li>
          )}
        </ul>
      </Card>
    </>
  );
}
