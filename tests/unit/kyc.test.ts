import { describe, expect, it } from "vitest";
import { checkDigit, mrzDateToIso, parseTd3 } from "@/lib/kyc/mrz";
import { genderFromCnic, hasValidRegionCode, normalizeCnic } from "@/lib/kyc/cnic";
import { nameSimilarity, normalizeName } from "@/lib/kyc/names";
import { ageOn, runIdentityChecks } from "@/lib/kyc/checks";
import { riskFrom } from "@/lib/kyc/types";
import type { IdentitySubmission } from "@/lib/kyc/provider";

// ICAO Doc 9303 specimen passport.
const SPECIMEN = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10";

describe("MRZ", () => {
  it("computes check digits", () => {
    expect(checkDigit("L898902C3")).toBe(6);
    expect(checkDigit("740812")).toBe(2);
    expect(checkDigit("120415")).toBe(9);
  });

  it("parses and validates the ICAO specimen", () => {
    const mrz = parseTd3(SPECIMEN)!;
    expect(mrz.surname).toBe("ERIKSSON");
    expect(mrz.givenNames).toBe("ANNA MARIA");
    expect(mrz.documentNumber).toBe("L898902C3");
    expect(mrz.nationality).toBe("UTO");
    expect(mrz.checks).toEqual({ documentNumber: true, dateOfBirth: true, expiryDate: true, composite: true });
  });

  it("detects a tampered line", () => {
    const tampered = SPECIMEN.replace("7408122", "7508122");
    expect(parseTd3(tampered)!.checks.dateOfBirth).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(parseTd3("P<UTO\nshort")).toBeNull();
  });

  it("converts dates with the right century", () => {
    expect(mrzDateToIso("740812", "birth")).toBe("1974-08-12");
    expect(mrzDateToIso("120415", "expiry")).toBe("2012-04-15");
  });
});

describe("CNIC", () => {
  it("normalises with or without dashes", () => {
    expect(normalizeCnic("3520212345671")).toBe("35202-1234567-1");
    expect(normalizeCnic("35202-1234567-1")).toBe("35202-1234567-1");
    expect(normalizeCnic("35202-123456-1")).toBeNull();
  });
  it("checks region code and gender digit", () => {
    expect(hasValidRegionCode("35202-1234567-1")).toBe(true);
    expect(hasValidRegionCode("95202-1234567-1")).toBe(false);
    expect(genderFromCnic("35202-1234567-1")).toBe("M");
    expect(genderFromCnic("35202-1234567-2")).toBe("F");
  });
});

describe("name matching", () => {
  it("normalises honorifics, case and accents", () => {
    expect(normalizeName("Syed  Muḥammad Ali-Khan")).toBe("MUHAMMAD ALI KHAN");
  });
  it("is order-independent and tolerant of transliteration", () => {
    expect(nameSimilarity("Muhammad Ali Khan", "Khan Muhammad Ali")).toBeGreaterThan(0.95);
    expect(nameSimilarity("Mohammed Ali", "Muhammad Ali")).toBeGreaterThan(0.8);
    expect(nameSimilarity("Ayesha Siddiqui", "Bilal Ahmed")).toBeLessThan(0.5);
  });
});

const NOW = new Date("2026-09-30T12:00:00Z");

function submission(overrides: Partial<IdentitySubmission["document"]> = {}): IdentitySubmission {
  return {
    userId: "u1",
    accountName: "Ahmed Khan",
    document: {
      type: "CNIC",
      number: "35202-1234567-1",
      numberIndex: "x",
      issuingCountry: "PK",
      fullNameOnDoc: "Ahmed Khan",
      dateOfBirth: new Date("1990-01-01T00:00:00Z"),
      gender: "M",
      expiryDate: new Date("2031-01-01T00:00:00Z"),
      ...overrides,
    },
    images: [
      { role: "front", sha256: "a", liveCapture: true, fileId: "f1" },
      { role: "back", sha256: "b", liveCapture: true, fileId: "f2" },
      { role: "selfie", sha256: "c", liveCapture: true, fileId: "f3" },
      { role: "selfie", sha256: "d", liveCapture: true, fileId: "f4" },
      { role: "selfie", sha256: "e", liveCapture: true, fileId: "f5" },
    ],
    liveness: { prompts: ["a", "b", "c"], issuedAt: NOW.getTime() - 120_000, submittedAt: NOW.getTime() },
    aml: { result: "CLEAR", hits: [] },
  };
}

const clean = { documentUsedByOthers: false, imageReusedByOthers: false };
const status = (checks: ReturnType<typeof runIdentityChecks>, id: string) => checks.find((c) => c.id === id)?.status;

describe("identity checks", () => {
  it("passes a clean CNIC submission, leaving face match to an officer", () => {
    const checks = runIdentityChecks(submission(), clean, NOW);
    expect(checks.filter((c) => c.status === "FAIL")).toEqual([]);
    expect(status(checks, "liveness.review")).toBe("MANUAL");
    expect(status(checks, "gov.nadra")).toBe("MANUAL");
    expect(riskFrom(checks)).toBe("LOW");
  });

  it("fails expired documents and minors", () => {
    const checks = runIdentityChecks(submission({ expiryDate: new Date("2025-01-01"), dateOfBirth: new Date("2012-05-05") }), clean, NOW);
    expect(status(checks, "doc.expiry")).toBe("FAIL");
    expect(status(checks, "doc.age")).toBe("FAIL");
    expect(riskFrom(checks)).toBe("HIGH");
  });

  it("flags duplicates and a mismatched name", () => {
    const checks = runIdentityChecks(submission({ fullNameOnDoc: "Zainab Farooq" }), { documentUsedByOthers: true, imageReusedByOthers: true }, NOW);
    expect(status(checks, "dup.document")).toBe("FAIL");
    expect(status(checks, "dup.images")).toBe("FAIL");
    expect(status(checks, "doc.name")).toBe("FAIL");
  });

  it("warns on a CNIC gender digit mismatch and uploaded images", () => {
    const s = submission({ gender: "F" });
    s.images[0].liveCapture = false;
    const checks = runIdentityChecks(s, clean, NOW);
    expect(status(checks, "doc.gender")).toBe("WARN");
    expect(status(checks, "capture.live")).toBe("WARN");
  });

  it("fails a stale liveness challenge", () => {
    const s = submission();
    s.liveness.issuedAt = NOW.getTime() - 60 * 60 * 1000;
    expect(status(runIdentityChecks(s, clean, NOW), "liveness.challenge")).toBe("FAIL");
  });

  it("validates passports against the MRZ", () => {
    const passport = submission({
      type: "PASSPORT",
      number: "L898902C3",
      issuingCountry: "SE",
      fullNameOnDoc: "Anna Maria Eriksson",
      dateOfBirth: new Date("1974-08-12T00:00:00Z"),
      expiryDate: new Date("2012-04-15T00:00:00Z"),
      gender: "F",
      mrz: SPECIMEN,
    });
    passport.accountName = "Anna Eriksson";
    const checks = runIdentityChecks(passport, clean, new Date("2010-01-01T00:00:00Z"));
    expect(status(checks, "doc.mrz")).toBe("PASS");
    expect(status(checks, "doc.mrz_match")).toBe("PASS");

    const wrongNumber = { ...passport, document: { ...passport.document, number: "X1234567" } };
    expect(status(runIdentityChecks(wrongNumber, clean, new Date("2010-01-01T00:00:00Z")), "doc.mrz_match")).toBe("FAIL");
  });

  it("computes age correctly around birthdays", () => {
    expect(ageOn(new Date("2008-10-01T00:00:00Z"), NOW)).toBe(17);
    expect(ageOn(new Date("2008-09-30T00:00:00Z"), NOW)).toBe(18);
  });
});
