"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FileKind } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { indexOf, seal } from "@/lib/keys";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/session";
import { FileRejected, saveFile } from "@/lib/storage";
import { normalizeCnic } from "@/lib/kyc/cnic";
import { issueLivenessChallenge, verifyLivenessChallenge } from "@/lib/kyc/challenge";
import { screenPerson } from "@/lib/kyc/aml";
import { getKycProvider } from "@/lib/kyc/provider";
import { riskFrom } from "@/lib/kyc/types";
import { countrySchema, dateSchema, fieldErrors, optionalText, requiredText } from "@/lib/validation/common";
import type { FormState } from "@/lib/form-state";

export async function startLivenessAction() {
  const user = await requireUser();
  return issueLivenessChallenge(user.id);
}

const schema = z
  .object({
    docType: z.enum(["CNIC", "NICOP", "PASSPORT", "NATIONAL_ID"], { error: "Choose a document type" }),
    issuingCountry: countrySchema,
    docNumber: z.string().trim().min(4, "Enter the document number").max(30),
    fullNameOnDoc: requiredText(120),
    dateOfBirth: dateSchema,
    gender: z.enum(["M", "F", "X"]).optional(),
    issueDate: z.union([z.literal(""), dateSchema]).optional(),
    expiryDate: dateSchema,
    mrz: optionalText(100),
    addressLine1: requiredText(200),
    addressLine2: optionalText(200),
    city: requiredText(80),
    region: optionalText(80),
    postalCode: optionalText(20),
    addressCountry: countrySchema,
    livenessPrompts: z.string().transform((v, ctx) => {
      try {
        const arr = JSON.parse(v);
        if (Array.isArray(arr) && arr.every((p) => typeof p === "string")) return arr as string[];
      } catch {}
      ctx.addIssue({ code: "custom", message: "Complete the liveness check" });
      return z.NEVER;
    }),
    livenessIssuedAt: z.coerce.number().int(),
    livenessToken: z.string().min(1, "Complete the liveness check"),
  })
  .refine((v) => v.docType !== "PASSPORT" || !!v.mrz, { path: ["mrz"], message: "Enter both MRZ lines from the photo page" });

const fileOf = (fd: FormData, key: string) => {
  const f = fd.get(key);
  return f instanceof File && f.size > 0 ? f : null;
};

export async function submitIdentityAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const rl = rateLimit(`kyc:${user.id}`, 5, 60 * 60 * 1000);
  if (!rl.ok) return { message: "Too many submissions. Please try again later." };

  const existing = await db.verificationCase.findFirst({ where: { userId: user.id, kind: "IDENTITY" }, orderBy: { createdAt: "desc" } });
  if (existing && (existing.status === "IN_REVIEW" || existing.status === "APPROVED")) redirect("/onboarding/identity");
  if (existing?.status === "REJECTED") return { message: "Your identity verification was rejected. Contact support." };

  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), message: "Please fix the highlighted fields." };
  const v = parsed.data;

  // Normalise the document number per type.
  let number: string;
  if (v.docType === "CNIC" || v.docType === "NICOP") {
    const n = normalizeCnic(v.docNumber);
    if (!n) return { errors: { docNumber: "CNIC/NICOP numbers have 13 digits (e.g. 35202-1234567-1)" } };
    number = n;
  } else {
    number = v.docNumber.toUpperCase().replace(/[\s]/g, "");
  }

  if (!verifyLivenessChallenge(user.id, v.livenessPrompts, v.livenessIssuedAt, v.livenessToken)) {
    return { message: "The liveness check could not be verified. Please redo it." };
  }

  const front = fileOf(fd, "front");
  const back = fileOf(fd, "back");
  const proof = fileOf(fd, "proofOfAddress");
  const selfies = v.livenessPrompts.map((_, i) => fileOf(fd, `selfie_${i}`));
  const errors: Record<string, string> = {};
  if (!front) errors.front = "Capture the front of your document";
  if (v.docType !== "PASSPORT" && !back) errors.back = "Capture the back of your document";
  if (selfies.some((s) => !s)) errors.liveness = "Complete every liveness step";
  if (!proof) errors.proofOfAddress = "Upload a utility bill or bank statement";
  if (Object.keys(errors).length) return { errors, message: "Some captures are missing." };

  const live = (key: string) => fd.get(`${key}_live`) === "1";
  const allLive = live("front") && (v.docType === "PASSPORT" || live("back")) && selfies.every((_, i) => live(`selfie_${i}`));
  if (!allLive && !env().KYC_ALLOW_FILE_UPLOAD) return { message: "Please capture every image with your camera." };

  let saved;
  try {
    const store = (file: File, kind: FileKind, liveCapture: boolean, allow: ("image" | "pdf")[] = ["image"]) =>
      saveFile({ ownerId: user.id, kind, file, liveCapture, allow });
    saved = {
      front: await store(front!, "ID_FRONT", live("front")),
      back: back ? await store(back, "ID_BACK", live("back")) : null,
      selfies: await Promise.all(selfies.map((s, i) => store(s!, "SELFIE", live(`selfie_${i}`)))),
      proof: await store(proof!, "PROOF_OF_ADDRESS", false, ["image", "pdf"]),
    };
  } catch (e) {
    if (e instanceof FileRejected) return { message: e.message };
    throw e;
  }

  const numberIndex = indexOf(`${v.docType === "NICOP" ? "CNIC" : v.docType}:${v.issuingCountry}:${number}`);
  const aml = await screenPerson(user.id, v.fullNameOnDoc, v.dateOfBirth);
  const provider = getKycProvider();
  const checks = await provider.checkIdentity({
    userId: user.id,
    accountName: `${user.firstName} ${user.lastName}`,
    document: {
      type: v.docType,
      number,
      numberIndex,
      issuingCountry: v.issuingCountry,
      fullNameOnDoc: v.fullNameOnDoc,
      dateOfBirth: v.dateOfBirth,
      gender: v.gender,
      expiryDate: v.expiryDate,
      mrz: v.mrz,
    },
    images: [
      { role: "front" as const, sha256: saved.front.sha256, liveCapture: saved.front.liveCapture, fileId: saved.front.id },
      ...(saved.back ? [{ role: "back" as const, sha256: saved.back.sha256, liveCapture: saved.back.liveCapture, fileId: saved.back.id }] : []),
      ...saved.selfies.map((s) => ({ role: "selfie" as const, sha256: s.sha256, liveCapture: s.liveCapture, fileId: s.id })),
    ],
    liveness: { prompts: v.livenessPrompts, issuedAt: v.livenessIssuedAt, submittedAt: Date.now() },
    aml: { result: aml.result, hits: aml.hits },
  });

  const verificationCase = await db.$transaction(async (tx) => {
    await tx.identityDocument.create({
      data: {
        userId: user.id,
        type: v.docType,
        numberEnc: seal(number),
        numberIndex,
        numberLast4: number.replace(/\W/g, "").slice(-4),
        issuingCountry: v.issuingCountry,
        fullNameOnDoc: v.fullNameOnDoc,
        dateOfBirth: v.dateOfBirth,
        gender: v.gender,
        issueDate: v.issueDate || null,
        expiryDate: v.expiryDate,
        mrz: v.mrz,
        frontFileId: saved.front.id,
        backFileId: saved.back?.id,
      },
    });
    await tx.livenessCheck.create({
      data: {
        userId: user.id,
        challenge: v.livenessPrompts,
        frameIds: saved.selfies.map((s) => s.id),
        issuedAt: new Date(v.livenessIssuedAt),
      },
    });
    const address = {
      line1: v.addressLine1,
      line2: v.addressLine2,
      city: v.city,
      region: v.region,
      postalCode: v.postalCode,
      country: v.addressCountry,
      proofFileId: saved.proof.id,
      verified: false,
    };
    await tx.address.upsert({
      where: { userId_kind: { userId: user.id, kind: "CURRENT" } },
      create: { userId: user.id, kind: "CURRENT", ...address },
      update: address,
    });
    return tx.verificationCase.create({
      data: { userId: user.id, kind: "IDENTITY", checks, riskLevel: riskFrom(checks), provider: provider.name },
    });
  });

  await audit("kyc.identity.submitted", {
    actorId: user.id,
    targetType: "VerificationCase",
    targetId: verificationCase.id,
    metadata: { docType: v.docType, risk: verificationCase.riskLevel },
  });
  redirect("/onboarding/identity");
}
