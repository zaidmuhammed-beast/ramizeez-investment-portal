import "server-only";
import { z } from "zod";

const key32 = z
  .string()
  .refine((v) => Buffer.from(v, "base64").length === 32, "must be a base64-encoded 32-byte key");

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DATA_ENCRYPTION_KEY: key32,
  BLIND_INDEX_KEY: key32,
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_NAME: z.string().default("RamiZeeZ Ventures"),
  KYC_PROVIDER: z.enum(["internal"]).default("internal"),
  KYC_ALLOW_FILE_UPLOAD: bool,
  STORAGE_DIR: z.string().default("./storage"),
  DEV_SHOW_OTP: bool,
  HIBP_CHECK: bool,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Deployment environment, independent of the build mode: staging runs production builds
  // but still needs test conveniences until real email/SMS/KYC providers are connected.
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
});

let cached: z.infer<typeof schema> | undefined;

export function env() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
    }
    if (parsed.data.APP_ENV === "production" && (parsed.data.DEV_SHOW_OTP || parsed.data.KYC_ALLOW_FILE_UPLOAD)) {
      throw new Error("DEV_SHOW_OTP and KYC_ALLOW_FILE_UPLOAD must be off when APP_ENV=production");
    }
    cached = parsed.data;
  }
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";
