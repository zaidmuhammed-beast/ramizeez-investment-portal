import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can, requireTeam } from "@/lib/auth/rbac";
import { toPitchData } from "@/lib/pitch/data";
import { pitchIssues } from "@/lib/pitch/completeness";
import { PITCH_STATUS_LABEL } from "@/lib/pitch/sections";
import { DILIGENCE_ITEMS, SCORE_CRITERIA, TEAM_TRANSITIONS, type Diligence, type Scores } from "@/lib/pitch/workflow";
import { Card, PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";
import { TierBadge } from "@/components/tier-badge";
import { PitchView } from "@/components/pitch/pitch-view";
import { PitchStatusBadge } from "@/components/pitch/status-badge";
import { assignPitchAction } from "../actions";
import { DiligenceForm, ScorecardForm, TeamAccessButtons, TeaserForm, TransitionForm } from "./client";
import { InvestorInterest } from "@/components/pitch/investor-interest";

export const metadata: Metadata = { title: "Pitch review" };

export default async function PitchReviewPage({ params }: PageProps<"/admin/pitches/[id]">) {
  const me = await requireTeam("pitches.view");
  const { id } = await params;
  const pitch = await db.pitch.findUnique({
    where: { id },
    include: {
      costItems: true,
      milestones: true,
      founder: { select: { id: true, firstName: true, lastName: true, email: true, tier: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
      events: { orderBy: { createdAt: "desc" }, include: { actor: { select: { firstName: true, lastName: true, roles: true } } } },
      reviews: { orderBy: { createdAt: "desc" }, include: { reviewer: { select: { firstName: true, lastName: true } } } },
      submissions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!pitch || pitch.status === "DRAFT") notFound();
  await audit("pitch.viewed", { actorId: me.id, targetType: "Pitch", targetId: pitch.id });

  const data = toPitchData(pitch);
  const issues = pitchIssues(data);
  const fileIds = [pitch.deckFileId, ...pitch.imageFileIds, ...pitch.documentFileIds].filter((x): x is string => !!x);
  const files = Object.fromEntries(
    (await db.storedFile.findMany({ where: { id: { in: fileIds } }, select: { id: true, originalName: true, mimeType: true } })).map((f) => [f.id, f]),
  );
  const moves = (TEAM_TRANSITIONS[pitch.status] ?? []).filter((t) => can(me, t.permission));
  const canScreen = can(me, "pitches.screen");
  const latestScore = pitch.reviews.find((r) => r.stage === "SCREENING");
  const latestDiligence = pitch.reviews.find((r) => r.stage === "DUE_DILIGENCE");
  const latest = pitch.submissions[0];

  return (
    <>
      <Link href="/admin/pitches" className="text-sm text-slate-400 hover:text-white">
        ← Pipeline
      </Link>
      <PageHeader
        title={pitch.title}
        description={`${pitch.founder.firstName} ${pitch.founder.lastName} · ${pitch.founder.email}${pitch.submittedAt ? ` · submitted ${pitch.submittedAt.toISOString().slice(0, 10)}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PitchStatusBadge status={pitch.status} />
            <TierBadge tier={pitch.founder.tier} />
          </div>
        }
      />
      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {issues.length > 0 && (
            <Alert tone="warn">This pitch no longer meets {issues.length} submission rule(s), probably because the rules changed after it was submitted. Return it to the founder to update.</Alert>
          )}
          <PitchView pitch={data} files={files} />
        </div>

        <aside className="space-y-6">
          <Card title="Next step" strong>
            {moves.length ? (
              <TransitionForm pitchId={pitch.id} options={moves.map((m) => ({ value: m.to, label: m.label }))} />
            ) : (
              <p className="text-sm text-slate-400">
                {pitch.status === "LISTED" ? "Listed. Investors will see the teaser once the investor portal (Phase 4) is live." : "No actions available for your role at this stage."}
              </p>
            )}
            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
              <span className="text-slate-400">Assigned: {pitch.assignedTo ? `${pitch.assignedTo.firstName} ${pitch.assignedTo.lastName}` : "nobody"}</span>
              {canScreen && pitch.assignedToId !== me.id && (
                <form action={assignPitchAction.bind(null, pitch.id)}>
                  <SubmitButton variant="ghost" className="px-2 py-1 text-xs">
                    Assign to me
                  </SubmitButton>
                </form>
              )}
            </div>
          </Card>

          {pitch.status === "SCREENING" && canScreen && (
            <Card title="Screening scorecard" description="Score each area from 1 to 5.">
              <ScorecardForm pitchId={pitch.id} />
            </Card>
          )}
          {latestScore && (
            <Card title={`Latest scorecard: ${pitch.screeningScore}/100`} description={`${latestScore.reviewer.firstName} ${latestScore.reviewer.lastName} · ${latestScore.createdAt.toISOString().slice(0, 10)}`}>
              <ul className="space-y-1 text-sm">
                {SCORE_CRITERIA.map(([k, label]) => (
                  <li key={k} className="flex justify-between">
                    <span className="text-slate-400">{label}</span>
                    <span className="font-mono text-white">{(latestScore.scores as Scores)[k]}/5</span>
                  </li>
                ))}
              </ul>
              {latestScore.notes && <p className="mt-3 whitespace-pre-line text-sm text-slate-300">{latestScore.notes}</p>}
            </Card>
          )}

          {pitch.status === "DUE_DILIGENCE" && canScreen && (
            <Card title="Due diligence" description="All checks must be ticked before the pitch can go to the committee.">
              <DiligenceForm pitchId={pitch.id} current={latestDiligence?.checklist as Diligence | undefined} />
            </Card>
          )}
          {latestDiligence && pitch.status !== "DUE_DILIGENCE" && (
            <Card title="Due diligence" description={`${latestDiligence.reviewer.firstName} ${latestDiligence.reviewer.lastName}`}>
              <ul className="space-y-1 text-sm">
                {DILIGENCE_ITEMS.map(([k, label]) => (
                  <li key={k} className={(latestDiligence.checklist as Diligence)[k] ? "text-slate-200" : "text-rose-300"}>
                    {(latestDiligence.checklist as Diligence)[k] ? "✓" : "✗"} {label}
                  </li>
                ))}
              </ul>
              {latestDiligence.notes && <p className="mt-3 whitespace-pre-line text-sm text-slate-300">{latestDiligence.notes}</p>}
            </Card>
          )}

          {(pitch.status === "DUE_DILIGENCE" || pitch.status === "COMMITTEE") && (canScreen || can(me, "pitches.approve")) ? (
            <Card title="Investor teaser">
              <TeaserForm pitchId={pitch.id} teaser={pitch.teaser ?? ""} />
            </Card>
          ) : (
            pitch.teaser && (
              <Card title="Investor teaser">
                <p className="whitespace-pre-line text-sm text-slate-200">{pitch.teaser}</p>
              </Card>
            )
          )}

          {pitch.status === "LISTED" && (
            <InvestorInterest
              pitchId={pitch.id}
              audience="TEAM"
              renderDecision={canScreen || can(me, "pitches.approve") ? (id) => <TeamAccessButtons requestId={id} /> : undefined}
            />
          )}
          {latest && (
            <Card title="Submission fingerprint" description={`Version ${latest.version} · terms ${latest.termsVersion} · ${latest.submittedAt.toUTCString()}`}>
              <code className="block break-all font-mono text-xs text-brand-200">{latest.fingerprint}</code>
            </Card>
          )}

          <Card title="History">
            <ol className="space-y-3 text-sm">
              {pitch.events.map((e) => (
                <li key={e.id}>
                  <p className="text-white">
                    {e.fromStatus ? `${PITCH_STATUS_LABEL[e.fromStatus]} → ` : ""}
                    {PITCH_STATUS_LABEL[e.toStatus]}
                  </p>
                  <p className="text-xs text-slate-500">
                    {e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : "System"} · {e.createdAt.toUTCString()}
                  </p>
                  {e.note && <p className="mt-0.5 whitespace-pre-line text-xs text-slate-400">{e.note}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </>
  );
}
