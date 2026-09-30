import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/config/platform";
import { describeTerms, turnOf, type DealType, type OfferTerms } from "@/lib/deals/offers";
import { Card, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { DEAL_STATUS, DocumentCard, EscrowLedger, MilestoneProgress, OFFER_STATUS, OfferThread, StatusPill } from "@/components/deals/views";
import { AnswerQuestionForm, ClaimForm, RespondOfferForm, SignForm } from "@/components/deals/forms";
import { periodLabel, reportSchedule, type Health } from "@/lib/execution/rules";
import { CampaignList, HealthPill, ReportCard, ReportStatePill, TaskList } from "@/components/execution/views";
import { ReportForm, TaskStatusForm } from "@/components/execution/forms";

export const metadata: Metadata = { title: "Deal room" };

export default async function FounderDealPage({ params }: PageProps<"/pitches/[id]/deal">) {
  const user = await requireUser();
  const { id } = await params;
  const pitch = await db.pitch.findFirst({
    where: { id, founderId: user.id },
    include: {
      milestones: true,
      deal: {
        include: {
          entries: { orderBy: { createdAt: "asc" } },
          claims: true,
          manager: { select: { firstName: true, lastName: true } },
          tasks: { where: { forFounder: true }, orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
          reports: { orderBy: { period: "desc" } },
          campaigns: { orderBy: { startDate: "desc" } },
        },
      },
      questions: { where: { status: { in: ["OPEN", "ANSWERED"] } }, orderBy: { createdAt: "desc" } },
      offers: {
        where: { status: { not: "WITHDRAWN" } },
        orderBy: { createdAt: "asc" },
        include: { revisions: { orderBy: { createdAt: "asc" } }, documents: { where: { status: { not: "VOID" } }, orderBy: { createdAt: "asc" }, include: { signatures: true } } },
      },
    },
  });
  if (!pitch) notFound();
  const dealType = pitch.dealType as DealType;
  const deal = pitch.deal;
  const target = Number(pitch.amount ?? 0);
  const committed = pitch.offers.filter((o) => o.status === "ACCEPTED").reduce((s, o) => s + Number(o.amount), 0);
  const legalName = `${user.firstName} ${user.lastName}`;
  // Investors stay anonymous to founders: numbered in the order they made offers.
  const label = (offerId: string) => `Investor ${pitch.offers.findIndex((o) => o.id === offerId) + 1}`;
  const fmt = (n: number) => formatMoney(n, pitch.currency);
  const now = new Date();
  const inExecution = !!deal && (deal.status === "FUNDED" || deal.status === "COMPLETED");
  const schedule = deal?.fundedAt ? reportSchedule(deal.fundedAt, now, deal.reports) : [];
  const openPeriods = schedule.filter((x) => x.state === "DUE" || x.state === "OVERDUE" || x.state === "RETURNED").map((x) => x.period);
  const reportFiles = deal?.reports.length ? await db.storedFile.findMany({ where: { id: { in: deal.reports.flatMap((r) => r.fileIds) }, ownerId: user.id }, select: { id: true, originalName: true } }) : [];

  return (
    <>
      <Link href={`/pitches/${pitch.id}`} className="text-sm text-slate-400 hover:text-white">
        ← {pitch.title}
      </Link>
      <PageHeader
        title="Deal room"
        description="Offers, agreements, escrow and milestones for this round. Everything goes through RamiZeeZ: never deal with investors directly."
        actions={deal ? <StatusPill map={DEAL_STATUS} status={deal.status} /> : undefined}
      />
      {pitch.status !== "LISTED" && !deal && <Alert tone="info" className="mb-6">The deal room opens once your pitch is listed.</Alert>}

      <Card strong className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-slate-400">Committed</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {fmt(committed)} <span className="text-base text-slate-400">of {fmt(target)}</span>
            </p>
          </div>
          {deal && (deal.status === "FUNDED" || deal.status === "COMPLETED") && <p className="text-sm text-brand-200">Funded {deal.fundedAt?.toISOString().slice(0, 10)}</p>}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-gradient-to-r from-brand-400 to-teal-300" style={{ width: `${Math.min(100, target ? (committed / target) * 100 : 0)}%` }} />
        </div>
      </Card>

      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {pitch.offers.map((o) => {
            const terms = o.terms as OfferTerms;
            return (
              <Card
                key={o.id}
                title={`${label(o.id)}: ${fmt(Number(o.amount))}`}
                description={describeTerms(dealType, terms, o.currency)}
                actions={<StatusPill map={OFFER_STATUS} status={o.status} />}
              >
                <OfferThread revisions={o.revisions} dealType={dealType} currency={o.currency} />
                {turnOf(o.status) === "FOUNDER" && (
                  <div className="mt-5 border-t border-white/10 pt-5">
                    <RespondOfferForm offerId={o.id} as="FOUNDER" dealType={dealType} current={{ amount: Number(o.amount), terms }} />
                  </div>
                )}
                {o.status === "ACCEPTED" && (
                  <div className="mt-5 space-y-4">
                    {o.documents.map((d) => (
                      <DocumentCard key={d.id} doc={d} sign={!d.signatures.some((s) => s.party === "FOUNDER") ? <SignForm documentId={d.id} party="FOUNDER" legalName={legalName} /> : undefined} />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
          {!pitch.offers.length && (
            <Card>
              <p className="text-sm text-slate-400">No offers yet. Investors with full data-room access can make offers here.</p>
            </Card>
          )}

          {deal && inExecution && (
            <Card title="Monthly investor reports" description="Due by the 10th of each month for the month before. RamiZeeZ reviews each report before your investors see it.">
              <ul className="mb-5 flex flex-wrap gap-2">
                {schedule.map((x) => (
                  <li key={x.period} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300">
                    {periodLabel(x.period)} <ReportStatePill state={x.state} />
                  </li>
                ))}
                {!schedule.length && <li className="text-sm text-slate-500">Your first report is due after this month ends.</li>}
              </ul>
              {openPeriods.length > 0 && (
                <div className="mb-6 rounded-2xl border border-gold-400/30 bg-gold-400/5 p-5">
                  <h3 className="mb-3 font-medium text-white">Submit a report</h3>
                  <ReportForm dealId={deal.id} currency={deal.currency} periods={openPeriods.map((p) => ({ value: p, label: periodLabel(p) }))} />
                </div>
              )}
              <div className="space-y-4">
                {deal.reports.map((r) => (
                  <ReportCard key={r.id} report={r} currency={deal.currency} files={reportFiles} fileHref={(fid) => `/api/reports/${r.id}/files/${fid}`} />
                ))}
              </div>
            </Card>
          )}

          {deal && (deal.status === "FUNDED" || deal.status === "COMPLETED") && (
            <Card title="Milestones" description="Submit evidence when a milestone is done. Once RamiZeeZ verifies it, the milestone's funds are released from escrow.">
              <MilestoneProgress
                milestones={pitch.milestones}
                claims={deal.claims}
                entries={deal.entries}
                target={Number(deal.target)}
                funded={Number(deal.fundedTotal ?? deal.target)}
                currency={deal.currency}
                renderAction={(m, claim) => (!claim || claim.status === "REJECTED" ? <ClaimForm pitchId={pitch.id} milestoneId={m.id} /> : null)}
              />
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          {deal && inExecution && (
            <Card title="Your RamiZeeZ team" actions={<HealthPill health={deal.health as Health} />}>
              <p className="text-sm text-slate-300">{deal.manager ? `Execution manager: ${deal.manager.firstName} ${deal.manager.lastName}` : "An execution manager will be assigned shortly."}</p>
              {deal.healthNote && <p className="mt-2 text-sm text-slate-400">{deal.healthNote}</p>}
            </Card>
          )}
          {deal && inExecution && (
            <Card title="Tasks from RamiZeeZ">
              <TaskList tasks={deal.tasks} now={now} renderAction={(t) => (t.status === "DONE" ? null : <TaskStatusForm taskId={t.id} status={t.status} founder />)} />
            </Card>
          )}
          {deal && inExecution && deal.campaigns.length > 0 && (
            <Card title="Marketing by RamiZeeZ">
              <CampaignList campaigns={deal.campaigns} />
            </Card>
          )}
          <Card title="Investor questions" description="Moderated by RamiZeeZ.">
            <ul className="space-y-4">
              {pitch.questions.map((q) => (
                <li key={q.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                  <p className="text-white">{q.body}</p>
                  {q.status === "ANSWERED" ? <p className="mt-2 whitespace-pre-line text-brand-100">You: {q.answer}</p> : <div className="mt-3"><AnswerQuestionForm questionId={q.id} /></div>}
                </li>
              ))}
              {!pitch.questions.length && <li className="text-sm text-slate-500">No questions yet.</li>}
            </ul>
          </Card>
          {deal && (
            <Card title="Escrow">
              <EscrowLedger entries={deal.entries.filter((e) => e.status !== "REJECTED")} currency={deal.currency} describe={(e) => (e.offerId ? label(e.offerId) : e.milestoneId ? pitch.milestones.find((m) => m.id === e.milestoneId)?.title ?? null : null)} />
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
