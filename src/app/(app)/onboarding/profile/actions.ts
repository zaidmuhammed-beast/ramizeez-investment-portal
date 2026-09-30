"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { recomputeTier, MIN_REFERENCES } from "@/lib/onboarding";
import { formValues, type FormState } from "@/lib/form-state";
import {
  countrySchema,
  dateSchema,
  emailSchema,
  fieldErrors,
  nameSchema,
  optionalText,
  optionalUrl,
  optionalYear,
  requiredText,
  yearSchema,
} from "@/lib/validation/common";
import { requestMeta } from "@/lib/request";

async function done(userId: string, section: string): Promise<FormState> {
  await recomputeTier(userId);
  await audit("profile.updated", { actorId: userId, metadata: { section } });
  refresh();
  return { ok: true, message: "Saved." };
}

// ─── Personal ─────────────────────────────────────────────────────────────────

const personalSchema = z.object({
  preferredName: optionalText(80),
  dateOfBirth: dateSchema,
  gender: optionalText(20),
  nationality1: countrySchema,
  nationality2: z.union([z.literal(""), countrySchema]).optional(),
  nationality3: z.union([z.literal(""), countrySchema]).optional(),
  fatherOrSpouseName: nameSchema,
  maritalStatus: optionalText(20),
  dependants: z.union([z.literal(""), z.coerce.number().int().min(0).max(30)]).optional(),
  languages: requiredText(200),
  linkedinUrl: optionalUrl,
  websiteUrl: optionalUrl,
  otherLinks: optionalText(500),
  bio: requiredText(3000, 100),
});

export async function savePersonalAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = formValues(fd);
  const parsed = personalSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const v = parsed.data;
  if (user.roles.includes("INVESTOR") && !v.linkedinUrl) {
    return { errors: { linkedinUrl: "Investors must provide a LinkedIn profile" }, values };
  }
  const data = {
    preferredName: v.preferredName ?? null,
    dateOfBirth: v.dateOfBirth,
    gender: v.gender ?? null,
    nationalities: [...new Set([v.nationality1, v.nationality2, v.nationality3].filter((n): n is string => !!n))],
    fatherOrSpouseName: v.fatherOrSpouseName,
    maritalStatus: v.maritalStatus ?? null,
    dependants: typeof v.dependants === "number" ? v.dependants : null,
    languages: v.languages.split(",").map((l) => l.trim()).filter(Boolean),
    linkedinUrl: v.linkedinUrl ?? null,
    websiteUrl: v.websiteUrl ?? null,
    otherLinks: v.otherLinks ?? null,
    bio: v.bio,
  };
  await db.personalProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  return done(user.id, "personal");
}

// ─── Repeating lists ──────────────────────────────────────────────────────────

const listSchemas = {
  education: z.object({
    institution: requiredText(160),
    qualification: requiredText(160),
    fieldOfStudy: optionalText(160),
    startYear: optionalYear,
    endYear: optionalYear,
    notes: optionalText(500),
  }),
  experience: z.object({
    employer: requiredText(160),
    title: requiredText(160),
    startYear: yearSchema,
    endYear: optionalYear,
    responsibilities: requiredText(2000, 20),
    reasonForLeaving: optionalText(500),
  }),
  ventures: z.object({
    name: requiredText(160),
    sector: requiredText(120),
    startYear: yearSchema,
    endYear: optionalYear,
    outcome: z.enum(["RUNNING", "SOLD", "CLOSED", "OTHER"], { error: "Select an outcome" }),
    lessons: requiredText(2000, 20),
  }),
  references: z.object({
    name: nameSchema,
    relationship: requiredText(120),
    email: emailSchema,
    phone: z.string().trim().min(6, "Enter a phone number with country code").max(30),
  }),
} as const;

export type ListKind = keyof typeof listSchemas;

const MIN_ITEMS: Record<ListKind, number> = { education: 1, experience: 1, ventures: 0, references: MIN_REFERENCES };

function parseList<S extends z.ZodType>(schema: S, min: number, raw: unknown): { data: z.infer<S>[] } | { error: FormState } {
  const parsed = z
    .array(schema)
    .min(min, min === 1 ? "Add at least one entry" : `Add at least ${min} entries`)
    .max(20)
    .safeParse(raw);
  if (parsed.success) return { data: parsed.data };
  const errors = fieldErrors(parsed.error);
  return { error: { errors: Object.fromEntries(Object.entries(errors).map(([k, v]) => [k === "_form" ? "_form" : `items.${k}`, v])) } };
}

const yearsInOrder = (items: { startYear?: number; endYear?: number }[]) =>
  items.every((i) => !i.startYear || !i.endYear || i.endYear >= i.startYear);

export async function saveListAction(kind: ListKind, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("items") ?? "[]"));
  } catch {
    return { message: "Could not read the form. Please try again." };
  }
  const withOwner = <T extends object>(items: T[]) => items.map((item, position) => ({ ...item, userId: user.id, position }));
  const outOfOrder: FormState = { message: "An end year is earlier than its start year." };

  if (kind === "education") {
    const r = parseList(listSchemas.education, MIN_ITEMS.education, raw);
    if ("error" in r) return r.error;
    if (!yearsInOrder(r.data)) return outOfOrder;
    await db.$transaction([
      db.education.deleteMany({ where: { userId: user.id } }),
      db.education.createMany({ data: withOwner(r.data) }),
    ]);
  } else if (kind === "experience") {
    const r = parseList(listSchemas.experience, MIN_ITEMS.experience, raw);
    if ("error" in r) return r.error;
    if (!yearsInOrder(r.data)) return outOfOrder;
    await db.$transaction([
      db.experience.deleteMany({ where: { userId: user.id } }),
      db.experience.createMany({ data: withOwner(r.data) }),
    ]);
  } else if (kind === "ventures") {
    const r = parseList(listSchemas.ventures, MIN_ITEMS.ventures, raw);
    if ("error" in r) return r.error;
    if (!yearsInOrder(r.data)) return outOfOrder;
    await db.$transaction([
      db.pastVenture.deleteMany({ where: { userId: user.id } }),
      db.pastVenture.createMany({ data: withOwner(r.data) }),
    ]);
  } else {
    const r = parseList(listSchemas.references, MIN_ITEMS.references, raw);
    if ("error" in r) return r.error;
    await db.$transaction([
      db.reference.deleteMany({ where: { userId: user.id } }),
      db.reference.createMany({ data: withOwner(r.data) }),
    ]);
  }
  return done(user.id, kind);
}

// ─── Goals ────────────────────────────────────────────────────────────────────

const goalsSchema = z.object({
  goals1y: requiredText(2000, 30),
  goals5y: requiredText(2000, 30),
  goals10y: requiredText(2000, 30),
  motivation: requiredText(2000, 30),
  causeCare: requiredText(2000, 20),
  successDefinition: requiredText(2000, 20),
  timeCommitment: z.enum(["FULL_TIME", "PART_TIME", "FLEXIBLE"], { error: "Select your time commitment" }),
  otherCommitments: optionalText(1000),
  values: requiredText(1000, 20),
  setbackStory: requiredText(3000, 50),
});

export async function saveGoalsAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = formValues(fd);
  const parsed = goalsSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const data = { ...parsed.data, otherCommitments: parsed.data.otherCommitments ?? null };
  await db.goalsProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  return done(user.id, "goals");
}

// ─── Declarations ─────────────────────────────────────────────────────────────

const yesNo = z.enum(["yes", "no"], { error: "Answer yes or no" }).transform((v) => v === "yes");

const declarationSchema = z
  .object({
    hasCriminalRecord: yesNo,
    hasPendingLitigation: yesNo,
    hasBankruptcyOrDefault: yesNo,
    isPep: yesNo,
    hasConflictOfInterest: yesNo,
    details: optionalText(3000),
    truthAffirmed: z.literal("on", { error: "You must confirm this statement" }),
    consentBackgroundCheck: z.literal("on", { error: "You must consent to background checks" }),
  })
  .refine(
    (v) => !(v.hasCriminalRecord || v.hasPendingLitigation || v.hasBankruptcyOrDefault || v.isPep || v.hasConflictOfInterest) || !!v.details,
    { path: ["details"], message: "Please explain each “yes” answer" },
  );

export async function saveDeclarationsAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = formValues(fd);
  const parsed = declarationSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const { truthAffirmed, consentBackgroundCheck, ...answers } = parsed.data;
  const { ip } = await requestMeta();
  const data = {
    ...answers,
    details: answers.details ?? null,
    truthAffirmed: truthAffirmed === "on",
    consentBackgroundCheck: consentBackgroundCheck === "on",
    signedAt: new Date(),
    signedIp: ip,
  };
  await db.integrityDeclaration.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  return done(user.id, "declarations");
}
