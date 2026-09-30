"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { LOCALE_COOKIE, isLocale } from "./config";

/** Switches the interface language, remembering it on the device and on the account. */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  const session = await getSession();
  if (session) await db.user.update({ where: { id: session.userId }, data: { locale } });
  refresh();
}
