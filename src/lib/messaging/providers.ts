// Email and SMS delivery adapters. Each is a thin HTTP/SMTP client; pick one of each with
// EMAIL_PROVIDER / SMS_PROVIDER (see .env.example). No secrets are logged or returned.
import nodemailer from "nodemailer";

export type Delivery = { ok: true; providerMessageId?: string } | { ok: false; error: string };
export type EmailMessage = { to: string; subject: string; text: string };
export type SmsMessage = { to: string; text: string }; // `to` is E.164, e.g. +923001234567

export interface EmailProvider {
  name: string;
  send(msg: EmailMessage): Promise<Delivery>;
}
export interface SmsProvider {
  name: string;
  send(msg: SmsMessage): Promise<Delivery>;
}

type Fetch = typeof fetch;
const TIMEOUT_MS = 10_000;

async function failure(res: Response): Promise<Delivery> {
  const body = (await res.text().catch(() => "")).slice(0, 300);
  return { ok: false, error: `HTTP ${res.status}${body ? `: ${body}` : ""}` };
}

async function attempt(fn: () => Promise<Delivery>): Promise<Delivery> {
  try {
    return await fn();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Email ────────────────────────────────────────────────────────────────────

/** Resend (resend.com): simple HTTPS API. */
export function resendEmail(cfg: { apiKey: string; from: string }, f: Fetch = fetch): EmailProvider {
  return {
    name: "resend",
    send: (m) =>
      attempt(async () => {
        const res = await f("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: cfg.from, to: [m.to], subject: m.subject, text: m.text }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) return failure(res);
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, providerMessageId: data.id };
      }),
  };
}

/** Twilio SendGrid: HTTPS API v3. */
export function sendgridEmail(cfg: { apiKey: string; from: string }, f: Fetch = fetch): EmailProvider {
  return {
    name: "sendgrid",
    send: (m) =>
      attempt(async () => {
        const res = await f("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: m.to }] }],
            from: parseAddress(cfg.from),
            subject: m.subject,
            content: [{ type: "text/plain", value: m.text }],
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) return failure(res);
        return { ok: true, providerMessageId: res.headers.get("x-message-id") ?? undefined };
      }),
  };
}

/** Any SMTP server: Google Workspace, Microsoft 365, Zoho, Amazon SES SMTP, cPanel mail… */
export function smtpEmail(cfg: { host: string; port: number; secure: boolean; user?: string; pass?: string; from: string }): EmailProvider {
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    connectionTimeout: TIMEOUT_MS,
  });
  return {
    name: "smtp",
    send: (m) =>
      attempt(async () => {
        const info = await transport.sendMail({ from: cfg.from, to: m.to, subject: m.subject, text: m.text });
        return { ok: true, providerMessageId: info.messageId };
      }),
  };
}

/** "Name <email@x>" → { email, name } for APIs that want structured senders. */
export function parseAddress(from: string): { email: string; name?: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { email: m[2], ...(m[1] ? { name: m[1].replace(/^"|"$/g, "") } : {}) } : { email: from.trim() };
}

// ─── SMS ──────────────────────────────────────────────────────────────────────

/** Twilio Programmable Messaging. `from` is a Twilio number, alphanumeric sender ID or Messaging Service SID (MG…). */
export function twilioSms(cfg: { accountSid: string; authToken: string; from: string }, f: Fetch = fetch): SmsProvider {
  return {
    name: "twilio",
    send: (m) =>
      attempt(async () => {
        const form = new URLSearchParams({ To: m.to, Body: m.text });
        form.set(cfg.from.startsWith("MG") ? "MessagingServiceSid" : "From", cfg.from);
        const res = await f(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) return failure(res);
        const data = (await res.json().catch(() => ({}))) as { sid?: string };
        return { ok: true, providerMessageId: data.sid };
      }),
  };
}

/** Vonage (Nexmo) SMS API. */
export function vonageSms(cfg: { apiKey: string; apiSecret: string; from: string }, f: Fetch = fetch): SmsProvider {
  return {
    name: "vonage",
    send: (m) =>
      attempt(async () => {
        const res = await f("https://rest.nexmo.com/sms/json", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ api_key: cfg.apiKey, api_secret: cfg.apiSecret, from: cfg.from, to: m.to.replace(/^\+/, ""), text: m.text }).toString(),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) return failure(res);
        const data = (await res.json().catch(() => ({}))) as { messages?: { status?: string; "message-id"?: string; "error-text"?: string }[] };
        const first = data.messages?.[0];
        if (first?.status !== "0") return { ok: false, error: `Vonage status ${first?.status ?? "?"}: ${first?.["error-text"] ?? "unknown error"}` };
        return { ok: true, providerMessageId: first["message-id"] };
      }),
  };
}

/**
 * Generic HTTP gateway, for local Pakistani SMS aggregators and others with a simple API.
 * Placeholders {to} (E.164), {to_digits} (no +), {to_local} (leading 0, e.g. 03001234567
 * for +92 numbers) and {message} are filled into the URL and body.
 */
export function httpSms(
  cfg: { url: string; method: "GET" | "POST"; body?: string; contentType?: string; headers?: Record<string, string>; successMatch?: string },
  f: Fetch = fetch,
): SmsProvider {
  const json = cfg.contentType?.includes("json");
  const fill = (template: string, m: SmsMessage, encode: (v: string) => string) => {
    const digits = m.to.replace(/^\+/, "");
    const values: Record<string, string> = {
      to: m.to,
      to_digits: digits,
      to_local: digits.startsWith("92") ? `0${digits.slice(2)}` : digits,
      message: m.text,
    };
    return template.replace(/\{(to|to_digits|to_local|message)\}/g, (_, k: string) => encode(values[k]));
  };
  return {
    name: "http",
    send: (m) =>
      attempt(async () => {
        const res = await f(fill(cfg.url, m, encodeURIComponent), {
          method: cfg.method,
          headers: { ...(cfg.contentType ? { "Content-Type": cfg.contentType } : {}), ...cfg.headers },
          body:
            cfg.method === "POST" && cfg.body
              ? fill(cfg.body, m, json ? (v) => JSON.stringify(v).slice(1, -1) : encodeURIComponent)
              : undefined,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) return failure(res);
        const text = await res.text().catch(() => "");
        if (cfg.successMatch && !text.includes(cfg.successMatch)) return { ok: false, error: `Unexpected gateway response: ${text.slice(0, 200)}` };
        return { ok: true };
      }),
  };
}
