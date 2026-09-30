import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/config/platform";
import { pitchRef } from "@/lib/investor/disclosure";
import { depositedFor } from "@/lib/deals/escrow";
import { describeTerms, turnOf, type DealType, type OfferTerms } from "@/lib/deals/offers";
import { Card, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { DEAL_STATUS, DocumentCard, EscrowLedger, MilestoneProgress, OFFER_STATUS, OfferThread, StatusPill } from "@/components/deals/views";
import { RespondOfferForm, SignForm, WithdrawOfferForm } from "@/components/deals/forms";
import { indicativeReturn, type Health } from "@/lib/execution/rules";
import { CampaignList, HealthPill, ReportCard } from "@/components/execution/views";

export const metadata: Metadata = { title: "Investment" };

export default async function InvestmentPage({ params }: PageProps<"/investments/[offerId]">) {
  const user = await requireUser();
  const { offerId } = await params;
  const offer = await db.offer.findFirst({
    where: { id: offerId, investorId: user.id },
    include: {
      revisions: { orderBy: { createdAt: "asc" } },
      documents: { where: { status: { not: "VOID" } }, orderBy: { createdAt: "asc" }, include: { signatures: true } },
      pitch: {
        include: {
          milestones: true,
          deal: { include: { entries: { orderBy: { createdAt: "asc" } }, claims: true, reports: { where: { status: "PUBLISHED" }, orderBy: { period: "asc" } }, campaigns: { orderBy: { startDate: "desc" } } } },
        },
      },
    },
  });
  if (!offer) notFound();
  const { pitch } = offer;
  const dealType = pitch.dealType as DealType;
  const terms = offer.terms as OfferTerms;
  const amount = Number(offer.amount);
  const deal = pitch.deal;
  const ref = pitchRef(pitch.id);
  const legalName = `${user.firstName} ${user.lastName}`;
  const myEntries = deal?.entries.filter((e) => e.offerId === offer.id) ?? [];
  const deposited = depositedFor(myEntries.map((e) => ({ ...e, amount: Number(e.amount) })), offer.id);
  const agreementSigned = offer.documents.some((d) => d.kind === "AGREEMENT" && d.status === "SIGNED");
  const inExecution = offer.status === "ACCEPTED" && !!deal && (deal.status === "FUNDED" || deal.status === "COMPLETED");
  // Each month's indicative return for this investor; revenue share is capped across months.
  let earlier = 0;
  const returns = new Map<string, { label: string; value: number }>();
  for (const r of deal?.reports ?? []) {
    const ret = indicativeReturn({
      dealType,
      terms,
      amount,
      fundedTotal: Number(deal!.fundedTotal ?? deal!.target),
      founderCapital: Number(pitch.founderCapital ?? 0),
      revenue: Number(r.revenue),
      costs: Number(r.costs),
      earlierShare: earlier,
    });
    if (dealType === "REVENUE_SHARE") earlier += ret.value;
    returns.set(r.id, ret);
  }
  const reportFiles = deal?.reports.length ? await db.storedFile.findMany({ where: { id: { in: deal.reports.flatMap((r) => r.fileIds) } }, select: { id: true, originalName: true } }) : [];

  return (
    <>
      <Link href="/investments" className="text-sm text-slate-400 hover:text-white">
        ← My investments
      </Link>
      <PageHeader
        title={pitch.title}
        description={`${ref} · your offer: ${formatMoney(amount, offer.currency)}, ${describeTerms(dealType, terms, offer.currency)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusPill map={OFFER_STATUS} status={offer.status} />
            {offer.status === "ACCEPTED" && deal && <StatusPill map={DEAL_STATUS} status={deal.status} />}
          </div>
        }
      />
      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {offer.status === "ACCEPTED" &&
            offer.documents.map((d) => (
              <DocumentCard key={d.id} doc={d} sign={!d.signatures.some((s) => s.party === "INVESTOR") ? <SignForm documentId={d.id} party="INVESTOR" legalName={legalName} /> : undefined} />
            ))}
          {offer.status === "ACCEPTED" && !offer.documents.some((d) => d.kind === "AGREEMENT") && offer.documents.some((d) => d.status === "SIGNED") && (
            <Alert tone="info">The term sheet is signed. RamiZeeZ legal is preparing the investment agreement.</Alert>
          )}
          {deal && offer.status === "ACCEPTED" && (deal.status === "FUNDED" || deal.status === "COMPLETED") && (
            <Card title="Execution milestones" description="Your money is released to the business only as RamiZeeZ verifies each milestone.">
              <MilestoneProgress milestones={pitch.milestones} claims={deal.claims} entries={deal.entries} target={Number(deal.target)} funded={Number(deal.fundedTotal ?? deal.target)} currency={deal.currency} />
            </Card>
          )}
          {inExecution && (
            <Card title="Monthly reports" description="Written by the founder and reviewed by RamiZeeZ. Figures are unaudited; returns shown are indicative, before any distribution decision under your agreement.">
              <div className="space-y-4">
                {[...deal!.reports].reverse().map((r) => {
                  const ret = returns.get(r.id)!;
                  return (
                    <ReportCard key={r.id} report={r} currency={deal!.currency} files={reportFiles} fileHref={(fid) => `/api/reports/${r.id}/files/${fid}`}>
                      <p className="text-sm">
                        <span className="text-slate-400">{ret.label}: </span>
                        <span className={`font-mono ${ret.value < 0 ? "text-rose-300" : "text-brand-200"}`}>{formatMoney(ret.value, deal!.currency)}</span>
                      </p>
                    </ReportCard>
                  );
                })}
                {!deal!.reports.length && <p className="text-sm text-slate-500">The first monthly report arrives after the funding month ends.</p>}
              </div>
            </Card>
          )}
          <Card title="Negotiation">
            <OfferThread revisions={offer.revisions} dealType={dealType} currency={offer.currency} />
          </Card>
        </div>
        <aside className="space-y-6">
          {turnOf(offer.status) === "INVESTOR" && (
            <Card title="Your response" strong>
              <RespondOfferForm offerId={offer.id} as="INVESTOR" dealType={dealType} current={{ amount, terms }} canWithdraw />
            </Card>
          )}
          {turnOf(offer.status) === "FOUNDER" && (
            <Card title="Waiting for the founder">
              <p className="text-sm text-slate-400">You&apos;ll get an email when the founder responds.</p>
              <div className="mt-3">
                <WithdrawOfferForm offerId={offer.id} />
              </div>
            </Card>
          )}
          {inExecution && (
            <Card title="Company status" actions={<HealthPill health={deal!.health as Health} />}>
              <p className="text-sm text-slate-400">{deal!.healthNote ?? "RamiZeeZ's execution team tracks the company's progress every month."}</p>
            </Card>
          )}
          {inExecution && deal!.campaigns.length > 0 && (
            <Card title="Marketing by RamiZeeZ">
              <CampaignList campaigns={deal!.campaigns} showBudget={false} />
            </Card>
          )}
          {offer.status === "ACCEPTED" && (
            <Card title="Escrow deposit">
              {!agreementSigned ? (
                <p className="text-sm text-slate-400">Deposit instructions appear once the investment agreement is signed by everyone.</p>
              ) : deposited >= amount - 0.01 ? (
                <Alert tone="success">Your {formatMoney(amount, offer.currency)} is held in escrow.</Alert>
              ) : (
                <div className="space-y-2 text-sm text-slate-300">
                  <p>
                    Transfer <span className="font-semibold text-white">{formatMoney(amount - deposited, offer.currency)}</span> to the RamiZeeZ escrow account.
                  </p>
                  <p>
                    Use the payment reference <span className="font-mono text-brand-200">{`${ref}-${offer.id.slice(-6).toUpperCase()}`}</span>.
                  </p>
                  <p className="text-xs text-slate-500">RamiZeeZ finance will email you the bank details. Never pay the founder directly.</p>
                </div>
              )}
              {myEntries.length > 0 && (
                <div className="mt-4">
                  <EscrowLedger entries={myEntries} currency={offer.currency} />
                </div>
              )}
            </Card>
          )}
          <Card>
            <Link href={`/opportunities/${pitch.id}`} className="text-sm text-brand-300 hover:underline">
              Open the data room & Q&A →
            </Link>
          </Card>
        </aside>
      </div>
    </>
  );
}
