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

export const metadata: Metadata = { title: "Investment" };

export default async function InvestmentPage({ params }: PageProps<"/investments/[offerId]">) {
  const user = await requireUser();
  const { offerId } = await params;
  const offer = await db.offer.findFirst({
    where: { id: offerId, investorId: user.id },
    include: {
      revisions: { orderBy: { createdAt: "asc" } },
      documents: { where: { status: { not: "VOID" } }, orderBy: { createdAt: "asc" }, include: { signatures: true } },
      pitch: { include: { milestones: true, deal: { include: { entries: { orderBy: { createdAt: "asc" } }, claims: true } } } },
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
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
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
