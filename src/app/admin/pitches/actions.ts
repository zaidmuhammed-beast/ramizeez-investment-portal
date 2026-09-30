"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { PitchStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { sendMessage } from "@/lib/messaging";
import { can, requireTeam } from "@/lib/auth/rbac";
import { recomputeTier } from "@/lib/onboarding";
import { formValues, type FormState } from "@/lib/form-state";
import { fieldErrors } from "@/lib/validation/common";
import { PITCH_STATUS_LABEL } from "@/lib/pitch/sections";
import { decideAccessRequest, notifyMatchingInvestors } from "@/lib/investor/decisions";
import { DILIGENCE_ITEMS, TEAM_TRANSITIONS, scorePercent, transitionBlocker, type Diligence, type Scores } from "@/lib/pitch/workflow";

async function loadPitch(pitchId: string) {
  return db.pitch.findUnique({ where: { id: pitchId }, include: { founder: true } });
}

export async function assignPitchAction(pitchId: string) {
  const me = await requireTeam("pitches.screen");
  await db.pitch.update({ where: { id: pitchId }, data: { assignedToId: me.id } });
  await audit("pitch.assigned", { actorId: me.id, targetType: "Pitch", targetId: pitchId });
  refresh();
}

const score = z.coerce.number({ error: "Score 1–5" }).int().min(1, "Score 1–5").max(5, "Score 1–5");
const scoreSchema = z.object({
  team: score,
  market: score,
  model: score,
  financials: score,
  roadmap: score,
  risk: score,
  notes: z.string().trim().min(20, "Summarise your assessment (at least 20 characters)").max(4000),
}) satisfies z.ZodType<Scores & { notes: string }>;

export async function saveScorecardAction(pitchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("pitches.screen");
  const pitch = await loadPitch(pitchId);
  if (!pitch || pitch.status !== "SCREENING") return { message: "Scorecards can only be saved while the pitch is in screening." };
  const parsed = scoreSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: formValues(fd) };
  const { notes, ...scores } = parsed.data;
  const percent = scorePercent(scores);
  await db.$transaction([
    db.pitchReview.create({ data: { pitchId, stage: "SCREENING", reviewerId: me.id, scores, notes } }),
    db.pitch.update({ where: { id: pitchId }, data: { screeningScore: percent } }),
  ]);
  await audit("pitch.scored", { actorId: me.id, targetType: "Pitch", targetId: pitchId, metadata: { percent } });
  refresh();
  return { ok: true, message: `Scorecard saved: ${percent}/100.` };
}

export async function saveDiligenceAction(pitchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("pitches.screen");
  const pitch = await loadPitch(pitchId);
  if (!pitch || pitch.status !== "DUE_DILIGENCE") return { message: "The checklist can only be saved during due diligence." };
  const checklist = Object.fromEntries(DILIGENCE_ITEMS.map(([k]) => [k, fd.get(k) === "on"])) as Diligence;
  const notes = String(fd.get("notes") ?? "").trim().slice(0, 4000) || null;
  await db.pitchReview.create({ data: { pitchId, stage: "DUE_DILIGENCE", reviewerId: me.id, checklist, notes } });
  await audit("pitch.diligence.saved", { actorId: me.id, targetType: "Pitch", targetId: pitchId, metadata: checklist });
  refresh();
  const done = Object.values(checklist).filter(Boolean).length;
  return { ok: true, message: `Checklist saved: ${done} of ${DILIGENCE_ITEMS.length} complete.` };
}

export async function saveTeaserAction(pitchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("pitches.view");
  if (!can(me, "pitches.screen") && !can(me, "pitches.approve")) return { message: "Your role can't edit teasers." };
  const pitch = await loadPitch(pitchId);
  if (!pitch || !["DUE_DILIGENCE", "COMMITTEE"].includes(pitch.status)) return { message: "Write the teaser during due diligence or committee review." };
  const teaser = String(fd.get("teaser") ?? "").trim();
  if (teaser.length < 40 || teaser.length > 600) return { errors: { teaser: "Write 40–600 characters" }, values: formValues(fd) };
  await db.pitch.update({ where: { id: pitchId }, data: { teaser } });
  await audit("pitch.teaser.saved", { actorId: me.id, targetType: "Pitch", targetId: pitchId });
  refresh();
  return { ok: true, message: "Teaser saved." };
}

const FOUNDER_MESSAGES: Partial<Record<PitchStatus, string>> = {
  SCREENING: "is now being screened by our deal team",
  DUE_DILIGENCE: "passed screening and is now in due diligence",
  COMMITTEE: "is with the RamiZeeZ investment committee",
  LISTED: "has been approved and is now listed for matched investors",
  RETURNED: "needs some changes before it can continue",
  REJECTED: "was not accepted",
};

export async function transitionPitchAction(pitchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("pitches.view");
  const pitch = await loadPitch(pitchId);
  if (!pitch) return { message: "Pitch not found" };
  const to = String(fd.get("to") ?? "") as PitchStatus;
  const note = String(fd.get("note") ?? "").trim().slice(0, 4000);
  const move = TEAM_TRANSITIONS[pitch.status]?.find((t) => t.to === to);
  if (!move) return { errors: { to: "Choose a valid next step" }, values: formValues(fd) };
  if (!can(me, move.permission)) return { message: "Your role can't make this move." };

  const [reviews, advanceEvents, founderTier] = await Promise.all([
    db.pitchReview.findMany({ where: { pitchId }, orderBy: { createdAt: "desc" } }),
    db.pitchEvent.findMany({ where: { pitchId, toStatus: { in: ["DUE_DILIGENCE", "COMMITTEE"] } } }),
    recomputeTier(pitch.founderId),
  ]);
  // Only reviews since the latest submission count (a returned pitch is reviewed afresh).
  const sinceSubmission = reviews.filter((r) => !pitch.submittedAt || r.createdAt >= pitch.submittedAt);
  const latestDiligence = sinceSubmission.find((r) => r.stage === "DUE_DILIGENCE")?.checklist as Diligence | undefined;
  const blocker = transitionBlocker({
    from: pitch.status,
    to,
    actorId: me.id,
    note,
    hasScreeningReview: sinceSubmission.some((r) => r.stage === "SCREENING"),
    diligenceComplete: !!latestDiligence && DILIGENCE_ITEMS.every(([k]) => latestDiligence[k]),
    founderTier,
    teaser: pitch.teaser,
    earlierReviewerIds: [
      ...sinceSubmission.filter((r) => r.stage !== "COMMITTEE").map((r) => r.reviewerId),
      ...advanceEvents.filter((e) => !pitch.submittedAt || e.createdAt >= pitch.submittedAt).map((e) => e.actorId).filter((x): x is string => !!x),
    ],
  });
  if (blocker) return { message: blocker, values: formValues(fd) };

  await db.pitch.update({
    where: { id: pitchId },
    data: {
      status: to,
      listedAt: to === "LISTED" ? new Date() : undefined,
      events: { create: { fromStatus: pitch.status, toStatus: to, actorId: me.id, note: note || null } },
      ...(to === "LISTED" ? { reviews: { create: { stage: "COMMITTEE", reviewerId: me.id, notes: note || "Approved for listing" } } } : {}),
    },
  });
  await audit("pitch.status.changed", { actorId: me.id, targetType: "Pitch", targetId: pitchId, metadata: { from: pitch.status, to } });

  const message = FOUNDER_MESSAGES[to];
  if (message) {
    const feedback = (to === "RETURNED" || to === "REJECTED") && note ? ` Feedback from our team: ${note}` : "";
    await sendMessage(
      "EMAIL",
      pitch.founder.email,
      `Your pitch: ${PITCH_STATUS_LABEL[to]}`,
      `Hello ${pitch.founder.firstName}, your pitch "${pitch.title}" ${message}.${feedback} Sign in at ${env().APP_URL}/pitches/${pitch.id} for details.`,
    );
  }
  const notified = to === "LISTED" ? await notifyMatchingInvestors(pitchId) : 0;
  refresh();
  return {
    ok: true,
    message: `Moved to ${PITCH_STATUS_LABEL[to]}. The founder has been notified${to === "LISTED" ? `, and ${notified} matching investor(s) were emailed` : ""}.`,
  };
}

export async function teamDecideAccessAction(requestId: string, approve: boolean) {
  const me = await requireTeam("pitches.view");
  if (!can(me, "pitches.screen") && !can(me, "pitches.approve")) return;
  await decideAccessRequest({ requestId, actorId: me.id, as: "TEAM", approve, note: approve ? undefined : "Declined by RamiZeeZ" });
  refresh();
}
