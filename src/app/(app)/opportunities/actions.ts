"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { sha256Hex } from "@/lib/crypto";
import { requestMeta } from "@/lib/request";
import { sendMessage } from "@/lib/messaging";
import { requireUser } from "@/lib/auth/session";
import { nameSimilarity } from "@/lib/kyc/names";
import { formValues, type FormState } from "@/lib/form-state";
import { fieldErrors } from "@/lib/validation/common";
import { pitchAccess, quotaUsage } from "@/lib/investor/access";
import { pitchRef, stripContactDetails } from "@/lib/investor/disclosure";
import { NDA_VERSION, ndaText } from "@/config/nda";
import { formatMoney, toPkr } from "@/config/platform";

const ndaDate = () => new Date().toISOString().slice(0, 10);

const ndaSchema = z.object({
  typedName: z.string().trim().min(3, "Type your full legal name").max(120),
  agree: z.literal("on", { error: "You must accept the agreement" }),
});

export async function signNdaAction(pitchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const access = await pitchAccess(user, pitchId);
  if (!access.pitch || access.level === "NONE") return { message: "This opportunity isn't available to you." };
  if (access.level !== "TEASER") redirect(`/opportunities/${pitchId}`);
  const quota = await quotaUsage(user.id, access.ctx!.tier);
  if (quota.unlocks >= quota.unlockLimit) {
    return { message: `You've unlocked ${quota.unlocks} summaries in the last 30 days, your current limit. Unlocks free up 30 days after each signature.` };
  }
  const parsed = ndaSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: formValues(fd) };
  const legalName = `${user.firstName} ${user.lastName}`;
  if (nameSimilarity(parsed.data.typedName, legalName) < 0.9) {
    return { errors: { typedName: `Type your full legal name exactly as verified: ${legalName}` }, values: formValues(fd) };
  }

  // The hash proves exactly which wording was accepted.
  const text = ndaText({ pitchRef: pitchRef(pitchId), investorName: legalName, date: ndaDate() }).join("\n");
  const { ip, userAgent } = await requestMeta();
  await db.ndaSignature.create({
    data: { pitchId, investorId: user.id, version: NDA_VERSION, typedName: parsed.data.typedName, textHash: sha256Hex(text), ip, userAgent },
  });
  await audit("nda.signed", { actorId: user.id, targetType: "Pitch", targetId: pitchId, metadata: { version: NDA_VERSION } });
  redirect(`/opportunities/${pitchId}`);
}

const requestSchema = z.object({
  intendedAmount: z.coerce.number({ error: "Enter an amount" }).positive("Enter an amount"),
  message: z.string().trim().max(1000).optional(),
});

export async function requestAccessAction(pitchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const access = await pitchAccess(user, pitchId);
  if (!access.pitch || access.level !== "SUMMARY") return { message: "Sign the NDA before requesting the data room." };
  const { ctx, pitch } = access;
  if (ctx!.tier < 4) return { message: "Full data-room access needs RamiZeeZ Verified status (Tier 4)." };
  if (access.request && access.request.status !== "WITHDRAWN") return { message: "You've already requested access to this data room." };
  const quota = await quotaUsage(user.id, ctx!.tier);
  if (quota.requests >= quota.requestLimit) return { message: `You've made ${quota.requests} data-room requests in the last 30 days, your current limit.` };

  const parsed = requestSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: formValues(fd) };
  const amount = parsed.data.intendedAmount;
  const minTicket = Number(pitch.minTicket);
  const budget = ctx!.prefs!.verifiedBudget ?? 0;
  if (amount < minTicket) return { errors: { intendedAmount: `The minimum investment is ${formatMoney(minTicket, pitch.currency)}` }, values: formValues(fd) };
  if (toPkr(amount, pitch.currency) > toPkr(budget, ctx!.prefs!.currency)) {
    return { errors: { intendedAmount: `That's above your verified budget of ${formatMoney(budget, ctx!.prefs!.currency)}` }, values: formValues(fd) };
  }
  if (pitch.amount !== null && amount > Number(pitch.amount)) return { errors: { intendedAmount: "That's more than the amount being raised" }, values: formValues(fd) };

  const message = parsed.data.message ? stripContactDetails(parsed.data.message) : null;
  const data = { intendedAmount: amount, currency: pitch.currency, message, status: "PENDING" as const, decidedById: null, decidedAs: null, decisionNote: null, decidedAt: null };
  await db.accessRequest.upsert({
    where: { pitchId_investorId: { pitchId, investorId: user.id } },
    create: { pitchId, investorId: user.id, ...data },
    update: { ...data, createdAt: new Date() },
  });
  await audit("dataroom.access.requested", { actorId: user.id, targetType: "Pitch", targetId: pitchId, metadata: { amount, currency: pitch.currency } });
  const founder = await db.user.findUniqueOrThrow({ where: { id: pitch.founderId }, select: { email: true, firstName: true } });
  await sendMessage(
    "EMAIL",
    founder.email,
    `An investor wants to see your data room: ${pitch.title}`,
    `Hello ${founder.firstName}, a verified investor intends to invest ${formatMoney(amount, pitch.currency)} in "${pitch.title}" and has asked for full data-room access. Review the request at ${env().APP_URL}/pitches/${pitch.id}.`,
  );
  refresh();
  return { ok: true, message: "Request sent. The founder or RamiZeeZ will review it." };
}

export async function withdrawRequestAction(pitchId: string) {
  const user = await requireUser();
  await db.accessRequest.updateMany({ where: { pitchId, investorId: user.id, status: "PENDING" }, data: { status: "WITHDRAWN" } });
  await audit("dataroom.access.withdrawn", { actorId: user.id, targetType: "Pitch", targetId: pitchId });
  refresh();
}

export async function toggleWatchAction(pitchId: string) {
  const user = await requireUser();
  const access = await pitchAccess(user, pitchId);
  if (!access.pitch || access.level === "NONE") return;
  if (access.watching) await db.watchlistItem.delete({ where: { investorId_pitchId: { investorId: user.id, pitchId } } });
  else await db.watchlistItem.create({ data: { investorId: user.id, pitchId } });
  refresh();
}
