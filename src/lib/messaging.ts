import "server-only";
import type { OtpChannel } from "@prisma/client";
import { db } from "./db";

/**
 * Delivery stub: records every email/SMS in the outbox table (viewable in Admin → Outbox)
 * and logs it. Replace the body with real providers (e.g. SES / Twilio) for production.
 */
export async function sendMessage(channel: OtpChannel, to: string, subject: string | null, body: string) {
  await db.outboundMessage.create({ data: { channel, to, subject, body } });
  console.info(`[outbox] ${channel} → ${to}: ${subject ?? ""} ${body}`);
}
