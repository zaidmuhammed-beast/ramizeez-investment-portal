// Pure identity checks used by the built-in KYC provider (no I/O, unit-tested).
import type { IdentitySubmission } from "./provider";
import type { CheckResult } from "./types";
import { genderFromCnic, hasValidRegionCode } from "./cnic";
import { mrzDateToIso, parseTd3 } from "./mrz";
import { nameSimilarity } from "./names";

/** The signed challenge must be completed and submitted within this window. */
export const LIVENESS_MAX_SECONDS = 20 * 60;
const DAY = 86_400_000;

export type DuplicateContext = {
  documentUsedByOthers: boolean;
  imageReusedByOthers: boolean;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function ageOn(dob: Date, at: Date): number {
  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  const m = at.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export function runIdentityChecks(input: IdentitySubmission, dup: DuplicateContext, now = new Date()): CheckResult[] {
  const { document: doc, images, liveness } = input;
  const out: CheckResult[] = [];
  const add = (id: string, label: string, status: CheckResult["status"], detail: string) =>
    out.push({ id, label, status, detail });

  // Document number format
  if (doc.type === "CNIC" || doc.type === "NICOP") {
    if (!hasValidRegionCode(doc.number)) add("doc.number", "Document number", "FAIL", "CNIC/NICOP region code (first digit) must be 1–7");
    else add("doc.number", "Document number", "PASS", "13-digit CNIC/NICOP format is valid");
    if (doc.issuingCountry !== "PK") add("doc.country", "Issuing country", "FAIL", "CNIC/NICOP must be issued by Pakistan");
    if (doc.gender && (doc.gender === "M" || doc.gender === "F")) {
      const derived = genderFromCnic(doc.number);
      add("doc.gender", "Gender digit", derived === doc.gender ? "PASS" : "WARN",
        derived === doc.gender ? "Last digit is consistent with the stated gender" : "Last CNIC digit does not match the stated gender — confirm against the card");
    }
  } else if (doc.type === "PASSPORT") {
    add("doc.number", "Document number", /^[A-Z0-9]{6,9}$/.test(doc.number) ? "PASS" : "FAIL", "Passport numbers are 6–9 letters/digits");
  } else {
    add("doc.number", "Document number", /^[A-Z0-9-]{4,20}$/.test(doc.number) ? "PASS" : "FAIL", "National ID number format");
  }

  // MRZ (passports)
  if (doc.type === "PASSPORT") {
    const mrz = doc.mrz ? parseTd3(doc.mrz) : null;
    if (!mrz) {
      add("doc.mrz", "Passport MRZ", "FAIL", "The two MRZ lines (44 characters each) could not be read");
    } else {
      const c = mrz.checks;
      const digitsOk = c.documentNumber && c.dateOfBirth && c.expiryDate && c.composite;
      add("doc.mrz", "MRZ check digits", digitsOk ? "PASS" : "FAIL",
        digitsOk ? "All ICAO 9303 check digits are valid" : `Invalid check digit(s): ${Object.entries(c).filter(([, v]) => !v).map(([k]) => k).join(", ")}`);
      const mismatches: string[] = [];
      if (mrz.documentNumber !== doc.number) mismatches.push("document number");
      if (mrzDateToIso(mrz.dateOfBirth, "birth") !== iso(doc.dateOfBirth)) mismatches.push("date of birth");
      if (mrzDateToIso(mrz.expiryDate, "expiry") !== iso(doc.expiryDate)) mismatches.push("expiry date");
      if (nameSimilarity(`${mrz.givenNames} ${mrz.surname}`, doc.fullNameOnDoc) < 0.85) mismatches.push("name");
      add("doc.mrz_match", "MRZ matches entered details", mismatches.length ? "FAIL" : "PASS",
        mismatches.length ? `MRZ differs on: ${mismatches.join(", ")}` : "Number, name, birth and expiry dates agree with the MRZ");
    }
  }

  // Validity dates
  const daysLeft = Math.floor((doc.expiryDate.getTime() - now.getTime()) / DAY);
  if (daysLeft < 0) add("doc.expiry", "Document expiry", "FAIL", `Expired on ${iso(doc.expiryDate)}`);
  else if (daysLeft < 180) add("doc.expiry", "Document expiry", "WARN", `Expires in ${daysLeft} days — re-verification will be needed soon`);
  else add("doc.expiry", "Document expiry", "PASS", `Valid until ${iso(doc.expiryDate)}`);

  const age = ageOn(doc.dateOfBirth, now);
  add("doc.age", "Age", age >= 18 && age <= 110 ? "PASS" : "FAIL", age >= 18 ? `${age} years old` : "Must be at least 18 years old");

  // Name on document vs account
  const sim = nameSimilarity(input.accountName, doc.fullNameOnDoc);
  add("doc.name", "Name matches account", sim >= 0.85 ? "PASS" : sim >= 0.7 ? "WARN" : "FAIL",
    `Similarity ${(sim * 100).toFixed(0)}% between “${input.accountName}” and “${doc.fullNameOnDoc}”`);

  // Duplicates & image integrity
  add("dup.document", "Duplicate document", dup.documentUsedByOthers ? "FAIL" : "PASS",
    dup.documentUsedByOthers ? "This document number is already linked to another account" : "Not linked to any other account");
  const hashes = images.map((i) => i.sha256);
  const selfReuse = new Set(hashes).size !== hashes.length;
  add("dup.images", "Image reuse", dup.imageReusedByOthers || selfReuse ? "FAIL" : "PASS",
    dup.imageReusedByOthers ? "An identical image was submitted by another account"
      : selfReuse ? "The same image was used for more than one capture" : "All images are unique");

  const uploaded = images.filter((i) => !i.liveCapture).map((i) => i.role);
  add("capture.live", "Live camera capture", uploaded.length ? "WARN" : "PASS",
    uploaded.length ? `Uploaded from files instead of the live camera: ${[...new Set(uploaded)].join(", ")}` : "All images were captured live");

  // Liveness challenge
  const selfies = images.filter((i) => i.role === "selfie");
  const elapsed = (liveness.submittedAt - liveness.issuedAt) / 1000;
  const livenessOk = selfies.length === liveness.prompts.length && elapsed >= 0 && elapsed <= LIVENESS_MAX_SECONDS;
  add("liveness.challenge", "Liveness challenge", livenessOk ? "PASS" : "FAIL",
    livenessOk ? `${selfies.length} prompted frames, submitted ${Math.round(elapsed / 60)} min after the challenge was issued`
      : `Expected ${liveness.prompts.length} frames submitted within ${LIVENESS_MAX_SECONDS / 60} minutes of the challenge`);
  add("liveness.review", "Liveness & face match", "MANUAL",
    "Officer must confirm each frame shows a live person performing the prompt, and that the face matches the document photo");

  // AML
  add("aml.screening", "Sanctions / PEP screening", input.aml.result === "CLEAR" ? "PASS" : "WARN",
    input.aml.result === "CLEAR" ? "No watchlist matches" : "Potential watchlist match — review the hits before approving");

  // Government registry
  if (doc.type === "CNIC" || doc.type === "NICOP") {
    add("gov.nadra", "NADRA Verisys", "MANUAL", "Registry lookup is not connected in the built-in provider — verify the CNIC manually");
  } else {
    add("gov.registry", "Issuer registry", "MANUAL", "Confirm the document visually against the issuing country's template");
  }

  return out;
}
