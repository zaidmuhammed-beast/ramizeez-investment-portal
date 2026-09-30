"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { CaseKind } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { randomToken } from "@/lib/crypto";
import { unseal } from "@/lib/keys";
import { sendMessage } from "@/lib/messaging";
import { rateLimit } from "@/lib/rate-limit";
import { BRAND } from "@/config/brand";
import { requireTeam, can, DECIDE_PERMISSION } from "@/lib/auth/rbac";
import { hashSecret } from "@/lib/auth/password";
import { recomputeTier } from "@/lib/onboarding";
import { normalizeName } from "@/lib/kyc/names";
import { formValues, type FormState } from "@/lib/form-state";
import { countrySchema, emailSchema, fieldErrors, nameSchema, normalizePhone, optionalText, requiredText } from "@/lib/validation/common";

const KIND_NAME: Record<CaseKind, string> = { IDENTITY: "identity verification", ROLE: "role verification", FINAL: "final approval" };

// ─── Cases ────────────────────────────────────────────────────────────────────

export async function assignCaseAction(caseId: string) {
  const me = await requireTeam("cases.view");
  await db.verificationCase.update({ where: { id: caseId }, data: { assignedToId: me.id } });
  await audit("case.assigned", { actorId: me.id, targetType: "VerificationCase", targetId: caseId });
  refresh();
}

export async function addCaseNoteAction(caseId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("cases.view");
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return { errors: { body: "Write a note" } };
  await db.caseNote.create({ data: { caseId, authorId: me.id, body: body.slice(0, 4000) } });
  refresh();
  return { ok: true };
}

const decisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "NEEDS_INFO", "REJECTED"], { error: "Choose a decision" }),
    reason: optionalText(2000),
    verifiedBudget: z.union([z.literal(""), z.coerce.number().min(0)]).optional(),
    confirmLiveness: z.literal("on").optional(),
    confirmDocument: z.literal("on").optional(),
    confirmInterview: z.literal("on").optional(),
  })
  .refine((v) => v.decision === "APPROVED" || !!v.reason, { path: ["reason"], message: "Give a reason. The applicant will see it." });

export async function decideCaseAction(caseId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("cases.view");
  const c = await db.verificationCase.findUnique({ where: { id: caseId }, include: { user: { include: { investorProfile: true } } } });
  if (!c) return { message: "Case not found" };
  if (!can(me, DECIDE_PERMISSION[c.kind])) return { message: "Your role cannot decide this type of case." };
  if (c.status !== "IN_REVIEW") return { message: "This case has already been decided." };

  const parsed = decisionSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: formValues(fd) };
  const v = parsed.data;

  if (v.decision === "APPROVED") {
    const errors: Record<string, string> = {};
    if (c.kind === "IDENTITY") {
      if (!v.confirmLiveness) errors.confirmLiveness = "Confirm you checked the liveness frames and the face match";
      if (!v.confirmDocument) errors.confirmDocument = "Confirm you checked the document against the registry or template";
    }
    if (c.kind === "ROLE" && c.user.investorProfile) {
      if (typeof v.verifiedBudget !== "number" || v.verifiedBudget <= 0) errors.verifiedBudget = "Set the verified budget from the proof of funds";
      else if (v.verifiedBudget > Number(c.user.investorProfile.declaredBudget)) errors.verifiedBudget = "The verified budget can't exceed the declared budget";
    }
    if (c.kind === "FINAL") {
      if (!v.confirmInterview) errors.confirmInterview = "Confirm the video interview took place";
      // Four-eyes rule: final approval must come from someone other than the role-case approver.
      const roleCase = await db.verificationCase.findFirst({ where: { userId: c.userId, kind: "ROLE", status: "APPROVED" }, orderBy: { createdAt: "desc" } });
      if (roleCase?.decidedById === me.id) errors._form = "You approved this applicant's role verification. A different team member must give final approval.";
    }
    if (Object.keys(errors).length) return { errors, values: formValues(fd) };
  }

  await db.$transaction(async (tx) => {
    await tx.verificationCase.update({
      where: { id: c.id },
      data: { status: v.decision, decisionReason: v.reason ?? null, decidedById: me.id, decidedAt: new Date() },
    });
    if (c.kind === "IDENTITY" && v.decision === "APPROVED") {
      await tx.address.updateMany({ where: { userId: c.userId, kind: "CURRENT" }, data: { verified: true } });
    }
    if (c.kind === "ROLE" && v.decision === "APPROVED" && c.user.investorProfile && typeof v.verifiedBudget === "number") {
      await tx.investorProfile.update({ where: { userId: c.userId }, data: { verifiedBudget: v.verifiedBudget } });
    }
  });
  await recomputeTier(c.userId);
  await audit("case.decided", {
    actorId: me.id,
    targetType: "VerificationCase",
    targetId: c.id,
    metadata: { kind: c.kind, decision: v.decision, verifiedBudget: typeof v.verifiedBudget === "number" ? v.verifiedBudget : null },
  });

  const outcome = { APPROVED: "has been approved", NEEDS_INFO: "needs more information from you", REJECTED: "was not approved" }[v.decision];
  await sendMessage(
    "EMAIL",
    c.user.email,
    `Update on your ${KIND_NAME[c.kind]}`,
    `Hello ${c.user.firstName}, your ${KIND_NAME[c.kind]} ${outcome}.${v.reason ? ` Note from our team: ${v.reason}` : ""} Sign in at ${env().APP_URL} to continue.`,
  );
  refresh();
  return { ok: true, message: "Decision recorded and the applicant has been notified." };
}

const interviewSchema = z.object({
  interviewAt: z.string().optional().transform((v) => (v ? new Date(v) : null)).refine((d) => d === null || !Number.isNaN(d.getTime()), "Invalid date"),
  interviewNotes: optionalText(4000),
});

export async function saveInterviewAction(caseId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("cases.decide.final");
  const parsed = interviewSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: formValues(fd) };
  const c = await db.verificationCase.update({
    where: { id: caseId, kind: "FINAL" },
    data: { interviewAt: parsed.data.interviewAt, interviewNotes: parsed.data.interviewNotes ?? null },
    include: { user: true },
  });
  if (parsed.data.interviewAt && fd.get("notify") === "on") {
    await sendMessage("EMAIL", c.user.email, "Your RamiZeeZ video interview", `Hello ${c.user.firstName}, your interview is scheduled for ${parsed.data.interviewAt.toUTCString()}. Keep your original ID document ready.`);
  }
  await audit("case.interview.updated", { actorId: me.id, targetType: "VerificationCase", targetId: caseId });
  refresh();
  return { ok: true, message: "Interview details saved." };
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function setUserStatusAction(userId: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("users.suspend");
  if (userId === me.id) return { message: "You cannot change your own status." };
  const status = fd.get("status") === "ACTIVE" ? "ACTIVE" : "SUSPENDED";
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 500);
  if (status === "SUSPENDED" && !reason) return { errors: { reason: "Give a reason for the suspension" } };
  await db.user.update({ where: { id: userId }, data: { status, statusReason: status === "ACTIVE" ? null : reason } });
  if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId } });
  await audit(status === "ACTIVE" ? "user.reactivated" : "user.suspended", { actorId: me.id, targetType: "User", targetId: userId, metadata: { reason } });
  refresh();
  return { ok: true, message: status === "ACTIVE" ? "Account reactivated." : "Account suspended and signed out." };
}

// ─── Team ─────────────────────────────────────────────────────────────────────

const teamSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phoneCountry: countrySchema,
  phone: z.string().trim().min(4, "Enter a mobile number"),
  teamRole: z.enum(["SUPER_ADMIN", "VERIFICATION_OFFICER", "DEAL_ANALYST", "INVESTMENT_COMMITTEE", "LEGAL", "FINANCE", "EXECUTION_MANAGER", "MARKETING", "SUPPORT"], { error: "Choose a role" }),
});

export async function createTeamMemberAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("team.manage");
  const values = formValues(fd);
  const parsed = teamSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const v = parsed.data;
  const phone = normalizePhone(v.phone, v.phoneCountry);
  if (!phone) return { errors: { phone: "Enter a valid mobile number" }, values };
  if (await db.user.findUnique({ where: { email: v.email } })) return { errors: { email: "This email is already registered" }, values };

  const tempPassword = `${randomToken(9)}!Rz9`;
  const member = await db.user.create({
    data: {
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      phone,
      countryOfResidence: v.phoneCountry,
      roles: ["TEAM"],
      teamRole: v.teamRole,
      passwordHash: await hashSecret(tempPassword),
      mustChangePassword: true,
    },
  });
  await audit("team.member.created", { actorId: me.id, targetType: "User", targetId: member.id, metadata: { teamRole: v.teamRole } });
  refresh();
  return {
    ok: true,
    message: `Account created for ${v.email}. Share the temporary password through a secure channel. They must verify their email and phone, set up 2FA and choose a new password when they first sign in.`,
    data: { tempPassword },
  };
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

const watchSchema = z.object({
  fullName: requiredText(200),
  aliases: optionalText(1000),
  dateOfBirth: z.string().optional().transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null)),
  country: z.union([z.literal(""), countrySchema]).optional(),
  listSource: z.enum(["UN_SC", "OFAC", "EU", "UK_HMT", "NACTA_4TH_SCHEDULE", "PEP", "INTERNAL"], { error: "Choose a list" }),
  reason: optionalText(1000),
});

export async function addWatchlistAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("watchlist.manage");
  const parsed = watchSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: formValues(fd) };
  const v = parsed.data;
  const entry = await db.watchlistEntry.create({
    data: {
      fullName: v.fullName,
      normalizedName: normalizeName(v.fullName),
      aliases: (v.aliases ?? "").split(",").map((a) => a.trim()).filter(Boolean),
      dateOfBirth: v.dateOfBirth,
      country: v.country || null,
      listSource: v.listSource,
      reason: v.reason ?? null,
    },
  });
  await audit("watchlist.added", { actorId: me.id, targetType: "WatchlistEntry", targetId: entry.id });
  refresh();
  return { ok: true, message: "Added to the watchlist. New screenings will check against it." };
}

export async function deleteWatchlistAction(id: string) {
  const me = await requireTeam("watchlist.manage");
  await db.watchlistEntry.delete({ where: { id } });
  await audit("watchlist.removed", { actorId: me.id, targetType: "WatchlistEntry", targetId: id });
  refresh();
}

export async function revealDocumentNumberAction(docId: string): Promise<string> {
  const me = await requireTeam("kyc.files.view");
  const doc = await db.identityDocument.findUniqueOrThrow({ where: { id: docId } });
  await audit("kyc.document_number.revealed", { actorId: me.id, targetType: "IdentityDocument", targetId: docId });
  return unseal(doc.numberEnc);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function sendTestMessageAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireTeam("team.manage");
  const rl = rateLimit(`test-message:${me.id}`, 10, 60 * 60 * 1000);
  if (!rl.ok) return { message: "Too many test messages. Try again later." };
  const channel = fd.get("channel") === "PHONE" ? "PHONE" : "EMAIL";
  const raw = String(fd.get("to") ?? "").trim();
  let to: string | null;
  if (channel === "EMAIL") {
    const parsed = emailSchema.safeParse(raw);
    to = parsed.success ? parsed.data : null;
  } else {
    to = normalizePhone(raw, "PK");
  }
  if (!to) return { errors: { to: channel === "EMAIL" ? "Enter a valid email" : "Enter a mobile number, e.g. +923001234567" }, values: formValues(fd) };

  const kind = channel === "EMAIL" ? "email" : "SMS";
  const sent = await sendMessage(
    channel,
    to,
    channel === "EMAIL" ? `${BRAND.name} test message` : null,
    `This is a test message from ${BRAND.name}. Your ${kind} provider is working.`,
  );
  await audit("settings.messaging.test", { actorId: me.id, metadata: { channel, sent } });
  refresh();
  return sent
    ? { ok: true, message: `Test ${kind} sent to ${to}. The outbox shows the provider's response.` }
    : { message: "Delivery failed. The error is shown in the outbox." };
}
