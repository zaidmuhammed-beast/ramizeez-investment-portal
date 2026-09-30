import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionStage } from "@prisma/client";
import { db } from "../db";
import { isProduction } from "../env";
import { randomToken, sha256Hex } from "../crypto";
import { requestMeta } from "../request";

export const SESSION_COOKIE = "rz_session";
const ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000; // 12 h
const PENDING_TTL_MS = 10 * 60 * 1000; // 10 min to finish the 2FA step
const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 h of inactivity
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export async function createSession(userId: string, stage: SessionStage) {
  const token = randomToken();
  const { ip, userAgent } = await requestMeta();
  const ttl = stage === "PENDING_2FA" ? PENDING_TTL_MS : ABSOLUTE_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);
  await db.session.create({
    data: { tokenHash: sha256Hex(token), userId, stage, ip, userAgent, expiresAt },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256Hex(token) } });
  jar.delete(SESSION_COOKIE);
}

export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { user: true },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now || now - session.lastSeenAt.getTime() > IDLE_TIMEOUT_MS) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  return session;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getSession>>>["user"];

/**
 * Returns the signed-in user, redirecting to whichever account-setup step is still
 * outstanding. `until` stops the checks early for the setup pages themselves.
 */
export async function requireUser(until?: "contact" | "2fa" | "password"): Promise<CurrentUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.stage === "PENDING_2FA") redirect("/login/2fa");
  const user = session.user;
  if (user.status !== "ACTIVE") redirect("/account/blocked");
  if (until === "contact") return user;
  if (!user.emailVerifiedAt || !user.phoneVerifiedAt) redirect("/verify-contact");
  if (until === "2fa") return user;
  if (!user.totpEnabledAt) redirect("/setup-2fa");
  if (until === "password") return user;
  if (user.mustChangePassword) redirect("/account/change-password");
  return user;
}

/** Where a fully set-up user should land. */
export const homeFor = (user: { roles: string[] }) => (user.roles.includes("TEAM") ? "/admin" : "/dashboard");
