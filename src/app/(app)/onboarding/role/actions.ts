"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import type { FileKind } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { getOnboardingState } from "@/lib/onboarding";
import { FileRejected, saveFile } from "@/lib/storage";
import { CURRENCIES } from "@/lib/countries";
import { DEAL_TYPES, ENTITY_TYPES, GEOGRAPHIES, INCOME_BANDS, INVESTOR_TYPES, NET_WORTH_BANDS, SECTORS, SOURCES_OF_FUNDS, STAGES } from "@/lib/taxonomy";
import { founderChecks, investorChecks, riskScore, ENTITY_INVESTOR_TYPES, type RiskAnswers } from "@/lib/kyc/role-checks";
import { riskFrom } from "@/lib/kyc/types";
import { MIN_AMOUNT_PKR, PLATFORM_TERMS, formatMoney, meetsMinimum, minimumIn } from "@/config/platform";
import { formValues, type FormState } from "@/lib/form-state";
import { countrySchema, fieldErrors, moneySchema, optionalText, requiredText } from "@/lib/validation/common";

const keys = <T extends readonly (readonly [string, ...string[]])[]>(list: T) => list.map((x) => x[0]) as [T[number][0], ...T[number][0][]];

const files = (fd: FormData, key: string) => fd.getAll(key).filter((f): f is File => f instanceof File && f.size > 0);

async function storeAll(user: CurrentUser, list: File[], kind: FileKind) {
  const out: string[] = [];
  for (const file of list.slice(0, 10)) {
    out.push((await saveFile({ ownerId: user.id, kind, file, allow: ["image", "pdf"] })).id);
  }
  return out;
}

async function assertEditable(userId: string) {
  const c = await db.verificationCase.findFirst({ where: { userId, kind: "ROLE" }, orderBy: { createdAt: "desc" } });
  return !c || c.status === "NEEDS_INFO";
}

// ─── Investor ─────────────────────────────────────────────────────────────────

const yes = z.literal("yes", { error: "You must accept this to invest" });

const investorSchema = z.object({
  investorType: z.enum(keys(INVESTOR_TYPES), { error: "Select an investor type" }),
  currency: z.enum(CURRENCIES, { error: "Select a currency" }),
  declaredBudget: moneySchema,
  ticketMin: moneySchema,
  ticketMax: moneySchema,
  sourceOfFunds: z.array(z.enum(keys(SOURCES_OF_FUNDS))).min(1, "Select at least one source"),
  sourceOfWealth: requiredText(2000, 30),
  annualIncomeBand: z.enum(INCOME_BANDS, { error: "Select a band" }),
  netWorthBand: z.enum(NET_WORTH_BANDS, { error: "Select a band" }),
  experience: requiredText(3000, 20),
  sectors: z.array(z.enum(SECTORS)).min(1, "Select at least one sector"),
  stages: z.array(z.enum(keys(STAGES))).min(1, "Select at least one stage"),
  dealTypes: z.array(z.enum(keys(DEAL_TYPES))).min(1, "Select at least one deal type"),
  geographies: z.array(z.enum(GEOGRAPHIES)).min(1, "Select at least one region"),
  shariahOnly: z.enum(["yes", "no"]).transform((v) => v === "yes"),
  understandsLoss: yes,
  understandsIlliquidity: yes,
  horizon: z.string().min(1, "Answer this question"),
  portion: z.string().min(1, "Answer this question"),
  reaction: z.string().min(1, "Answer this question"),
  entityName: optionalText(200),
  entityRegNumber: optionalText(100),
});

export async function saveInvestorAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.roles.includes("INVESTOR")) redirect("/onboarding/role");
  if (!(await assertEditable(user.id))) return { message: "Your role verification is already under review." };
  const values = formValues(fd);
  const multi = (k: string) => fd.getAll(k).map(String);
  const parsed = investorSchema.safeParse({
    ...Object.fromEntries(fd),
    sourceOfFunds: multi("sourceOfFunds"),
    sectors: multi("sectors"),
    stages: multi("stages"),
    dealTypes: multi("dealTypes"),
    geographies: multi("geographies"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values, message: "Please fix the highlighted fields." };
  const v = parsed.data;
  if (v.ticketMin > v.ticketMax) return { errors: { ticketMin: "Must not exceed the maximum ticket" }, values };
  if (v.ticketMax > v.declaredBudget) return { errors: { ticketMax: "Must not exceed your total budget" }, values };
  if (!meetsMinimum(v.ticketMin, v.currency)) {
    return { errors: { ticketMin: `The minimum investment per deal is PKR ${MIN_AMOUNT_PKR.toLocaleString("en-US")} (≈ ${formatMoney(minimumIn(v.currency), v.currency)})` }, values };
  }
  const isEntity = (ENTITY_INVESTOR_TYPES as readonly string[]).includes(v.investorType);
  if (isEntity && (!v.entityName || !v.entityRegNumber)) {
    const errors: Record<string, string> = {};
    if (!v.entityName) errors.entityName = "Required for entities";
    if (!v.entityRegNumber) errors.entityRegNumber = "Required for entities";
    return { errors, values };
  }

  const existing = await db.investorProfile.findUnique({ where: { userId: user.id } });
  let pof: string[], entityDocs: string[];
  try {
    pof = [...(existing?.proofOfFundsIds ?? []), ...(await storeAll(user, files(fd, "proofOfFunds"), "PROOF_OF_FUNDS"))];
    entityDocs = [...(existing?.entityDocumentIds ?? []), ...(await storeAll(user, files(fd, "entityDocs"), "BUSINESS_REGISTRATION"))];
  } catch (e) {
    if (e instanceof FileRejected) return { message: e.message, values };
    throw e;
  }
  if (!pof.length) return { errors: { proofOfFunds: "Upload at least one proof-of-funds document" }, values };

  const risk = { understandsLoss: true, understandsIlliquidity: true, horizon: v.horizon, portion: v.portion, reaction: v.reaction };
  const data = {
    investorType: v.investorType,
    currency: v.currency,
    declaredBudget: v.declaredBudget,
    ticketMin: v.ticketMin,
    ticketMax: v.ticketMax,
    sourceOfFunds: v.sourceOfFunds,
    sourceOfWealth: v.sourceOfWealth,
    annualIncomeBand: v.annualIncomeBand,
    netWorthBand: v.netWorthBand,
    experience: v.experience,
    sectors: v.sectors,
    stages: v.stages,
    dealTypes: v.dealTypes,
    geographies: v.geographies,
    shariahOnly: v.shariahOnly,
    riskAnswers: risk,
    riskScore: riskScore(risk),
    entityName: isEntity ? v.entityName : null,
    entityRegNumber: isEntity ? v.entityRegNumber : null,
    proofOfFundsIds: pof,
    entityDocumentIds: entityDocs,
  };
  await db.investorProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  await audit("profile.investor.saved", { actorId: user.id });
  refresh();
  return { ok: true, message: "Investor profile saved." };
}

// ─── Founder ──────────────────────────────────────────────────────────────────

const founderSchema = z.object({
  stage: z.enum(["IDEA", "EXISTING"], { error: "Select your stage" }),
  businessName: optionalText(200),
  sector: z.enum(SECTORS, { error: "Select a sector" }),
  country: countrySchema,
  city: requiredText(80),
  entityType: z.union([z.literal(""), z.enum(keys(ENTITY_TYPES))]).optional(),
  registrationNumber: optionalText(100),
  taxNumber: optionalText(100),
  foundedYear: z.union([z.literal(""), z.coerce.number().int().min(1900).max(new Date().getFullYear())]).optional(),
  employees: z.union([z.literal(""), z.coerce.number().int().min(0).max(1_000_000)]).optional(),
  personalCapital: z.union([z.literal(""), z.coerce.number().min(0)]).optional(),
  currency: z.enum(CURRENCIES, { error: "Select a currency" }),
  coFounders: optionalText(2000),
  preferredDealTypes: z.array(z.enum(keys(DEAL_TYPES))).min(1, "Select at least one deal type"),
  acceptPlatformTerms: z.literal("on", { error: "You must accept the RamiZeeZ terms to raise through the platform" }),
});

export async function saveFounderAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.roles.includes("FOUNDER")) redirect("/onboarding/role");
  if (!(await assertEditable(user.id))) return { message: "Your role verification is already under review." };
  const values = formValues(fd);
  const parsed = founderSchema.safeParse({ ...Object.fromEntries(fd), preferredDealTypes: fd.getAll("preferredDealTypes").map(String) });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values, message: "Please fix the highlighted fields." };
  const v = parsed.data;
  if (v.stage === "EXISTING") {
    const errors: Record<string, string> = {};
    if (!v.businessName) errors.businessName = "Required for an existing business";
    if (!v.entityType) errors.entityType = "Required for an existing business";
    if (!v.registrationNumber) errors.registrationNumber = "Required for an existing business";
    if (Object.keys(errors).length) return { errors, values };
  }

  const existing = await db.founderProfile.findUnique({ where: { userId: user.id } });
  let docs: string[];
  try {
    docs = [
      ...(existing?.documentIds ?? []),
      ...(await storeAll(user, files(fd, "registrationDocs"), "BUSINESS_REGISTRATION")),
      ...(await storeAll(user, files(fd, "taxDocs"), "TAX_REGISTRATION")),
      ...(await storeAll(user, files(fd, "bankStatements"), "BANK_STATEMENT")),
      ...(await storeAll(user, files(fd, "financials"), "FINANCIAL_STATEMENT")),
    ];
  } catch (e) {
    if (e instanceof FileRejected) return { message: e.message, values };
    throw e;
  }
  const data = {
    stage: v.stage,
    businessName: v.businessName ?? null,
    sector: v.sector,
    country: v.country,
    city: v.city,
    entityType: v.entityType || null,
    registrationNumber: v.registrationNumber ?? null,
    taxNumber: v.taxNumber ?? null,
    foundedYear: typeof v.foundedYear === "number" ? v.foundedYear : null,
    employees: typeof v.employees === "number" ? v.employees : null,
    personalCapital: typeof v.personalCapital === "number" ? v.personalCapital : null,
    currency: v.currency,
    coFounders: v.coFounders ?? null,
    preferredDealTypes: v.preferredDealTypes,
    documentIds: docs,
    // Keep the original acceptance date unless the terms have changed since.
    platformTermsVersion: PLATFORM_TERMS.version,
    platformTermsAcceptedAt:
      existing?.platformTermsVersion === PLATFORM_TERMS.version && existing.platformTermsAcceptedAt ? existing.platformTermsAcceptedAt : new Date(),
  };
  await db.founderProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  await audit("profile.founder.saved", { actorId: user.id });
  refresh();
  return { ok: true, message: "Founder profile saved." };
}

// ─── Submit for review ────────────────────────────────────────────────────────

export async function submitRoleAction(): Promise<void> {
  const user = await requireUser();
  const state = await getOnboardingState(user.id);
  if (state.tier < 2 || !state.roleProfilesReady || !(await assertEditable(user.id))) redirect("/onboarding/role");

  const { investorProfile: inv, founderProfile: fdr } = state.user;
  const checks = [
    ...(inv
      ? investorChecks({
          investorType: inv.investorType,
          declaredBudget: Number(inv.declaredBudget),
          ticketMin: Number(inv.ticketMin),
          ticketMax: Number(inv.ticketMax),
          currency: inv.currency,
          sourceOfFunds: inv.sourceOfFunds,
          proofOfFundsCount: inv.proofOfFundsIds.length,
          entityName: inv.entityName,
          entityRegNumber: inv.entityRegNumber,
          entityDocumentCount: inv.entityDocumentIds.length,
          risk: inv.riskAnswers as RiskAnswers,
        })
      : []),
    ...(fdr
      ? founderChecks({ stage: fdr.stage, platformTermsVersion: fdr.platformTermsVersion, businessName: fdr.businessName, registrationNumber: fdr.registrationNumber, documentCount: fdr.documentIds.length })
      : []),
  ];
  const c = await db.verificationCase.create({
    data: { userId: user.id, kind: "ROLE", checks, riskLevel: riskFrom(checks), provider: "internal" },
  });
  await audit("kyc.role.submitted", { actorId: user.id, targetType: "VerificationCase", targetId: c.id });
  redirect("/onboarding/role");
}
