"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import type { FileKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requestMeta } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { recomputeTier } from "@/lib/onboarding";
import { FileRejected, saveFile } from "@/lib/storage";
import { CURRENCIES } from "@/lib/countries";
import { SECTORS } from "@/lib/taxonomy";
import { PLATFORM_TERMS } from "@/config/platform";
import { formValues, type FormState } from "@/lib/form-state";
import { countrySchema, fieldErrors } from "@/lib/validation/common";
import { toPitchData } from "@/lib/pitch/data";
import { pitchIssues } from "@/lib/pitch/completeness";
import { fingerprint, submissionSnapshot } from "@/lib/pitch/fingerprint";
import { COST_CATEGORIES, RISK_CATEGORIES } from "@/lib/pitch/sections";
import { FOUNDER_EDITABLE, FOUNDER_WITHDRAWABLE } from "@/lib/pitch/workflow";

const MAX_ACTIVE_PITCHES = 5;
const MAX_IMAGES = 6;
const MAX_DOCUMENTS = 10;

// ─── Field helpers (drafts: format only; completeness is checked on submit) ───

const txt = (max = 4000) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : null));

const num = (opts: { min?: number; max?: number; int?: boolean } = {}) =>
  z
    .union([z.literal(""), z.null(), z.coerce.number()])
    // .optional() makes absent keys (fields hidden for other deal types) valid in Zod 4.
    .optional()
    .transform((v) => (typeof v === "number" ? v : null))
    .refine((v) => v === null || Number.isFinite(v), "Enter a number")
    .refine((v) => v === null || opts.min === undefined || v >= opts.min, `Must be at least ${opts.min}`)
    .refine((v) => v === null || opts.max === undefined || v <= opts.max, `Must be at most ${opts.max}`)
    .refine((v) => v === null || !opts.int || Number.isInteger(v), "Enter a whole number");

const keysOf = <T extends readonly (readonly [string, ...string[]])[]>(list: T) => list.map((x) => x[0]) as [T[number][0], ...T[number][0][]];

const SECTION_SCHEMAS = {
  overview: z.object({
    title: z.string().trim().min(3, "Give the pitch a title").max(120),
    type: z.enum(["IDEA", "EXISTING"]),
    sector: z.union([z.literal(""), z.enum(SECTORS)]).transform((v) => v || null),
    country: z.union([z.literal(""), countrySchema]).transform((v) => v || null),
    city: txt(80),
    oneLiner: txt(160),
    problem: txt(),
    solution: txt(),
    whyNow: txt(2000),
  }),
  team: z.object({ teamExperience: txt(), advisors: txt(2000), plannedHires: txt(2000) }),
  market: z.object({ targetCustomers: txt(), marketSize: txt(), competitors: txt(), differentiation: txt() }),
  model: z.object({ revenueModel: txt(), pricing: txt(2000), unitEconomics: txt(), channels: txt(2000), partners: txt(2000) }),
  traction: z.object({
    startedYear: num({ min: 1950, max: new Date().getFullYear(), int: true }),
    employees: num({ min: 0, max: 1_000_000, int: true }),
    revenueLast12: num({ min: 0 }),
    expensesLast12: num({ min: 0 }),
    monthlyRevenue: num({ min: 0 }),
    customers: num({ min: 0, int: true }),
    tractionNotes: txt(),
    liabilities: txt(2000),
    existingInvestors: txt(2000),
  }),
  ask: z.object({
    currency: z.enum(CURRENCIES),
    amount: num({ min: 0 }),
    minTicket: num({ min: 0 }),
    multipleInvestors: z.enum(["yes", "no"]).optional().transform((v) => v !== "no"),
    dealType: z.union([z.literal(""), z.enum(["EQUITY", "MUSHARAKAH", "MUDARABAH", "REVENUE_SHARE"])]).transform((v) => v || null),
    equityPercent: num({ min: 0, max: 100 }),
    profitSharePercent: num({ min: 0, max: 100 }),
    founderCapital: num({ min: 0 }),
    revenueSharePercent: num({ min: 0, max: 100 }),
    returnCapMultiple: num({ min: 0, max: 10 }),
    termMonths: num({ min: 1, max: 240, int: true }),
    valuation: num({ min: 0 }),
    valuationMethod: txt(2000),
    nonFinancialAsks: txt(2000),
    expectedReturn: txt(2000),
    exitOptions: txt(2000),
  }),
  financials: z.object({ projectionAssumptions: txt() }),
  risks: z.object({ failurePlan: txt() }),
} as const;

const listSchemas = {
  team: z.array(
    z.object({
      name: z.string().trim().min(1, "Required").max(120),
      role: z.string().trim().min(1, "Required").max(120),
      commitment: z.enum(["FULL_TIME", "PART_TIME"], { error: "Choose one" }),
      equityPercent: num({ min: 0, max: 100 }),
    }),
  ).max(20),
  costing: z.array(
    z.object({
      category: z.enum(keysOf(COST_CATEGORIES), { error: "Choose a category" }),
      item: z.string().trim().min(1, "Required").max(200),
      quantity: z.coerce.number({ error: "Enter a quantity" }).positive("Must be more than 0").max(1e9),
      unitCost: z.coerce.number({ error: "Enter a cost" }).min(0).max(1e13),
      timing: txt(80),
    }),
  ).max(100),
  roadmap: z.array(
    z.object({
      month: z.coerce.number({ error: "Enter a month" }).int("Whole months").min(0).max(120),
      title: z.string().trim().min(1, "Required").max(200),
      successMetric: z.string().trim().min(5, "Describe a measurable result").max(500),
      budget: z.coerce.number({ error: "Enter a budget" }).min(0).max(1e13),
      owner: txt(120),
    }),
  ).max(30),
  risks: z.array(
    z.object({
      category: z.enum(keysOf(RISK_CATEGORIES), { error: "Choose a category" }),
      risk: z.string().trim().min(5, "Describe the risk").max(1000),
      mitigation: z.string().trim().min(5, "Describe your plan").max(1000),
    }),
  ).max(30),
  financials: z.array(
    z.object({ year: z.coerce.number().int().min(1).max(5), revenue: num(), costs: num(), cashFlow: num() }),
  ).length(5),
} as const;

// ─── Access ───────────────────────────────────────────────────────────────────

async function ownPitch(user: CurrentUser, pitchId: string) {
  const pitch = await db.pitch.findFirst({ where: { id: pitchId, founderId: user.id } });
  if (!pitch) redirect("/pitches");
  return pitch;
}

async function editablePitch(user: CurrentUser, pitchId: string) {
  const pitch = await ownPitch(user, pitchId);
  return FOUNDER_EDITABLE.includes(pitch.status) ? pitch : null;
}

const LOCKED: FormState = { message: "This pitch is under review and can't be edited. If our team returns it for changes, you can edit it again." };

function listErrors(error: z.ZodError): FormState {
  const errors = fieldErrors(error);
  return { errors: Object.fromEntries(Object.entries(errors).map(([k, v]) => [k === "_form" ? "_form" : `items.${k}`, v])) };
}

function parseItems(fd: FormData): unknown {
  try {
    return JSON.parse(String(fd.get("items") ?? "[]"));
  } catch {
    return null;
  }
}

const markSaved = (sections: string[], key: string) => (sections.includes(key) ? sections : [...sections, key]);

// ─── Create / withdraw ────────────────────────────────────────────────────────

export async function createPitchAction(fd: FormData) {
  const user = await requireUser();
  if (!user.roles.includes("FOUNDER")) redirect("/dashboard");
  const tier = await recomputeTier(user.id);
  if (tier < 1) redirect("/pitches");
  const active = await db.pitch.count({ where: { founderId: user.id, status: { notIn: ["WITHDRAWN", "REJECTED"] } } });
  if (active >= MAX_ACTIVE_PITCHES) redirect("/pitches?limit=1");
  const title = String(fd.get("title") ?? "").trim().slice(0, 120) || "Untitled pitch";
  const founder = await db.founderProfile.findUnique({ where: { userId: user.id } });
  const pitch = await db.pitch.create({
    data: {
      founderId: user.id,
      title,
      type: founder?.stage ?? "IDEA",
      sector: founder?.sector,
      country: founder?.country ?? user.countryOfResidence,
      city: founder?.city,
      currency: founder?.currency ?? (user.countryOfResidence === "PK" ? "PKR" : "USD"),
      teamMembers: [{ name: `${user.firstName} ${user.lastName}`, role: "Founder", commitment: "FULL_TIME", equityPercent: null }],
      projections: [1, 2, 3, 4, 5].map((year) => ({ year, revenue: null, costs: null, cashFlow: null })),
      events: { create: { toStatus: "DRAFT", actorId: user.id } },
    },
  });
  await audit("pitch.created", { actorId: user.id, targetType: "Pitch", targetId: pitch.id });
  redirect(`/pitches/${pitch.id}`);
}

export async function withdrawPitchAction(pitchId: string) {
  const user = await requireUser();
  const pitch = await ownPitch(user, pitchId);
  if (!FOUNDER_WITHDRAWABLE.includes(pitch.status)) redirect(`/pitches/${pitchId}`);
  await db.pitch.update({
    where: { id: pitch.id },
    data: { status: "WITHDRAWN", events: { create: { fromStatus: pitch.status, toStatus: "WITHDRAWN", actorId: user.id, note: "Withdrawn by the founder" } } },
  });
  await audit("pitch.withdrawn", { actorId: user.id, targetType: "Pitch", targetId: pitch.id });
  redirect("/pitches");
}

// ─── Section saves ────────────────────────────────────────────────────────────

type FieldSection = keyof typeof SECTION_SCHEMAS;

export async function saveSectionAction(pitchId: string, section: FieldSection, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const pitch = await editablePitch(user, pitchId);
  if (!pitch) return LOCKED;
  // `section` arrives from the client: only accept our own keys.
  if (!Object.hasOwn(SECTION_SCHEMAS, section)) return { message: "Unknown section" };
  const schema = SECTION_SCHEMAS[section];
  const values = formValues(fd);
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values, message: "Please fix the highlighted fields." };
  await db.pitch.update({
    where: { id: pitch.id },
    data: { ...(parsed.data as Prisma.PitchUpdateInput), savedSections: markSaved(pitch.savedSections, section) },
  });
  refresh();
  return { ok: true, message: "Saved." };
}

type ListSection = keyof typeof listSchemas;

export async function saveListAction(pitchId: string, section: ListSection, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const pitch = await editablePitch(user, pitchId);
  if (!pitch) return LOCKED;
  const raw = parseItems(fd);
  if (raw === null) return { message: "Could not read the form. Please try again." };
  const saved = markSaved(pitch.savedSections, section);

  if (section === "team") {
    const r = listSchemas.team.safeParse(raw);
    if (!r.success) return listErrors(r.error);
    await db.pitch.update({ where: { id: pitch.id }, data: { teamMembers: r.data, savedSections: saved } });
  } else if (section === "risks") {
    const r = listSchemas.risks.safeParse(raw);
    if (!r.success) return listErrors(r.error);
    await db.pitch.update({ where: { id: pitch.id }, data: { risks: r.data, savedSections: saved } });
  } else if (section === "financials") {
    const r = listSchemas.financials.safeParse(raw);
    if (!r.success) return listErrors(r.error);
    await db.pitch.update({ where: { id: pitch.id }, data: { projections: r.data, savedSections: saved } });
  } else if (section === "costing") {
    const r = listSchemas.costing.safeParse(raw);
    if (!r.success) return listErrors(r.error);
    await db.$transaction([
      db.pitchCostItem.deleteMany({ where: { pitchId: pitch.id } }),
      db.pitchCostItem.createMany({ data: r.data.map((c, position) => ({ ...c, pitchId: pitch.id, position })) }),
      db.pitch.update({ where: { id: pitch.id }, data: { savedSections: saved } }),
    ]);
  } else if (section === "roadmap") {
    const r = listSchemas.roadmap.safeParse(raw);
    if (!r.success) return listErrors(r.error);
    await db.$transaction([
      db.pitchMilestone.deleteMany({ where: { pitchId: pitch.id } }),
      db.pitchMilestone.createMany({ data: r.data.map((m, position) => ({ ...m, pitchId: pitch.id, position })) }),
      db.pitch.update({ where: { id: pitch.id }, data: { savedSections: saved } }),
    ]);
  } else {
    return { message: "Unknown section" };
  }
  refresh();
  return { ok: true, message: "Saved." };
}

// ─── Media ────────────────────────────────────────────────────────────────────

const videoSchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.url("Enter a full link starting with https://").refine((u) => u.startsWith("https://"), "Use an https:// link").nullable());

const files = (fd: FormData, key: string) => fd.getAll(key).filter((f): f is File => f instanceof File && f.size > 0);

export async function saveMediaAction(pitchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const pitch = await editablePitch(user, pitchId);
  if (!pitch) return LOCKED;
  const rl = rateLimit(`pitch-upload:${user.id}`, 30, 60 * 60 * 1000);
  if (!rl.ok) return { message: "Too many uploads. Please try again later." };
  const video = videoSchema.safeParse(fd.get("videoUrl") ?? undefined);
  if (!video.success) return { errors: { videoUrl: video.error.issues[0].message }, values: formValues(fd) };

  const deck = files(fd, "deck")[0];
  const images = files(fd, "images");
  const docs = files(fd, "documents");
  if (pitch.imageFileIds.length + images.length > MAX_IMAGES) return { errors: { images: `Up to ${MAX_IMAGES} images` } };
  if (pitch.documentFileIds.length + docs.length > MAX_DOCUMENTS) return { errors: { documents: `Up to ${MAX_DOCUMENTS} documents` } };

  const store = (file: File, kind: FileKind, allow: ("image" | "pdf")[]) => saveFile({ ownerId: user.id, kind, file, allow });
  let deckId = pitch.deckFileId;
  const imageIds = [...pitch.imageFileIds];
  const docIds = [...pitch.documentFileIds];
  try {
    if (deck) deckId = (await store(deck, "PITCH_DECK", ["pdf"])).id;
    for (const f of images) imageIds.push((await store(f, "PITCH_IMAGE", ["image"])).id);
    for (const f of docs) docIds.push((await store(f, "PITCH_DOCUMENT", ["image", "pdf"])).id);
  } catch (e) {
    if (e instanceof FileRejected) return { message: e.message };
    throw e;
  }
  await db.pitch.update({
    where: { id: pitch.id },
    data: { videoUrl: video.data, deckFileId: deckId, imageFileIds: imageIds, documentFileIds: docIds, savedSections: markSaved(pitch.savedSections, "media") },
  });
  refresh();
  return { ok: true, message: "Saved." };
}

export async function removeFileAction(pitchId: string, fileId: string) {
  const user = await requireUser();
  const pitch = await editablePitch(user, pitchId);
  if (!pitch) return;
  await db.pitch.update({
    where: { id: pitch.id },
    data: {
      deckFileId: pitch.deckFileId === fileId ? null : pitch.deckFileId,
      imageFileIds: pitch.imageFileIds.filter((id) => id !== fileId),
      documentFileIds: pitch.documentFileIds.filter((id) => id !== fileId),
    },
  });
  refresh();
}

// ─── Submit ───────────────────────────────────────────────────────────────────

const declarationsSchema = z.object({
  ownsIdea: z.literal("on", { error: "Confirm that the idea and materials are yours to pitch" }),
  truthful: z.literal("on", { error: "Confirm that the figures are true" }),
  acceptTerms: z.literal("on", { error: "Accept the RamiZeeZ terms" }),
  nonCircumvention: z.literal("on", { error: "Accept the non-circumvention rule" }),
});

export async function submitPitchAction(pitchId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const pitch = await editablePitch(user, pitchId);
  if (!pitch) return LOCKED;
  const tier = await recomputeTier(user.id);
  if (tier < 2) return { message: "Complete identity verification and your full profile (Tier 2) before submitting a pitch." };
  const decl = declarationsSchema.safeParse(Object.fromEntries(fd));
  if (!decl.success) return { errors: fieldErrors(decl.error), values: formValues(fd) };

  const full = await db.pitch.findUniqueOrThrow({ where: { id: pitch.id }, include: { costItems: true, milestones: true } });
  const data = toPitchData(full);
  const issues = pitchIssues(data);
  if (issues.length) return { message: `The pitch isn't complete yet: ${issues.length} item(s) to fix. See the checklist.` };

  const fileIds = [data.deckFileId, ...data.imageFileIds, ...data.documentFileIds].filter((x): x is string => !!x);
  const stored = await db.storedFile.findMany({ where: { id: { in: fileIds } }, select: { id: true, sha256: true } });
  const snapshot = submissionSnapshot(data, Object.fromEntries(stored.map((f) => [f.id, f.sha256])));
  const print = fingerprint(snapshot);
  const version = (await db.pitchSubmission.count({ where: { pitchId: pitch.id } })) + 1;
  const { ip } = await requestMeta();

  await db.$transaction([
    db.pitchSubmission.create({
      data: { pitchId: pitch.id, version, fingerprint: print, snapshot: snapshot as Prisma.InputJsonValue, termsVersion: PLATFORM_TERMS.version, submittedIp: ip },
    }),
    db.pitch.update({
      where: { id: pitch.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        events: { create: { fromStatus: pitch.status, toStatus: "SUBMITTED", actorId: user.id, note: `Version ${version} submitted` } },
      },
    }),
  ]);
  await audit("pitch.submitted", { actorId: user.id, targetType: "Pitch", targetId: pitch.id, metadata: { version, fingerprint: print } });
  redirect(`/pitches/${pitch.id}?s=submit`);
}

