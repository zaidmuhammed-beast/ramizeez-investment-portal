import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { audit } from "../audit";
import { sha256Hex } from "../crypto";
import { seal, unseal } from "../keys";
import { requestMeta } from "../request";
import { sendMessage } from "../messaging";
import { can } from "../auth/rbac";
import type { CurrentUser } from "../auth/session";
import { nameSimilarity } from "../kyc/names";
import { investorContext, pitchAccess } from "../investor/access";
import { notifyMatchingInvestors } from "../investor/decisions";
import { pitchRef } from "../investor/disclosure";
import { FX_RATES_PKR, formatMoney, toPkr } from "@/config/platform";
import { TANK_NDA_VERSION, tankNdaText } from "@/config/nda";
import { approveSeatBlocker, endsAt, interestBlocker, joinWindowOpen, scheduleErrors, seatBlocker, tankPhase } from "./rules";
import { dailyVideo, jitsiVideo, linkVideo, type VideoProvider } from "./video";

export class TankError extends Error {}
const fail = (msg: string): never => {
  throw new TankError(msg);
};
const num = (d: Prisma.Decimal | number | null | undefined) => (d === null || d === undefined ? 0 : Number(d));
const url = (path: string) => `${env().APP_URL}${path}`;

async function email(userId: string, subject: string, body: (firstName: string) => string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
  if (u) await sendMessage("EMAIL", u.email, subject, body(u.firstName));
}

let video: VideoProvider | undefined;
export function videoProvider(): VideoProvider {
  if (video) return video;
  const e = env();
  if (e.VIDEO_PROVIDER === "daily") return (video = dailyVideo({ apiKey: e.DAILY_API_KEY!, recording: e.DAILY_RECORDING }));
  if (e.VIDEO_PROVIDER === "jitsi") return (video = jitsiVideo({ baseUrl: e.JITSI_BASE_URL, appId: e.JITSI_APP_ID, appSecret: e.JITSI_APP_SECRET }));
  return (video = linkVideo());
}

export function videoStatus() {
  const e = env();
  return {
    provider: e.VIDEO_PROVIDER,
    detail: e.VIDEO_PROVIDER === "jitsi" ? `${new URL(e.JITSI_BASE_URL).host}${e.JITSI_APP_ID ? " (signed tokens)" : ""}` : e.VIDEO_PROVIDER === "daily" ? `Daily.co${e.DAILY_RECORDING ? " with cloud recording" : ""}` : "Meeting link pasted per session",
  };
}

const httpsUrl = (v: string | null | undefined) => {
  if (!v) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" ? u.toString() : fail("Use an https:// meeting link.");
  } catch {
    return fail("That isn't a valid link.");
  }
};

const sessionPath = (id: string) => `/sessions/${id}`;
const when = (d: Date) => `${d.toUTCString().replace(":00 GMT", " GMT")}`;

// ─── Scheduling (team) ────────────────────────────────────────────────────────

export type ScheduleInput = { title: string; description: string | null; startsAt: Date; durationMin: number; capacity: number; pitchIds: string[]; meetingUrl: string | null };

export async function scheduleSession(user: CurrentUser, s: ScheduleInput) {
  if (!can(user, "tank.manage")) fail("Your role can't schedule Tank sessions.");
  const errors = scheduleErrors(s, new Date());
  if (Object.keys(errors).length) return { errors };
  const pitches = await db.pitch.findMany({ where: { id: { in: s.pitchIds }, status: "LISTED" }, include: { deal: { select: { status: true } } } });
  if (pitches.length !== s.pitchIds.length) return { errors: { pitchIds: "Only listed pitches can be invited" } };
  if (pitches.some((p) => p.deal && p.deal.status !== "OPEN")) return { errors: { pitchIds: "One of these rounds is no longer taking commitments" } };

  const provider = videoProvider();
  const pasted = httpsUrl(s.meetingUrl);
  const room = provider.name === "link" ? { name: "external", url: pasted ?? undefined } : await provider.createRoom({ startsAt: s.startsAt, endsAt: endsAt({ ...s, status: "SCHEDULED" }) });
  const session = await db.tankSession.create({
    data: {
      title: s.title.trim(),
      description: s.description?.trim() || null,
      startsAt: s.startsAt,
      durationMin: s.durationMin,
      capacity: s.capacity,
      videoProvider: provider.name,
      roomName: room.name,
      joinUrlEnc: room.url ? seal(room.url) : null,
      createdById: user.id,
      pitches: { create: s.pitchIds.map((pitchId, position) => ({ pitchId, position })) },
    },
  });
  await audit("tank.scheduled", { actorId: user.id, targetType: "TankSession", targetId: session.id, metadata: { pitches: s.pitchIds.length, provider: provider.name } });
  for (const p of pitches) {
    await email(p.founderId, `Invitation to pitch live: ${session.title}`, (n) => `Hello ${n}, RamiZeeZ has invited "${p.title}" to pitch in the live Tank session "${session.title}" on ${when(session.startsAt)}. Confirm or decline at ${url(`/pitches/${p.id}`)}.`);
  }
  return { sessionId: session.id };
}

export async function updateSession(user: CurrentUser, sessionId: string, u: { meetingUrl?: string | null; recordingUrl?: string | null; capacity?: number }) {
  if (!can(user, "tank.manage")) fail("Your role can't manage Tank sessions.");
  const s = await db.tankSession.findUnique({ where: { id: sessionId } });
  if (!s) fail("Session not found.");
  const data: Prisma.TankSessionUpdateInput = {};
  if (u.meetingUrl !== undefined) {
    if (s!.videoProvider !== "link") fail("This session's room is created automatically.");
    const link = httpsUrl(u.meetingUrl);
    data.joinUrlEnc = link ? seal(link) : null;
  }
  if (u.recordingUrl !== undefined) {
    const link = httpsUrl(u.recordingUrl);
    data.recordingUrlEnc = link ? seal(link) : null;
  }
  if (u.capacity !== undefined) {
    const approved = await db.tankSeat.count({ where: { sessionId, status: "APPROVED" } });
    if (!Number.isInteger(u.capacity) || u.capacity < Math.max(1, approved) || u.capacity > 500) fail(`Capacity must be between ${Math.max(1, approved)} (seats already approved) and 500.`);
    data.capacity = u.capacity;
  }
  await db.tankSession.update({ where: { id: sessionId }, data });
  await audit("tank.updated", { actorId: user.id, targetType: "TankSession", targetId: sessionId, metadata: { fields: Object.keys(data) } });
}

async function attendees(sessionId: string) {
  const [seats, pitches] = await Promise.all([
    db.tankSeat.findMany({ where: { sessionId, status: "APPROVED" }, select: { userId: true, joinedAt: true, typedName: true, ndaHash: true } }),
    db.tankPitch.findMany({ where: { sessionId, status: { not: "DECLINED" } }, include: { pitch: { select: { founderId: true, id: true, title: true } } } }),
  ]);
  return { seats, pitches };
}

export async function cancelSession(user: CurrentUser, sessionId: string) {
  if (!can(user, "tank.manage")) fail("Your role can't manage Tank sessions.");
  const s = await db.tankSession.findUnique({ where: { id: sessionId } });
  if (!s || s.status !== "SCHEDULED") fail("Only a scheduled session can be cancelled.");
  await db.tankSession.update({ where: { id: sessionId }, data: { status: "CANCELLED" } });
  await audit("tank.cancelled", { actorId: user.id, targetType: "TankSession", targetId: sessionId });
  const { seats, pitches } = await attendees(sessionId);
  for (const id of new Set([...seats.map((x) => x.userId), ...pitches.map((p) => p.pitch.founderId)])) {
    await email(id, `Cancelled: ${s!.title}`, (n) => `Hello ${n}, the Tank session "${s!.title}" on ${when(s!.startsAt)} has been cancelled. We'll let you know when it is rescheduled.`);
  }
}

/**
 * Marks a session complete. Investors who attended get the full data room of each pitch whose
 * founder allowed it, so they can move straight to an offer. Tank access doesn't use their quotas.
 */
export async function completeSession(user: CurrentUser, sessionId: string) {
  if (!can(user, "tank.manage")) fail("Your role can't manage Tank sessions.");
  const s = await db.tankSession.findUnique({ where: { id: sessionId }, include: { interests: true } });
  if (!s) fail("Session not found.");
  const phase = tankPhase(s!, new Date());
  if (phase !== "ENDED" && phase !== "LIVE") fail("A session can be completed once it has started.");
  const { seats, pitches } = await attendees(sessionId);
  const joined = seats.filter((x) => x.joinedAt);
  let granted = 0;
  for (const tp of pitches.filter((p) => p.status === "CONFIRMED" && p.grantAccess)) {
    const pitch = await db.pitch.findUnique({ where: { id: tp.pitchId } });
    if (!pitch || pitch.status !== "LISTED") continue;
    for (const seat of joined) {
      const interest = s!.interests.find((i) => i.pitchId === tp.pitchId && i.investorId === seat.userId);
      await db.ndaSignature.upsert({
        where: { pitchId_investorId: { pitchId: tp.pitchId, investorId: seat.userId } },
        create: { pitchId: tp.pitchId, investorId: seat.userId, version: TANK_NDA_VERSION, typedName: seat.typedName, textHash: seat.ndaHash },
        update: {},
      });
      const existing = await db.accessRequest.findUnique({ where: { pitchId_investorId: { pitchId: tp.pitchId, investorId: seat.userId } } });
      if (existing?.status === "APPROVED") continue;
      const data = {
        status: "APPROVED" as const,
        decidedById: user.id,
        decidedAs: "TANK",
        decisionNote: `Attended the Tank session "${s!.title}"`,
        decidedAt: new Date(),
        intendedAmount: interest ? interest.amount : num(pitch.minTicket),
      };
      if (existing) await db.accessRequest.update({ where: { id: existing.id }, data });
      else await db.accessRequest.create({ data: { ...data, pitchId: tp.pitchId, investorId: seat.userId, currency: pitch.currency } });
      granted++;
    }
  }
  await db.tankSession.update({ where: { id: sessionId }, data: { status: "COMPLETED", completedAt: new Date() } });
  await audit("tank.completed", { actorId: user.id, targetType: "TankSession", targetId: sessionId, metadata: { attended: joined.length, accessGranted: granted } });
  for (const seat of joined) {
    await email(seat.userId, `Thanks for joining: ${s!.title}`, (n) => `Hello ${n}, thank you for attending "${s!.title}". The pitches' full data rooms are now open to you where the founder allowed it, and you can make offers at ${url(sessionPath(sessionId))}.`);
  }
  return { attended: joined.length, granted };
}

// ─── Founders ─────────────────────────────────────────────────────────────────

export async function respondToInvite(user: CurrentUser, tankPitchId: string, confirm: boolean, grantAccess: boolean) {
  const tp = await db.tankPitch.findUnique({ where: { id: tankPitchId }, include: { pitch: true, session: true } });
  if (!tp || tp.pitch.founderId !== user.id) fail("Invitation not found.");
  const phase = tankPhase(tp!.session, new Date());
  if (phase !== "UPCOMING" && phase !== "OPENING") fail("This session has already started or closed.");
  await db.tankPitch.update({ where: { id: tp!.id }, data: { status: confirm ? "CONFIRMED" : "DECLINED", grantAccess: confirm && grantAccess, respondedAt: new Date() } });
  await audit(confirm ? "tank.pitch.confirmed" : "tank.pitch.declined", { actorId: user.id, targetType: "TankSession", targetId: tp!.sessionId, metadata: { pitchId: tp!.pitchId, grantAccess } });
  if (confirm) {
    const s = tp!.session;
    await notifyMatchingInvestors(tp!.pitchId, {
      minTier: 4,
      subject: `Live Tank session: ${s.title}`,
      message: (n, ref) => `Hello ${n}, opportunity ${ref}, which matches your preferences and budget, will pitch live in "${s.title}" on ${when(s.startsAt)}. Request a seat at ${url(sessionPath(s.id))}. Seats are limited.`,
    });
  }
}

// ─── Investors ────────────────────────────────────────────────────────────────

/** The session's pitches (not declined) that this investor may see. */
export async function visiblePitches(user: CurrentUser, sessionId: string) {
  const slots = await db.tankPitch.findMany({ where: { sessionId, status: { not: "DECLINED" } }, orderBy: { position: "asc" } });
  const out: { slotId: string; pitchId: string; status: string }[] = [];
  for (const slot of slots) {
    const a = await pitchAccess(user, slot.pitchId);
    if (a.level !== "NONE") out.push({ slotId: slot.id, pitchId: slot.pitchId, status: slot.status });
  }
  return out;
}

export function sessionNda(title: string, pitchIds: string[], investorName: string, date: string) {
  return tankNdaText({ sessionTitle: title, pitchRefs: pitchIds.map(pitchRef), investorName, date });
}

export async function requestSeat(user: CurrentUser, sessionId: string, typedName: string) {
  const s = await db.tankSession.findUnique({ where: { id: sessionId }, include: { pitches: { where: { status: { not: "DECLINED" } } }, seats: { where: { userId: user.id } } } });
  if (!s) fail("Session not found.");
  const ctx = await investorContext(user);
  const eligible = await visiblePitches(user, sessionId);
  const block = seatBlocker({
    isInvestor: user.roles.includes("INVESTOR"),
    tier: ctx?.tier ?? 0,
    ready: !!ctx?.ready,
    eligiblePitches: eligible.length,
    phase: tankPhase(s!, new Date()),
    existing: s!.seats[0]?.status ?? null,
  });
  if (block) fail(block);
  const legalName = `${user.firstName} ${user.lastName}`;
  if (nameSimilarity(typedName, legalName) < 0.9) return { errors: { typedName: `Type your full legal name: ${legalName}` } };
  const date = new Date().toISOString().slice(0, 10);
  const text = sessionNda(s!.title, s!.pitches.map((p) => p.pitchId), legalName, date).join("\n");
  const { ip } = await requestMeta();
  const data = { status: "REQUESTED" as const, typedName: typedName.trim(), ndaHash: sha256Hex(text), ip, requestedAt: new Date(), decidedById: null, decidedAt: null };
  await db.tankSeat.upsert({ where: { sessionId_userId: { sessionId, userId: user.id } }, create: { ...data, sessionId, userId: user.id }, update: data });
  await audit("tank.seat.requested", { actorId: user.id, targetType: "TankSession", targetId: sessionId, metadata: { ndaVersion: TANK_NDA_VERSION } });
  return {};
}

export async function cancelSeat(user: CurrentUser, sessionId: string) {
  const seat = await db.tankSeat.findUnique({ where: { sessionId_userId: { sessionId, userId: user.id } } });
  if (!seat || (seat.status !== "REQUESTED" && seat.status !== "APPROVED")) fail("You don't have a seat to give up.");
  await db.tankSeat.update({ where: { id: seat!.id }, data: { status: "CANCELLED" } });
  await audit("tank.seat.cancelled", { actorId: user.id, targetType: "TankSession", targetId: sessionId });
}

export async function decideSeat(user: CurrentUser, seatId: string, approve: boolean) {
  if (!can(user, "tank.manage")) fail("Your role can't manage Tank sessions.");
  const seat = await db.tankSeat.findUnique({ where: { id: seatId }, include: { session: true } });
  if (!seat || seat.status !== "REQUESTED") fail("This request has already been decided.");
  if (approve) {
    const approved = await db.tankSeat.count({ where: { sessionId: seat!.sessionId, status: "APPROVED" } });
    const block = approveSeatBlocker(approved, seat!.session.capacity, tankPhase(seat!.session, new Date()));
    if (block) fail(block);
  }
  await db.tankSeat.update({ where: { id: seat!.id }, data: { status: approve ? "APPROVED" : "DECLINED", decidedById: user.id, decidedAt: new Date() } });
  await audit(approve ? "tank.seat.approved" : "tank.seat.declined", { actorId: user.id, targetType: "TankSession", targetId: seat!.sessionId, metadata: { investorId: seat!.userId } });
  const s = seat!.session;
  await email(
    seat!.userId,
    approve ? `Your seat is confirmed: ${s.title}` : `Seat request: ${s.title}`,
    (n) =>
      approve
        ? `Hello ${n}, your seat at "${s.title}" on ${when(s.startsAt)} is confirmed. The join button opens at ${url(sessionPath(s.id))} 15 minutes before the start. Your link is personal: don't share it.`
        : `Hello ${n}, we couldn't offer you a seat at "${s.title}" this time. We'll let you know about future sessions.`,
  );
}

/**
 * Who may join, and as whom. Returns a personal join URL and records attendance.
 * Team members with tank.manage join as moderators; founders and approved investors as participants.
 */
export async function joinSession(user: CurrentUser, sessionId: string) {
  const s = await db.tankSession.findUnique({ where: { id: sessionId }, include: { pitches: { include: { pitch: { select: { founderId: true } } } } } });
  if (!s) fail("Session not found.");
  const moderator = can(user, "tank.manage");
  const founder = s!.pitches.some((p) => p.status === "CONFIRMED" && p.pitch.founderId === user.id);
  const seat = await db.tankSeat.findUnique({ where: { sessionId_userId: { sessionId, userId: user.id } } });
  if (!moderator && !founder && seat?.status !== "APPROVED") fail("You don't have a seat at this session.");
  if (!moderator && !joinWindowOpen(s!, new Date())) fail("The join button opens 15 minutes before the start.");
  if (s!.status !== "SCHEDULED") fail("This session is closed.");
  const room = { name: s!.roomName ?? "external", url: s!.joinUrlEnc ? unseal(s!.joinUrlEnc) : undefined };
  const role = moderator ? "RamiZeeZ" : founder ? "Founder" : "Investor";
  const target = await videoProvider().joinUrl(room, { name: `${user.firstName} ${user.lastName} (${role})`, moderator }, new Date(endsAt(s!).getTime() + 60 * 60_000));
  if (seat?.status === "APPROVED") await db.tankSeat.update({ where: { id: seat.id }, data: { joinedAt: seat.joinedAt ?? new Date(), joinCount: { increment: 1 } } });
  await audit("tank.joined", { actorId: user.id, targetType: "TankSession", targetId: sessionId, metadata: { as: role } });
  return target;
}

export async function recordingFor(user: CurrentUser, sessionId: string) {
  const s = await db.tankSession.findUnique({ where: { id: sessionId }, include: { pitches: { include: { pitch: { select: { founderId: true } } } } } });
  if (!s || !s.recordingUrlEnc) fail("There's no recording for this session.");
  const seat = await db.tankSeat.findUnique({ where: { sessionId_userId: { sessionId, userId: user.id } } });
  const allowed = can(user, "tank.manage") || s!.pitches.some((p) => p.status === "CONFIRMED" && p.pitch.founderId === user.id) || (seat?.status === "APPROVED" && !!seat.joinedAt);
  if (!allowed) fail("The recording is available to attendees only.");
  await audit("tank.recording.opened", { actorId: user.id, targetType: "TankSession", targetId: sessionId });
  return unseal(s!.recordingUrlEnc!);
}

/** "I'm in": an attending investor's interest in a pitch, shown anonymously to its founder. */
export async function expressInterest(user: CurrentUser, sessionId: string, pitchId: string, amount: number, note: string | null) {
  const s = await db.tankSession.findUnique({ where: { id: sessionId }, include: { pitches: { where: { pitchId, status: "CONFIRMED" } } } });
  if (!s || !s.pitches.length) fail("That pitch isn't in this session.");
  const seat = await db.tankSeat.findUnique({ where: { sessionId_userId: { sessionId, userId: user.id } } });
  const [pitch, ctx, accepted] = await Promise.all([
    db.pitch.findUniqueOrThrow({ where: { id: pitchId } }),
    investorContext(user),
    db.offer.findMany({ where: { pitchId, status: "ACCEPTED" }, select: { amount: true } }),
  ]);
  const budget = ctx?.prefs ? Math.floor(toPkr(ctx.prefs.verifiedBudget ?? 0, ctx.prefs.currency) / (FX_RATES_PKR[pitch.currency] ?? 1)) : 0;
  const remaining = num(pitch.amount) - accepted.reduce((t, o) => t + num(o.amount), 0);
  const block = interestBlocker({ phase: tankPhase(s!, new Date()), joined: seat?.status === "APPROVED" && !!seat.joinedAt, amount, minTicket: num(pitch.minTicket), maxAmount: Math.min(remaining, budget) });
  if (block) return { errors: { amount: block } };
  await db.tankInterest.upsert({
    where: { sessionId_pitchId_investorId: { sessionId, pitchId, investorId: user.id } },
    create: { sessionId, pitchId, investorId: user.id, amount, currency: pitch.currency, note },
    update: { amount, note },
  });
  await audit("tank.interest", { actorId: user.id, targetType: "Pitch", targetId: pitchId, metadata: { sessionId, amount } });
  await email(pitch.founderId, `Live interest in "${pitch.title}"`, (n) => `Hello ${n}, an investor in the Tank session said "I'm in" for ${formatMoney(amount, pitch.currency)}. Their offer will come through your deal room.`);
  return {};
}
