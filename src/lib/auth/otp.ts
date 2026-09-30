import "server-only";
import { randomInt } from "node:crypto";
import type { OtpChannel, User } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { indexOf } from "../keys";
import { safeEqual } from "../crypto";
import { sendMessage } from "../messaging";

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashCode = (userId: string, channel: OtpChannel, code: string) => indexOf(`otp:${userId}:${channel}:${code}`);

/** Issues a fresh one-time code (invalidating older ones). Returns the code only when DEV_SHOW_OTP is on. */
export async function issueOtp(user: Pick<User, "id" | "email" | "phone">, channel: OtpChannel): Promise<string | null> {
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
  const text = `Your ${env().APP_NAME} verification code is ${code}. It expires in 10 minutes. Never share this code.`;
  if (channel === "EMAIL") await sendMessage("EMAIL", user.email, "Your verification code", text);
  else await sendMessage("PHONE", user.phone, null, text);
  return env().DEV_SHOW_OTP ? code : null;
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
