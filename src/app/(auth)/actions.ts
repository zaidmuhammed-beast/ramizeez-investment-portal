"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { requestMeta } from "@/lib/request";
import { unseal } from "@/lib/keys";
import { formValues, type FormState } from "@/lib/form-state";
import { createSession, destroySession, getSession, homeFor, requireUser } from "@/lib/auth/session";
import { getDummyHash, hashSecret, isBreachedPassword, verifySecret } from "@/lib/auth/password";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import { verifyTotp } from "@/lib/auth/totp";
import { consumeRecoveryCode, generateRecoveryCodes } from "@/lib/auth/recovery";
import {
  countrySchema,
  emailSchema,
  fieldErrors,
  nameSchema,
  normalizePhone,
  passwordSchema,
} from "@/lib/validation/common";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const tooMany = (sec: number): FormState => ({ message: `Too many attempts. Try again in ${Math.ceil(sec / 60)} minute(s).` });

// ─── Sign-up ──────────────────────────────────────────────────────────────────

const signupSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    countryOfResidence: countrySchema,
    phoneCountry: countrySchema,
    phone: z.string().trim().min(4, "Enter your mobile number"),
    roles: z.array(z.enum(["FOUNDER", "INVESTOR"])).min(1, "Choose at least one"),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal("on", { error: "You must accept the terms to continue" }),
    acceptPrivacy: z.literal("on", { error: "You must consent to identity verification" }),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export async function signupAction(_: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  const { ip } = await requestMeta();
  const rl = rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.ok) return { ...tooMany(rl.retryAfterSec), values };

  const parsed = signupSchema.safeParse({ ...Object.fromEntries(fd), roles: fd.getAll("roles") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const input = parsed.data;

  const phone = normalizePhone(input.phone, input.phoneCountry);
  if (!phone) return { errors: { phone: "Enter a valid mobile number for the selected country" }, values };

  const errors: Record<string, string> = {};
  const [emailTaken, phoneTaken] = await Promise.all([
    db.user.findUnique({ where: { email: input.email }, select: { id: true } }),
    db.user.findFirst({ where: { phone }, select: { id: true } }),
  ]);
  if (emailTaken) errors.email = "An account with this email already exists. Sign in instead.";
  if (phoneTaken) errors.phone = "This mobile number is already registered to another account";
  if (await isBreachedPassword(input.password)) {
    errors.password = "This password has appeared in a data breach. Please choose a different one.";
  }
  if (Object.keys(errors).length) return { errors, values };

  const user = await db.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone,
      countryOfResidence: input.countryOfResidence,
      roles: input.roles,
      passwordHash: await hashSecret(input.password),
    },
  });
  await audit("auth.signup", { actorId: user.id, targetType: "User", targetId: user.id, metadata: { roles: input.roles } });
  await createSession(user.id, "ACTIVE");
  await Promise.all([issueOtp(user, "EMAIL"), issueOtp(user, "PHONE")]);
  redirect("/verify-contact");
}

// ─── Login ────────────────────────────────────────────────────────────────────

const loginSchema = z.object({ email: z.string().trim().toLowerCase(), password: z.string().min(1) });
const INVALID = "Incorrect email or password";

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  const { ip } = await requestMeta();
  const rl = rateLimit(`login:${ip}`, 20, 15 * 60 * 1000);
  if (!rl.ok) return { ...tooMany(rl.retryAfterSec), values };

  const parsed = loginSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { message: INVALID, values };
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    await verifySecret(await getDummyHash(), password); // equalise timing
    return { message: INVALID, values };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { message: "This account is temporarily locked after too many failed attempts. Try again later.", values };
  }
  if (!(await verifySecret(user.passwordHash, password))) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MS) : undefined },
    });
    await audit(lock ? "auth.lockout" : "auth.login.failed", { actorId: user.id, targetType: "User", targetId: user.id });
    return { message: INVALID, values };
  }

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  if (user.totpEnabledAt) {
    await createSession(user.id, "PENDING_2FA");
    redirect("/login/2fa");
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit("auth.login.success", { actorId: user.id, metadata: { secondFactor: "none-yet" } });
  await createSession(user.id, "ACTIVE");
  // Accounts created by an admin, or sign-ups whose codes expired, get fresh codes now.
  if (!user.emailVerifiedAt) await issueOtp(user, "EMAIL");
  if (!user.phoneVerifiedAt) await issueOtp(user, "PHONE");
  redirect(homeFor(user));
}

export async function secondFactorAction(_: FormState, fd: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session || session.stage !== "PENDING_2FA") redirect("/login");
  const rl = rateLimit(`2fa:${session.id}`, 5, 10 * 60 * 1000);
  if (!rl.ok) {
    await destroySession();
    redirect("/login?expired=1");
  }
  const user = session.user;
  const code = String(fd.get("code") ?? "").trim();
  const mode = fd.get("mode") === "recovery" ? "recovery" : "totp";

  let ok = false;
  if (mode === "totp" && user.totpSecretEnc) {
    const step = verifyTotp(unseal(user.totpSecretEnc), code.replace(/\s/g, ""));
    if (step !== null && (user.totpLastStep === null || step > user.totpLastStep)) {
      await db.user.update({ where: { id: user.id }, data: { totpLastStep: step } });
      ok = true;
    }
  } else if (mode === "recovery") {
    const remaining = await consumeRecoveryCode(user.recoveryCodes, code);
    if (remaining) {
      await db.user.update({ where: { id: user.id }, data: { recoveryCodes: remaining } });
      await audit("auth.recovery_code.used", { actorId: user.id, metadata: { remaining: remaining.length } });
      ok = true;
    }
  }
  if (!ok) {
    await audit("auth.2fa.failed", { actorId: user.id });
    return { message: mode === "totp" ? "That code is not valid. Check your authenticator app and try again." : "That recovery code is not valid.", values: { mode } };
  }

  // Rotate the session token once fully authenticated.
  await db.session.delete({ where: { id: session.id } });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit("auth.login.success", { actorId: user.id, metadata: { secondFactor: mode } });
  await createSession(user.id, "ACTIVE");
  redirect(homeFor(user));
}

export async function logoutAction() {
  const session = await getSession();
  if (session) await audit("auth.logout", { actorId: session.userId });
  await destroySession();
  redirect("/login");
}

// ─── Contact verification ─────────────────────────────────────────────────────

export async function verifyContactAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("contact");
  const channel = fd.get("channel") === "PHONE" ? "PHONE" : "EMAIL";
  const intent = fd.get("intent");

  if (intent === "resend") {
    const rl = rateLimit(`otp-send:${user.id}:${channel}`, 3, 10 * 60 * 1000);
    if (!rl.ok) return tooMany(rl.retryAfterSec);
    await issueOtp(user, channel);
    refresh();
    return { ok: true, message: channel === "EMAIL" ? "A new code was sent to your email." : "A new code was sent to your phone." };
  }

  const code = String(fd.get("code") ?? "");
  if (!/^\d{6}$/.test(code.trim())) return { errors: { [`code_${channel}`]: "Enter the 6-digit code" } };
  if (!(await verifyOtp(user.id, channel, code))) {
    return { errors: { [`code_${channel}`]: "That code is incorrect or has expired. Request a new one." } };
  }
  await db.user.update({
    where: { id: user.id },
    data: channel === "EMAIL" ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() },
  });
  await audit(channel === "EMAIL" ? "contact.email.verified" : "contact.phone.verified", { actorId: user.id });

  const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (fresh.emailVerifiedAt && fresh.phoneVerifiedAt) redirect("/setup-2fa");
  refresh();
  return { ok: true, message: channel === "EMAIL" ? "Email verified." : "Mobile number verified." };
}

// ─── Two-factor setup ─────────────────────────────────────────────────────────

export async function confirmTotpAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("2fa");
  if (user.totpEnabledAt) redirect(homeFor(user));
  if (!user.totpSecretEnc) return { message: "Setup expired. Reload the page to get a new QR code." };
  const step = verifyTotp(unseal(user.totpSecretEnc), String(fd.get("code") ?? "").replace(/\s/g, ""));
  if (step === null) return { errors: { code: "That code is not valid. Make sure your phone's time is set automatically." } };

  const { plain, hashed } = await generateRecoveryCodes();
  await db.user.update({
    where: { id: user.id },
    data: { totpEnabledAt: new Date(), totpLastStep: step, recoveryCodes: hashed },
  });
  // Other sessions were created before 2FA existed — sign them out.
  const current = await getSession();
  await db.session.deleteMany({ where: { userId: user.id, id: { not: current?.id } } });
  await audit("auth.2fa.enabled", { actorId: user.id });
  return { ok: true, data: { recoveryCodes: plain } };
}

// ─── Password change (forced for team accounts created by an admin) ──────────

const changeSchema = z
  .object({ current: z.string().min(1, "Required"), password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" })
  .refine((v) => v.password !== v.current, { path: ["password"], message: "Choose a password different from the current one" });

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("password");
  const parsed = changeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (!(await verifySecret(user.passwordHash, parsed.data.current))) return { errors: { current: "Current password is incorrect" } };
  if (await isBreachedPassword(parsed.data.password)) return { errors: { password: "This password has appeared in a data breach. Choose another." } };
  const current = await getSession();
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashSecret(parsed.data.password), mustChangePassword: false },
  });
  await db.session.deleteMany({ where: { userId: user.id, id: { not: current?.id } } });
  await audit("auth.password.changed", { actorId: user.id });
  redirect(homeFor(user));
}
