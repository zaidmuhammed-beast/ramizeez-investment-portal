import { z } from "zod";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { COUNTRY_CODES } from "../countries";

export const PASSWORD_MIN = 12;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(128, "Password is too long")
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v), "Use both upper- and lower-case letters")
  .refine((v) => /\d/.test(v), "Include at least one number")
  .refine((v) => /[^A-Za-z0-9]/.test(v), "Include at least one symbol");

// Common throwaway-inbox providers. Extend as abuse is observed.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org",
  "yopmail.com", "trashmail.com", "sharklasers.com", "getnada.com", "dispostable.com",
  "maildrop.cc", "fakeinbox.com", "throwawaymail.com", "mintemail.com", "mohmal.com",
  "emailondeck.com", "tempail.com", "burnermail.io", "moakt.com", "tempr.email",
]);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"))
  .refine((v) => !DISPOSABLE_DOMAINS.has(v.split("@")[1] ?? ""), "Temporary email addresses are not accepted");

export const countrySchema = z
  .string()
  .refine((v) => COUNTRY_CODES.has(v), "Select a country");

export function normalizePhone(raw: string, country: string): string | null {
  const parsed = parsePhoneNumberFromString(raw, country as CountryCode);
  return parsed && parsed.isValid() ? parsed.number : null;
}

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .max(80)
  .regex(/^[\p{L}\p{M}' .-]+$/u, "Use letters only");

export const requiredText = (max = 2000, min = 1) =>
  z.string().trim().min(min, min > 1 ? `Please write at least ${min} characters` : "Required").max(max);

export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.url("Enter a full URL starting with https://").optional());

export const yearSchema = z.coerce.number().int().min(1940).max(new Date().getFullYear() + 10);

export const optionalYear = z
  .union([z.literal(""), z.null(), z.undefined(), yearSchema])
  .transform((v) => (typeof v === "number" ? v : undefined));

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
  .transform((v) => new Date(`${v}T00:00:00.000Z`))
  .refine((d) => !Number.isNaN(d.getTime()), "Enter a valid date");

export const moneySchema = z.coerce
  .number({ error: "Enter an amount" })
  .positive("Must be greater than zero")
  .max(1e15);

/** Flattens a ZodError into { field: firstMessage } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
