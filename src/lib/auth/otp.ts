import "server-only";
import { randomInt } from "node:crypto";
import type { OtpChannel, User } from "@prisma/client";
import { db } from "../db";
import { BRAND } from "@/config/brand";
import { indexOf } from "../keys";
import { safeEqual } from "../crypto";
import { sendMessage } from "../messaging";

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashCode = (userId: string, channel: OtpChannel, code: string) => indexOf(`otp:${userId}:${channel}:${code}`);

/** Issues a fresh one-time code (invalidating older ones). Returns whether it was delivered. */
export async function issueOtp(user: Pick<User, "id" | "email" | "phone">, channel: OtpChannel): Promise<boolean> {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await db.$transaction([
    db.otpCode.updateMany({
      where: { userId: user.id, channel, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    db.otpCode.create({
      data: {
        userId: user.id,
        channel,
        codeHash: hashCode(user.id, channel, code),
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    }),
  ]);
  const text = `Your ${BRAND.name} verification code is ${code}. It expires in 10 minutes. Never share this code.`;
  return channel === "EMAIL"
    ? sendMessage("EMAIL", user.email, "Your verification code", text)
    : sendMessage("PHONE", user.phone, null, text);
}

export async function verifyOtp(userId: string, channel: OtpChannel, code: string): Promise<boolean> {
  const otp = await db.otpCode.findFirst({
    where: { userId, channel, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.expiresAt < new Date() || otp.attempts >= MAX_ATTEMPTS) return false;
  if (!safeEqual(otp.codeHash, hashCode(userId, channel, code.trim()))) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return true;
}
