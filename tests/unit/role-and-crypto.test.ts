import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { blindIndex, decryptString, encryptString } from "@/lib/crypto";
import { founderChecks, investorChecks, riskScore, type FounderCheckInput, type InvestorCheckInput, type RiskAnswers } from "@/lib/kyc/role-checks";
import { MIN_AMOUNT_PKR, PLATFORM_TERMS, feeBreakdown, meetsMinimum, minimumIn } from "@/config/platform";

describe("field encryption", () => {
  const key = randomBytes(32);
  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptString("35202-1234567-1", key);
    const b = encryptString("35202-1234567-1", key);
    expect(a).not.toBe(b);
    expect(decryptString(a, key)).toBe("35202-1234567-1");
  });
  it("rejects tampered ciphertext", () => {
    const blob = Buffer.from(encryptString("secret", key), "base64");
    blob[blob.length - 1] ^= 1;
    expect(() => decryptString(blob.toString("base64"), key)).toThrow();
  });
  it("produces stable blind indexes per key", () => {
    expect(blindIndex("x", key)).toBe(blindIndex("x", key));
    expect(blindIndex("x", key)).not.toBe(blindIndex("x", randomBytes(32)));
  });
});

const risk: RiskAnswers = { understandsLoss: true, understandsIlliquidity: true, horizon: "GT5", portion: "LT10", reaction: "HOLD" };

describe("investor checks", () => {
  const base: InvestorCheckInput = {
    investorType: "INDIVIDUAL",
    declaredBudget: 5_000_000,
    ticketMin: 500_000,
    ticketMax: 2_000_000,
    currency: "PKR",
    sourceOfFunds: ["SALARY"],
    proofOfFundsCount: 1,
    entityDocumentCount: 0,
    risk,
  };
  const status = (id: string, input = base) => investorChecks(input).find((c) => c.id === id)?.status;

  it("scores suitability", () => {
    expect(riskScore(risk)).toBe(8);
    expect(riskScore({ ...risk, horizon: "LT1", portion: "GT50", reaction: "EXIT" })).toBe(0);
  });

  it("passes a complete individual investor and leaves budget verification to an officer", () => {
    const checks = investorChecks(base);
    expect(checks.filter((c) => c.status === "FAIL")).toEqual([]);
    expect(status("inv.budget_verify")).toBe("MANUAL");
  });

  it("fails inconsistent tickets and missing proof of funds", () => {
    expect(status("inv.tickets", { ...base, ticketMax: 9_000_000 })).toBe("FAIL");
    expect(status("inv.pof", { ...base, proofOfFundsCount: 0 })).toBe("FAIL");
  });

  it("requires entity documents and beneficial-owner review for companies", () => {
    const company = { ...base, investorType: "COMPANY" };
    expect(status("inv.entity", company)).toBe("FAIL");
    expect(status("inv.ubo", company)).toBe("MANUAL");
    expect(status("inv.entity", { ...company, entityName: "Acme", entityRegNumber: "123", entityDocumentCount: 1 })).toBe("PASS");
  });

  it("enforces the PKR 100,000 minimum in any currency", () => {
    expect(status("inv.minimum", { ...base, ticketMin: 99_999 })).toBe("FAIL");
    expect(status("inv.minimum", { ...base, ticketMin: 100_000 })).toBe("PASS");
    const usd = { ...base, currency: "USD", declaredBudget: 50_000, ticketMin: minimumIn("USD"), ticketMax: 10_000 };
    expect(status("inv.minimum", usd)).toBe("PASS");
    expect(status("inv.minimum", { ...usd, ticketMin: minimumIn("USD") - 1 })).toBe("FAIL");
  });
});

describe("founder checks", () => {
  const status = (input: FounderCheckInput, id: string) => founderChecks(input).find((c) => c.id === id)?.status;
  const terms = { platformTermsVersion: PLATFORM_TERMS.version };

  it("requires registration for existing businesses only", () => {
    expect(status({ ...terms, stage: "IDEA", documentCount: 0 }, "fdr.registration")).toBe("PASS");
    expect(status({ ...terms, stage: "EXISTING", documentCount: 0 }, "fdr.registration")).toBe("FAIL");
    expect(status({ ...terms, stage: "EXISTING", businessName: "Chai Co", registrationNumber: "0123", documentCount: 2 }, "fdr.registration")).toBe("PASS");
  });

  it("requires acceptance of the current platform terms", () => {
    expect(status({ ...terms, stage: "IDEA", documentCount: 0 }, "fdr.terms")).toBe("PASS");
    expect(status({ stage: "IDEA", documentCount: 0 }, "fdr.terms")).toBe("FAIL");
    expect(status({ platformTermsVersion: "2020-01", stage: "IDEA", documentCount: 0 }, "fdr.terms")).toBe("FAIL");
  });
});

describe("platform terms", () => {
  it("applies the 10% success fee and records the 25% business share", () => {
    expect(PLATFORM_TERMS.successFeePercent).toBe(10);
    expect(PLATFORM_TERMS.businessSharePercent).toBe(25);
    expect(feeBreakdown(1_000_000)).toEqual({ raise: 1_000_000, fee: 100_000, netToBusiness: 900_000, businessSharePercent: 25 });
  });

  it("converts the minimum for foreign currencies", () => {
    expect(MIN_AMOUNT_PKR).toBe(100_000);
    expect(meetsMinimum(100_000, "PKR")).toBe(true);
    expect(meetsMinimum(minimumIn("GBP"), "GBP")).toBe(true);
    expect(meetsMinimum(minimumIn("GBP") - 1, "GBP")).toBe(false);
  });
});
