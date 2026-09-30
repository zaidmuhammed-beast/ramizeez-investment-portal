import "server-only";
import type { OtpChannel } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import {
  httpSms,
  resendEmail,
  sendgridEmail,
  smtpEmail,
  twilioSms,
  vonageSms,
  type Delivery,
  type EmailProvider,
  type SmsProvider,
} from "./providers";

let email: EmailProvider | null | undefined;
let sms: SmsProvider | null | undefined;

/** The configured email provider, or null for the testing outbox. */
function emailProvider(): EmailProvider | null {
  if (email !== undefined) return email;
  const e = env();
  switch (e.EMAIL_PROVIDER) {
    case "outbox":
      return (email = null);
    case "resend":
      return (email = resendEmail({ apiKey: e.RESEND_API_KEY!, from: e.EMAIL_FROM! }));
    case "sendgrid":
      return (email = sendgridEmail({ apiKey: e.SENDGRID_API_KEY!, from: e.EMAIL_FROM! }));
    case "smtp":
      return (email = smtpEmail({ host: e.SMTP_HOST!, port: e.SMTP_PORT, secure: e.SMTP_SECURE, user: e.SMTP_USER, pass: e.SMTP_PASS, from: e.EMAIL_FROM! }));
  }
}

/** The configured SMS provider, or null for the testing outbox. */
function smsProvider(): SmsProvider | null {
  if (sms !== undefined) return sms;
  const e = env();
  switch (e.SMS_PROVIDER) {
    case "outbox":
      return (sms = null);
    case "twilio":
      return (sms = twilioSms({ accountSid: e.TWILIO_ACCOUNT_SID!, authToken: e.TWILIO_AUTH_TOKEN!, from: e.TWILIO_FROM! }));
    case "vonage":
      return (sms = vonageSms({ apiKey: e.VONAGE_API_KEY!, apiSecret: e.VONAGE_API_SECRET!, from: e.VONAGE_FROM! }));
    case "http":
      return (sms = httpSms({
        url: e.SMS_HTTP_URL!,
        method: e.SMS_HTTP_METHOD,
        body: e.SMS_HTTP_BODY,
        contentType: e.SMS_HTTP_CONTENT_TYPE,
        headers: e.SMS_HTTP_HEADERS,
        successMatch: e.SMS_HTTP_SUCCESS_MATCH,
      }));
  }
}

/** Configuration summary for the admin settings page — never includes secrets. */
export function messagingStatus() {
  const e = env();
  const host = (url?: string) => {
    try {
      return url ? new URL(url.replace(/\{[a-z_]+\}/g, "x")).host : undefined;
    } catch {
      return "invalid URL";
    }
  };
  return {
    email: {
      provider: e.EMAIL_PROVIDER,
      from: e.EMAIL_FROM,
      detail: e.EMAIL_PROVIDER === "smtp" ? `${e.SMTP_HOST}:${e.SMTP_PORT}${e.SMTP_SECURE ? " (TLS)" : ""}` : undefined,
    },
    sms: {
      provider: e.SMS_PROVIDER,
      from: e.SMS_PROVIDER === "twilio" ? e.TWILIO_FROM : e.SMS_PROVIDER === "vonage" ? e.VONAGE_FROM : undefined,
      detail: e.SMS_PROVIDER === "http" ? `${e.SMS_HTTP_METHOD} ${host(e.SMS_HTTP_URL)}` : undefined,
    },
  };
}

const maskCodes = (text: string) => text.replace(/\b\d{6}\b/g, "••••••");

/**
 * Sends an email or SMS through the configured provider and records it in the message
 * log. Returns whether it was delivered (always true for the outbox).
 */
export async function sendMessage(channel: OtpChannel, to: string, subject: string | null, body: string): Promise<boolean> {
  const provider = channel === "EMAIL" ? emailProvider() : smsProvider();
  let result: Delivery | null = null;
  if (provider) {
    result =
      channel === "EMAIL"
        ? await (provider as EmailProvider).send({ to, subject: subject ?? "", text: body })
        : await (provider as SmsProvider).send({ to, text: body });
  }
  // Codes stay readable only where testers need them (outbox, or DEV_SHOW_OTP on staging).
  const keepCodes = !provider || env().DEV_SHOW_OTP;
  const stored = keepCodes ? body : maskCodes(body);
  await db.outboundMessage.create({
    data: {
      channel,
      to,
      subject,
      body: stored,
      provider: provider?.name ?? "outbox",
      status: !result ? "RECORDED" : result.ok ? "SENT" : "FAILED",
      providerMessageId: result?.ok ? result.providerMessageId : undefined,
      error: result && !result.ok ? result.error.slice(0, 500) : undefined,
    },
  });
  if (result && !result.ok) console.error(`[messaging] ${provider!.name} failed for ${channel}: ${result.error}`);
  else console.info(`[messaging] ${channel} via ${provider?.name ?? "outbox"} → ${to}: ${stored}`);
  return !result || result.ok;
}
