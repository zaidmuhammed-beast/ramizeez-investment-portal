import "server-only";
import { db } from "../db";
import { env } from "../env";
import { audit } from "../audit";
import { sendMessage } from "../messaging";
import { matchPitch } from "./matching";
import { prefsOf } from "./access";
import { pitchRef } from "./disclosure";

/**
 * Approves or declines a request for full data-room access. Callers check that the actor is
 * the pitch's founder or an authorised team member.
 */
export async function decideAccessRequest(opts: {
  requestId: string;
  actorId: string;
  as: "FOUNDER" | "TEAM";
  approve: boolean;
  note?: string;
}): Promise<string | null> {
  const req = await db.accessRequest.findUnique({ where: { id: opts.requestId }, include: { investor: true, pitch: true } });
  if (!req) return "Request not found.";
  if (req.status !== "PENDING") return "This request has already been decided.";
  if (req.pitch.status !== "LISTED") return "The pitch is no longer listed.";
  await db.accessRequest.update({
    where: { id: req.id },
    data: {
      status: opts.approve ? "APPROVED" : "DECLINED",
      decidedById: opts.actorId,
      decidedAs: opts.as,
      decisionNote: opts.note?.slice(0, 1000) || null,
      decidedAt: new Date(),
    },
  });
  await audit(opts.approve ? "dataroom.access.approved" : "dataroom.access.declined", {
    actorId: opts.actorId,
    targetType: "AccessRequest",
    targetId: req.id,
    metadata: { pitchId: req.pitchId, investorId: req.investorId, as: opts.as },
  });
  const ref = pitchRef(req.pitchId);
  await sendMessage(
    "EMAIL",
    req.investor.email,
    opts.approve ? `Data room access granted: ${ref}` : `Data room request: ${ref}`,
    opts.approve
      ? `Hello ${req.investor.firstName}, your request for the full data room of opportunity ${ref} was approved. Sign in at ${env().APP_URL}/opportunities/${req.pitchId} to review it. Documents are watermarked with your name.`
      : `Hello ${req.investor.firstName}, your request for the full data room of opportunity ${ref} was not approved this time.${opts.note ? ` Note: ${opts.note}` : ""}`,
  );
  return null;
}

/** Emails verified investors whose preferences match a newly listed pitch. Returns how many were notified. */
export async function notifyMatchingInvestors(pitchId: string): Promise<number> {
  const pitch = await db.pitch.findUnique({ where: { id: pitchId } });
  if (!pitch || pitch.status !== "LISTED") return 0;
  const investors = await db.investorProfile.findMany({
    where: { verifiedBudget: { not: null }, user: { status: "ACTIVE", tier: { gte: 3 } } },
    include: { user: { select: { id: true, email: true, firstName: true } } },
  });
  const ref = pitchRef(pitch.id);
  let sent = 0;
  for (const inv of investors) {
    const m = matchPitch(inv.user.id, prefsOf(inv), {
      founderId: pitch.founderId,
      currency: pitch.currency,
      minTicket: pitch.minTicket === null ? null : Number(pitch.minTicket),
      sector: pitch.sector,
      type: pitch.type,
      dealType: pitch.dealType,
      country: pitch.country,
    });
    if (!m.eligible || !m.preferred) continue;
    await sendMessage(
      "EMAIL",
      inv.user.email,
      `New opportunity matches your profile: ${ref}`,
      `Hello ${inv.user.firstName}, a newly listed ${pitch.sector ?? ""} opportunity (${ref}) matches your investment preferences and budget. See the teaser at ${env().APP_URL}/opportunities/${pitch.id}.`,
    );
    sent++;
  }
  return sent;
}
