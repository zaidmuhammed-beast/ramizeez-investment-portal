import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can, requireTeam, DECIDE_PERMISSION } from "@/lib/auth/rbac";
import { KIND_LABEL } from "@/lib/case-labels";
import { countryName } from "@/lib/countries";
import type { CheckResult } from "@/lib/kyc/types";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/button";
import { TierBadge } from "@/components/tier-badge";
import { ProfileSummary, RoleEvidence, applicantInclude } from "@/components/admin/applicant-file";
import { assignCaseAction } from "../../actions";
import { ChecksTable, IdentityEvidence } from "./evidence";
import { DecisionForm, InterviewForm, NoteForm } from "./client";

export const metadata: Metadata = { title: "Case review" };

export default async function CasePage({ params }: PageProps<"/admin/cases/[id]">) {
  const me = await requireTeam("cases.view");
  const { id } = await params;
  const c = await db.verificationCase.findUnique({
    where: { id },
    include: {
      user: { include: applicantInclude },
      assignedTo: { select: { firstName: true, lastName: true } },
      decidedBy: { select: { firstName: true, lastName: true } },
      notes: { orderBy: { createdAt: "asc" }, include: { author: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!c) notFound();
  await audit("case.viewed", { actorId: me.id, targetType: "VerificationCase", targetId: c.id });

  const canViewFiles = can(me, "kyc.files.view");
  const u = c.user;

  // Evidence as it stood when this case was submitted.
  const [doc, liveness, address, aml, history] = await Promise.all([
    db.identityDocument.findFirst({ where: { userId: u.id, createdAt: { lte: c.createdAt } }, orderBy: { createdAt: "desc" } }),
    db.livenessCheck.findFirst({ where: { userId: u.id, capturedAt: { lte: c.createdAt } }, orderBy: { capturedAt: "desc" } }),
    db.address.findFirst({ where: { userId: u.id, kind: "CURRENT" } }),
    db.amlScreening.findFirst({ where: { userId: u.id, screenedAt: { lte: c.createdAt } }, orderBy: { screenedAt: "desc" } }),
    db.verificationCase.findMany({ where: { userId: u.id, id: { not: c.id } }, orderBy: { createdAt: "desc" }, include: { decidedBy: { select: { firstName: true, lastName: true } } } }),
  ]);
  const fileIds = [
    doc?.frontFileId, doc?.backFileId, address?.proofFileId, ...(liveness?.frameIds ?? []),
    ...(u.investorProfile?.proofOfFundsIds ?? []), ...(u.investorProfile?.entityDocumentIds ?? []), ...(u.founderProfile?.documentIds ?? []),
  ].filter((x): x is string => !!x);
  const fileRows = await db.storedFile.findMany({ where: { id: { in: fileIds } }, select: { id: true, mimeType: true, liveCapture: true, originalName: true, kind: true } });
  const files = Object.fromEntries(fileRows.map((f) => [f.id, f]));

  const checks = c.checks as CheckResult[];
  const canDecide = can(me, DECIDE_PERMISSION[c.kind]) && c.status === "IN_REVIEW";

  return (
    <>
      <Link href="/admin/cases" className="text-sm text-slate-400 hover:text-white">
        ← Back to queue
      </Link>
      <PageHeader
        title={`${u.firstName} ${u.lastName}`}
        description={`${u.email} · ${u.phone} · ${countryName(u.countryOfResidence)} · joined ${u.createdAt.toISOString().slice(0, 10)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="violet">{KIND_LABEL[c.kind]}</Badge>
            <StatusBadge status={c.riskLevel} />
            <StatusBadge status={c.status} />
            <TierBadge tier={u.tier} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Automated checks" description={`Provider: ${c.provider} · submitted ${c.createdAt.toUTCString()}`}>
            <ChecksTable checks={checks} />
          </Card>
          {c.applicantNote && (
            <Card title="Applicant note">
              <p className="whitespace-pre-line text-sm text-slate-200">{c.applicantNote}</p>
            </Card>
          )}
          {c.kind === "IDENTITY" && <IdentityEvidence doc={doc} liveness={liveness} address={address} aml={aml} files={files} canViewFiles={canViewFiles} />}
          {c.kind === "ROLE" && <RoleEvidence user={u} files={files} canViewFiles={canViewFiles} />}
          {c.kind === "FINAL" && (
            <>
              <RoleEvidence user={u} files={files} canViewFiles={canViewFiles} />
              <ProfileSummary user={u} />
            </>
          )}
          {c.kind === "ROLE" && (
            <details className="glass rounded-2xl p-6">
              <summary className="cursor-pointer text-sm font-medium text-white">Full profile (Tier 2)</summary>
              <div className="mt-6 space-y-6">
                <ProfileSummary user={u} />
              </div>
            </details>
          )}
        </div>

        <aside className="space-y-6">
          <Card title="Decision" strong>
            {c.status !== "IN_REVIEW" ? (
              <Alert tone={c.status === "APPROVED" ? "success" : c.status === "REJECTED" ? "error" : "warn"}>
                {c.status.replace("_", " ").toLowerCase()} by {c.decidedBy ? `${c.decidedBy.firstName} ${c.decidedBy.lastName}` : "—"} on {c.decidedAt?.toUTCString()}
                {c.decisionReason && <p className="mt-1">“{c.decisionReason}”</p>}
              </Alert>
            ) : canDecide ? (
              <DecisionForm
                caseId={c.id}
                kind={c.kind}
                investor={u.investorProfile ? { currency: u.investorProfile.currency, declaredBudget: String(u.investorProfile.declaredBudget) } : undefined}
              />
            ) : (
              <p className="text-sm text-slate-400">Your role can view but not decide {KIND_LABEL[c.kind]} cases.</p>
            )}
            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
              <span className="text-slate-400">Assigned: {c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}` : "nobody"}</span>
              {c.status === "IN_REVIEW" && c.assignedToId !== me.id && (
                <form action={assignCaseAction.bind(null, c.id)}>
                  <SubmitButton variant="ghost" className="px-2 py-1 text-xs">
                    Assign to me
                  </SubmitButton>
                </form>
              )}
            </div>
          </Card>

          {c.kind === "FINAL" && can(me, "cases.decide.final") && (
            <Card title="Video interview">
              <InterviewForm caseId={c.id} interviewAt={c.interviewAt?.toISOString().slice(0, 16)} notes={c.interviewNotes ?? undefined} />
            </Card>
          )}

          <Card title="Team notes">
            <ul className="mb-4 space-y-3">
              {c.notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-white/[0.04] p-3 text-sm">
                  <p className="whitespace-pre-line text-slate-100">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {n.author.firstName} {n.author.lastName} · {n.createdAt.toUTCString()}
                  </p>
                </li>
              ))}
              {!c.notes.length && <li className="text-sm text-slate-500">No notes yet.</li>}
            </ul>
            <NoteForm caseId={c.id} />
          </Card>

          <Card title="Case history">
            <ul className="space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2">
                  <Link href={`/admin/cases/${h.id}`} className="text-slate-300 hover:text-white">
                    {KIND_LABEL[h.kind]} · {h.createdAt.toISOString().slice(0, 10)}
                  </Link>
                  <StatusBadge status={h.status} />
                </li>
              ))}
              {!history.length && <li className="text-slate-500">No other cases.</li>}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
