import "server-only";
import { z } from "zod";
import { findDatabaseUrl } from "./database-url";

const key32 = z
  .string()
  .refine((v) => Buffer.from(v, "base64").length === 32, "must be a base64-encoded 32-byte key");

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const opt = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z
  .object({
    DATABASE_URL: z.preprocess((v) => v || findDatabaseUrl(process.env)?.url, z.string().min(1, "set DATABASE_URL, or connect a database to the site")),
    DATA_ENCRYPTION_KEY: key32,
    BLIND_INDEX_KEY: key32,
    // On Netlify, the site's primary URL is provided as URL; APP_URL overrides it (e.g. a custom domain).
    APP_URL: z.string().url().default(process.env.URL ?? "http://localhost:3000"),
    KYC_PROVIDER: z.enum(["internal"]).default("internal"),
    KYC_ALLOW_FILE_UPLOAD: bool,
    // Where encrypted uploads are kept: "local" disk (STORAGE_DIR) or "netlify-blobs".
    STORAGE_DRIVER: z.enum(["local", "netlify-blobs"]).default(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT ? "netlify-blobs" : "local"),
    STORAGE_DIR: z.string().default("./storage"),
    // Per-file upload limit. Keep it at 4 or less on Netlify (its functions reject requests over ~6 MB).
    MAX_UPLOAD_MB: z.coerce.number().min(1).max(50).default(process.env.NETLIFY ? 4 : 8),
    DEV_SHOW_OTP: bool,
    HIBP_CHECK: bool,
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // Deployment environment, independent of the build mode: staging runs production builds
    // but still needs test conveniences until real email/SMS/KYC providers are connected.
    APP_ENV: z.enum(["local", "staging", "production"]).default("local"),

    // Email: "outbox" only records messages (for testing).
    EMAIL_PROVIDER: z.enum(["outbox", "resend", "sendgrid", "smtp"]).default("outbox"),
    EMAIL_FROM: opt,
    RESEND_API_KEY: opt,
    SENDGRID_API_KEY: opt,
    SMTP_HOST: opt,
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_SECURE: bool,
    SMTP_USER: opt,
    SMTP_PASS: opt,

    // SMS: "outbox" only records messages (for testing).
    SMS_PROVIDER: z.enum(["outbox", "twilio", "vonage", "http"]).default("outbox"),
    TWILIO_ACCOUNT_SID: opt,
    TWILIO_AUTH_TOKEN: opt,
    TWILIO_FROM: opt,
    VONAGE_API_KEY: opt,
    VONAGE_API_SECRET: opt,
    VONAGE_FROM: opt,
    SMS_HTTP_URL: opt,
    SMS_HTTP_METHOD: z.enum(["GET", "POST"]).default("POST"),
    SMS_HTTP_BODY: opt,
    SMS_HTTP_CONTENT_TYPE: opt,
    SMS_HTTP_HEADERS: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (!v) return undefined;
        try {
          const parsed = JSON.parse(v);
          if (parsed && typeof parsed === "object" && Object.values(parsed).every((x) => typeof x === "string")) return parsed as Record<string, string>;
        } catch {}
        ctx.addIssue({ code: "custom", message: 'must be a JSON object of strings, e.g. {"Authorization":"Bearer …"}' });
        return z.NEVER;
      }),
    SMS_HTTP_SUCCESS_MATCH: opt,

    // Live Tank session video: "link" (paste any meeting link), "jitsi" or "daily".
    VIDEO_PROVIDER: z.enum(["link", "jitsi", "daily"]).default("link"),
    JITSI_BASE_URL: z.string().url().default("https://meet.jit.si"),
    JITSI_APP_ID: opt,
    JITSI_APP_SECRET: opt,
    DAILY_API_KEY: opt,
    DAILY_RECORDING: bool,

    // Bearer token for scheduled jobs (e.g. report reminders) called by a cron service.
    JOBS_SECRET: opt,
  })
  .superRefine((v, ctx) => {
    const need = (keys: (keyof typeof v)[], why: string) => {
      for (const k of keys) if (!v[k]) ctx.addIssue({ code: "custom", path: [k], message: `required when ${why}` });
    };
    if (v.EMAIL_PROVIDER !== "outbox") need(["EMAIL_FROM"], `EMAIL_PROVIDER=${v.EMAIL_PROVIDER}`);
    if (v.EMAIL_PROVIDER === "resend") need(["RESEND_API_KEY"], "EMAIL_PROVIDER=resend");
    if (v.EMAIL_PROVIDER === "sendgrid") need(["SENDGRID_API_KEY"], "EMAIL_PROVIDER=sendgrid");
    if (v.EMAIL_PROVIDER === "smtp") need(["SMTP_HOST"], "EMAIL_PROVIDER=smtp");
    if (v.SMS_PROVIDER === "twilio") need(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"], "SMS_PROVIDER=twilio");
    if (v.SMS_PROVIDER === "vonage") need(["VONAGE_API_KEY", "VONAGE_API_SECRET", "VONAGE_FROM"], "SMS_PROVIDER=vonage");
    if (v.SMS_PROVIDER === "http") need(["SMS_HTTP_URL"], "SMS_PROVIDER=http");
    if (v.VIDEO_PROVIDER === "daily") need(["DAILY_API_KEY"], "VIDEO_PROVIDER=daily");
    if (!!v.JITSI_APP_ID !== !!v.JITSI_APP_SECRET) ctx.addIssue({ code: "custom", path: ["JITSI_APP_SECRET"], message: "set both JITSI_APP_ID and JITSI_APP_SECRET, or neither" });
    if (v.JOBS_SECRET && v.JOBS_SECRET.length < 32) ctx.addIssue({ code: "custom", path: ["JOBS_SECRET"], message: "use at least 32 random characters" });

    if (v.APP_ENV === "production") {
      if (v.DEV_SHOW_OTP) ctx.addIssue({ code: "custom", path: ["DEV_SHOW_OTP"], message: "must be off when APP_ENV=production" });
      if (v.KYC_ALLOW_FILE_UPLOAD) ctx.addIssue({ code: "custom", path: ["KYC_ALLOW_FILE_UPLOAD"], message: "must be off when APP_ENV=production" });
      if (v.EMAIL_PROVIDER === "outbox") ctx.addIssue({ code: "custom", path: ["EMAIL_PROVIDER"], message: "choose a real provider when APP_ENV=production" });
      if (v.SMS_PROVIDER === "outbox") ctx.addIssue({ code: "custom", path: ["SMS_PROVIDER"], message: "choose a real provider when APP_ENV=production" });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";
