import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can, requireTeam } from "@/lib/auth/rbac";
import { formatMoney } from "@/config/platform";
import { describeTerms, type DealType, type OfferTerms } from "@/lib/deals/offers";
import { agreementDraft } from "@/lib/deals/service";
import { Card, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { DEAL_STATUS, DocumentCard, EscrowLedger, MilestoneProgress, OFFER_STATUS, OfferThread, StatusPill } from "@/components/deals/views";
import { CloseRoundForm, DecideEntryButtons, IssueAgreementForm, RecordEntryForm, ReviewClaimForm, SignForm } from "@/components/deals/forms";

export const metadata: Metadata = { title: "Round" };

export default async function AdminDealPage({ params }: PageProps<"/admin/deals/[pitchId]">) {
  const me = await requireTeam("deals.view");
  const { pitchId } = await params;
  const pitch = await db.pitch.findUnique({
    where: { id: pitchId },
    include: {
      founder: { select: { firstName: true, lastName: true } },
      milestones: true,
      deal: { include: { entries: { orderBy: { createdAt: "asc" }, include: { recordedBy: { select: { firstName: true } }, approvedBy: { select: { firstName: true } } } }, claims: true } },
      offers: {
        orderBy: { createdAt: "asc" },
        include: {
          investor: { select: { firstName: true, lastName: true } },
          revisions: { orderBy: { createdAt: "asc" } },
          documents: { where: { status: { not: "VOID" } }, orderBy: { createdAt: "asc" }, include: { signatures: true } },
        },
      },
    },
  });
  if (!pitch) notFound();
  await audit("deal.viewed", { actorId: me.id, targetType: "Pitch", targetId: pitch.id });
  const dealType = pitch.dealType as DealType;
  const deal = pitch.deal;
  const accepted = pitch.offers.filter((o) => o.status === "ACCEPTED");
  const committed = accepted.reduce((s, o) => s + Number(o.amount), 0);
  const legalName = `${me.firstName} ${me.lastName}`;
  const investorOf = (offerId: string | null) => {
    const o = pitch.offers.find((x) => x.id === offerId);
    return o ? `${o.investor.firstName} ${o.investor.lastName}` : null;
  };
  const drafts = new Map<string, string>();
  if (can(me, "deals.legal")) {
    for (const o of accepted) {
      const termSheetSigned = o.documents.some((d) => d.kind === "TERM_SHEET" && d.status === "SIGNED");
      if (termSheetSigned && !o.documents.some((d) => d.kind === "AGREEMENT")) drafts.set(o.id, await agreementDraft(o.id));
    }
  }
  const evidenceIds = deal?.claims.flatMap((c) => c.fileIds) ?? [];
  const evidenceFiles = evidenceIds.length ? await db.storedFile.findMany({ where: { id: { in: evidenceIds } }, select: { id: true, originalName: true } }) : [];

  return (
    <>
      <Link href="/admin/deals" className="text-sm text-slate-400 hover:text-white">
        ← Deals
      </Link>
      <PageHeader
        title={pitch.title}
        description={`Founder ${pitch.founder.firstName} ${pitch.founder.lastName} · raising ${formatMoney(Number(pitch.amount ?? 0), pitch.currency)} · committed ${formatMoney(committed, pitch.currency)}`}
        actions={
          deal ? (
            <div className="flex items-center gap-3">
              {(deal.status === "FUNDED" || deal.status === "COMPLETED") && can(me, "deals.execution") && (
                <Link href={`/admin/execution/${deal.id}`} className="text-sm text-brand-300 hover:underline">
                  Execution & reports →
                </Link>
              )}
              <StatusPill map={DEAL_STATUS} status={deal.status} />
            </div>
          ) : undefined
        }
      />
      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          {pitch.offers.map((o) => (
            <Card key={o.id} title={`${o.investor.firstName} ${o.investor.lastName}: ${formatMoney(Number(o.amount), o.currency)}`} description={describeTerms(dealType, o.terms as OfferTerms, o.currency)} actions={<StatusPill map={OFFER_STATUS} status={o.status} />}>
              <OfferThread revisions={o.revisions} dealType={dealType} currency={o.currency} />
              {o.documents.map((d) => (
                <div key={d.id} className="mt-5">
                  <DocumentCard doc={d} sign={can(me, "deals.legal") && !d.signatures.some((s) => s.party === "RAMIZEEZ") ? <SignForm documentId={d.id} party="RAMIZEEZ" legalName={legalName} /> : undefined} />
                </div>
              ))}
              {drafts.has(o.id) && (
                <div className="mt-5 rounded-2xl border border-violet-400/30 bg-violet-400/5 p-5">
                  <h3 className="mb-3 font-medium text-white">Issue the investment agreement</h3>
                  <IssueAgreementForm offerId={o.id} draft={drafts.get(o.id)!} />
                </div>
              )}
            </Card>
          ))}
          {!pitch.offers.length && <Card><p className="text-sm text-slate-400">No offers yet.</p></Card>}

          {deal && (
            <Card title="Milestones" description="Execution approves each milestone's evidence. Finance then records the release, and a second person approves it.">
              <MilestoneProgress
                milestones={pitch.milestones}
                claims={deal.claims}
                entries={deal.entries}
                target={Number(deal.target)}
                funded={Number(deal.fundedTotal ?? deal.target)}
                currency={deal.currency}
                renderAction={(_, claim) =>
                  claim?.status === "SUBMITTED" ? (
                    <div className="space-y-2">
                      {claim.fileIds.map((id) => (
                        <a key={id} href={`/api/files/${id}`} target="_blank" className="block text-xs text-brand-300 hover:underline">
                          📎 {evidenceFiles.find((f) => f.id === id)?.originalName ?? "evidence"}
                        </a>
                      ))}
                      {can(me, "deals.execution") ? <ReviewClaimForm claimId={claim.id} /> : <p className="text-xs text-slate-500">Awaiting the execution team.</p>}
                    </div>
                  ) : null
                }
              />
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          {deal?.status === "OPEN" && can(me, "pitches.approve") && committed > 0 && (
            <Card title="Close the round early" description="Accept the commitments so far as the full round. Milestone releases are scaled to the amount raised.">
              <CloseRoundForm pitchId={pitch.id} />
            </Card>
          )}
          {deal ? (
            <Card title="Escrow ledger" description="Every entry needs a second team member's approval before it posts (maker-checker).">
              <EscrowLedger
                entries={deal.entries}
                currency={deal.currency}
                describe={(e) => {
                  const full = deal.entries.find((x) => x.id === e.id);
                  return [
                    investorOf(e.offerId),
                    e.milestoneId ? pitch.milestones.find((m) => m.id === e.milestoneId)?.title : null,
                    e.note,
                    `recorded by ${full?.recordedBy?.firstName ?? "system"}${full?.approvedBy ? `, ${e.status === "POSTED" ? "approved" : "rejected"} by ${full.approvedBy.firstName}` : ""}`,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                }}
                actions={(e) =>
                  can(me, "escrow.approve") && e.recordedById !== me.id ? <DecideEntryButtons entryId={e.id} /> : <span className="text-xs text-slate-500">Needs another approver</span>
                }
              />
              {can(me, "escrow.record") && (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <h3 className="mb-3 text-sm font-semibold text-white">Record an entry</h3>
                  <RecordEntryForm
                    pitchId={pitch.id}
                    offers={accepted.map((o) => ({ value: o.id, label: `${o.investor.firstName} ${o.investor.lastName}: ${formatMoney(Number(o.amount), o.currency)}` }))}
                    milestones={[...pitch.milestones].sort((a, b) => a.position - b.position).map((m) => ({ value: m.id, label: `Month ${m.month}: ${m.title}` }))}
                  />
                </div>
              )}
            </Card>
          ) : (
            <Alert tone="info">A round opens when the founder accepts the first offer.</Alert>
          )}
        </aside>
      </div>
    </>
  );
}
