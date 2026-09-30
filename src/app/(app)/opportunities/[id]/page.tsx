import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney, toPkr, FX_RATES_PKR } from "@/config/platform";
import { ndaText } from "@/config/nda";
import { toPitchData } from "@/lib/pitch/data";
import { logView, pitchAccess, quotaUsage } from "@/lib/investor/access";
import { LEVEL_LABEL, pitchRef } from "@/lib/investor/disclosure";
import { Card, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PitchView } from "@/components/pitch/pitch-view";
import { SecureView } from "@/components/investor/secure-view";
import { SummaryView } from "@/components/investor/summary-view";
import { teaserFacts } from "@/components/investor/teaser";
import { AccessRequestForm, NdaForm, WatchButton, WithdrawRequestButton } from "../forms";

export const metadata: Metadata = { title: "Opportunity" };

export default async function OpportunityPage({ params }: PageProps<"/opportunities/[id]">) {
  const user = await requireUser();
  if (!user.roles.includes("INVESTOR")) redirect("/dashboard");
  const { id } = await params;
  const access = await pitchAccess(user, id);
  const ref = pitchRef(id);

  if (!access.pitch || access.level === "NONE" || !access.ctx) {
    return (
      <>
        <PageHeader title={`Opportunity ${ref}`} />
        <Card>
          <Alert tone="info">
            This opportunity isn&apos;t available to you. It may no longer be listed, or it may be outside your verified budget or accepted deal types.{" "}
            <Link href="/opportunities" className="underline">
              Back to opportunities
            </Link>
          </Alert>
        </Card>
      </>
    );
  }

  const { pitch, level, ctx, request, nda } = access;
  await logView(user.id, pitch.id, level === "FULL" ? "FULL" : level === "SUMMARY" ? "SUMMARY" : "TEASER");
  const quota = await quotaUsage(user.id, ctx.tier);
  const legalName = `${user.firstName} ${user.lastName}`;
  const watermark = `${legalName} · ${user.id.slice(-8).toUpperCase()} · ${ref} · ${new Date().toISOString().slice(0, 10)} · CONFIDENTIAL`;
  const data = toPitchData(pitch);

  // The most an investor can offer, in the pitch's currency: the raise, capped by their verified budget.
  const budgetInPitchCcy = Math.floor(toPkr(ctx.prefs!.verifiedBudget ?? 0, ctx.prefs!.currency) / (FX_RATES_PKR[pitch.currency] ?? 1));
  const maxIntent = Math.min(Number(pitch.amount ?? 0), budgetInPitchCcy);

  let files: Record<string, { id: string; originalName: string | null; mimeType: string }> = {};
  if (level === "FULL") {
    const ids = [pitch.deckFileId, ...pitch.imageFileIds, ...pitch.documentFileIds].filter((x): x is string => !!x);
    files = Object.fromEntries((await db.storedFile.findMany({ where: { id: { in: ids } }, select: { id: true, originalName: true, mimeType: true } })).map((f) => [f.id, f]));
  }

  return (
    <>
      <Link href="/opportunities" className="text-sm text-slate-400 hover:text-white">
        ← Opportunities
      </Link>
      <PageHeader
        title={level === "FULL" ? pitch.title : `${pitch.sector} · ${pitch.city}`}
        description={`Opportunity ${ref}${access.match ? ` · ${access.match.fit}% fit with your preferences` : ""}`}
        actions={
          <div className="flex items-center gap-3">
            <Badge tone={level === "FULL" ? "gold" : level === "SUMMARY" ? "violet" : "neutral"}>{LEVEL_LABEL[level]}</Badge>
            <WatchButton pitchId={pitch.id} watching={!!access.watching} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title="Teaser" strong>
            <p className="text-slate-200">{pitch.teaser}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {teaserFacts(pitch).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="text-slate-100">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {level === "SUMMARY" && (
            <SecureView watermark={watermark}>
              <SummaryView pitch={data} />
            </SecureView>
          )}
          {level === "FULL" && (
            <SecureView watermark={watermark}>
              <PitchView pitch={data} files={files} fileHref={(fileId) => `/api/dataroom/${pitch.id}/${fileId}`} />
            </SecureView>
          )}
        </div>

        <aside className="space-y-6">
          {level === "TEASER" && (
            <Card title="Unlock the summary" description="Sign this deal-specific NDA to see the business plan, market, terms and projections. The business name and founder stay private until the full data room.">
              {quota.unlocks >= quota.unlockLimit ? (
                <Alert tone="warn">You&apos;ve used all {quota.unlockLimit} summary unlocks for the last 30 days. They free up 30 days after each signature.</Alert>
              ) : (
                <NdaForm
                  pitchId={pitch.id}
                  legalName={legalName}
                  clauses={ndaText({ pitchRef: ref, investorName: legalName, date: new Date().toISOString().slice(0, 10) })}
                  remaining={quota.unlockLimit - quota.unlocks}
                />
              )}
            </Card>
          )}

          {level !== "TEASER" && nda && (
            <Card title="NDA signed">
              <p className="text-sm text-slate-300">
                Signed as “{nda.typedName}” on {nda.signedAt.toUTCString()} (version {nda.version}).
              </p>
            </Card>
          )}

          {level === "SUMMARY" && (
            <Card title="Full data room" description="The full plan, costing, roadmap, team and documents, once the founder or RamiZeeZ approves.">
              {ctx.tier < 4 ? (
                <Alert tone="info">
                  Full data-room access requires RamiZeeZ Verified status (Tier 4).{" "}
                  <Link href="/onboarding/final" className="underline">
                    Request final approval
                  </Link>
                  .
                </Alert>
              ) : request?.status === "PENDING" ? (
                <div className="space-y-3">
                  <Alert tone="info">
                    Request sent: you intend to invest {formatMoney(Number(request.intendedAmount), request.currency)}. We&apos;ll email you when it&apos;s reviewed.
                  </Alert>
                  <WithdrawRequestButton pitchId={pitch.id} />
                </div>
              ) : request?.status === "DECLINED" ? (
                <Alert tone="warn">Your request wasn&apos;t approved.{request.decisionNote && ` ${request.decisionNote}`}</Alert>
              ) : quota.requests >= quota.requestLimit ? (
                <Alert tone="warn">You&apos;ve used all {quota.requestLimit} data-room requests for the last 30 days.</Alert>
              ) : maxIntent < Number(pitch.minTicket) ? (
                <Alert tone="warn">The minimum investment is above your verified budget.</Alert>
              ) : (
                <AccessRequestForm pitchId={pitch.id} currency={pitch.currency} min={Number(pitch.minTicket)} max={maxIntent} />
              )}
            </Card>
          )}

          {level === "FULL" && (
            <Card title="Data room">
              <p className="text-sm text-slate-300">
                Approved {request?.decidedAt?.toISOString().slice(0, 10)}. Every document opens as a PDF watermarked with your name and investor ID, and every view is logged.
              </p>
              <p className="mt-3 text-xs text-slate-500">
                Questions and offers go through RamiZeeZ. Contacting the founder directly breaches the NDA.
              </p>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
