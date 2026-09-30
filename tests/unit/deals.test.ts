import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { amountBlocker, describeTerms, pickTerms, termErrors, turnOf, type CapacityInput } from "@/lib/deals/offers";
import { approvalBlocker, balance, depositedFor, entryBlocker, evaluateRound, feeFor, releaseAmount, releasedFor, type Entry, type RoundInput } from "@/lib/deals/escrow";
import { renderDocumentPdf } from "@/lib/deals/pdf";
import { agreementText, termSheetText, type DocContext } from "@/config/agreements";

describe("offer terms", () => {
  it("requires each structure's own terms", () => {
    expect(termErrors("MUSHARAKAH", {})).toEqual({ profitSharePercent: "Required", termMonths: "Required" });
    expect(termErrors("MUSHARAKAH", { profitSharePercent: 40, termMonths: 36 })).toEqual({});
    expect(termErrors("EQUITY", { equityPercent: 10, valuation: 5_000_000 })).toEqual({});
    expect(termErrors("REVENUE_SHARE", { revenueSharePercent: 8, returnCapMultiple: 1.5, termMonths: 48 })).toEqual({});
  });

  it("enforces ranges and whole months", () => {
    expect(termErrors("EQUITY", { equityPercent: 70, valuation: 1 }).equityPercent).toMatch(/Between/);
    expect(termErrors("REVENUE_SHARE", { revenueSharePercent: 60, returnCapMultiple: 6, termMonths: 3 })).toEqual({
      revenueSharePercent: "Between 0.01 and 50",
      returnCapMultiple: "Between 1 and 5",
      termMonths: "Between 6 and 240",
    });
    expect(termErrors("MUDARABAH", { profitSharePercent: 50, termMonths: 12.5 }).termMonths).toBe("Whole months");
    expect(termErrors("MUDARABAH", { profitSharePercent: NaN, termMonths: 12 }).profitSharePercent).toBe("Required");
  });

  it("drops terms that don't belong to the structure", () => {
    expect(pickTerms("MUSHARAKAH", { profitSharePercent: 40, termMonths: 36, equityPercent: 20 })).toEqual({ profitSharePercent: 40, termMonths: 36 });
  });

  it("describes terms in plain words", () => {
    expect(describeTerms("MUSHARAKAH", { profitSharePercent: 40, termMonths: 36 }, "PKR")).toMatch(/40% of profit.*36 months.*losses shared/);
    expect(describeTerms("REVENUE_SHARE", { revenueSharePercent: 8, returnCapMultiple: 1.5, termMonths: 48 }, "PKR")).toMatch(/8% of revenue until 1.5×/);
  });

  it("knows whose turn it is", () => {
    expect(turnOf("AWAITING_FOUNDER")).toBe("FOUNDER");
    expect(turnOf("AWAITING_INVESTOR")).toBe("INVESTOR");
    expect(turnOf("ACCEPTED")).toBeNull();
    expect(turnOf("WITHDRAWN")).toBeNull();
  });
});

describe("offer amounts", () => {
  const base: CapacityInput = {
    amount: 1_000_000,
    currency: "PKR",
    minTicket: 500_000,
    raiseTarget: 5_000_000,
    multipleInvestors: true,
    acceptedElsewhere: 0,
    investorBudgetPkr: 10_000_000,
    investorCommittedPkr: 0,
  };

  it("accepts a valid amount", () => expect(amountBlocker(base)).toBeNull());
  it("applies the platform minimum in any currency", () => {
    expect(amountBlocker({ ...base, amount: 90_000, minTicket: 0 })).toMatch(/platform minimum/);
    expect(amountBlocker({ ...base, currency: "USD", amount: 300, minTicket: 0, raiseTarget: 20_000 })).toMatch(/platform minimum/);
    expect(amountBlocker({ ...base, currency: "USD", amount: 400, minTicket: 0, raiseTarget: 20_000 })).toBeNull();
  });
  it("applies the pitch's minimum ticket", () => expect(amountBlocker({ ...base, amount: 400_000 })).toMatch(/minimum investment for this pitch/));
  it("caps offers at the round's remaining capacity", () => {
    expect(amountBlocker({ ...base, amount: 2_000_000, acceptedElsewhere: 4_000_000 })).toMatch(/Only .*1,000,000/);
    expect(amountBlocker({ ...base, acceptedElsewhere: 5_000_000 })).toBe("The round is fully committed");
  });
  it("requires the full amount from a single investor", () => {
    expect(amountBlocker({ ...base, multipleInvestors: false })).toMatch(/single investor/);
    expect(amountBlocker({ ...base, multipleInvestors: false, amount: 5_000_000 })).toBeNull();
  });
  it("respects the investor's verified budget across rounds", () => {
    expect(amountBlocker({ ...base, investorBudgetPkr: 3_000_000, investorCommittedPkr: 2_500_000 })).toMatch(/verified budget/);
  });
});

describe("escrow ledger", () => {
  const entries: Entry[] = [
    { type: "DEPOSIT", status: "POSTED", amount: 3_000_000, offerId: "a" },
    { type: "DEPOSIT", status: "POSTED", amount: 2_000_000, offerId: "b" },
    { type: "DEPOSIT", status: "PENDING", amount: 999, offerId: "b" },
    { type: "DEPOSIT", status: "REJECTED", amount: 777, offerId: "a" },
    { type: "FEE", status: "POSTED", amount: 500_000 },
    { type: "RELEASE", status: "POSTED", amount: 1_000_000, milestoneId: "m1" },
    { type: "RELEASE", status: "PENDING", amount: 1_000_000, milestoneId: "m2" },
  ];

  it("counts only posted entries", () => {
    expect(balance(entries)).toBe(3_500_000);
    expect(depositedFor(entries, "a")).toBe(3_000_000);
    expect(depositedFor(entries, "b")).toBe(2_000_000);
    expect(releasedFor(entries, "m1")).toBe(1_000_000);
    expect(releasedFor(entries, "m2")).toBe(0);
  });

  it("charges the 10% success fee and scales releases to the amount raised", () => {
    expect(feeFor(5_000_000)).toBe(500_000);
    expect(feeFor(1234.56)).toBe(123.46);
    expect(releaseAmount(1_000_000, 5_000_000, 5_000_000)).toBe(1_000_000);
    expect(releaseAmount(1_000_000, 3_000_000, 5_000_000)).toBe(600_000);
  });

  it("enforces maker-checker", () => {
    const pending = { type: "DEPOSIT" as const, status: "PENDING" as const, amount: 1, offerId: "a", recordedById: "finance-1" };
    expect(approvalBlocker(pending, "finance-1")).toMatch(/different team member/);
    expect(approvalBlocker(pending, "finance-2")).toBeNull();
    expect(approvalBlocker({ ...pending, recordedById: null }, "finance-1")).toBeNull(); // system entries (the fee)
    expect(approvalBlocker({ ...pending, status: "POSTED" }, "finance-2")).toMatch(/already been decided/);
  });

  it("validates new entries", () => {
    const ctx = { balance: 1_000_000, dealStatus: "FUNDED", claimApproved: true, alreadyReleased: 0, releaseCap: 600_000 };
    expect(entryBlocker({ type: "DEPOSIT", status: "PENDING", amount: 0, offerId: "a" }, ctx)).toBe("Enter an amount");
    expect(entryBlocker({ type: "DEPOSIT", status: "PENDING", amount: 10 }, ctx)).toMatch(/investor's offer/);
    expect(entryBlocker({ type: "DEPOSIT", status: "PENDING", amount: 5_000_000, offerId: "a" }, ctx)).toBeNull();
    expect(entryBlocker({ type: "RELEASE", status: "PENDING", amount: 100, milestoneId: "m1" }, { ...ctx, dealStatus: "COMMITTED" })).toMatch(/once the round is funded/);
    expect(entryBlocker({ type: "RELEASE", status: "PENDING", amount: 100 }, ctx)).toBe("Choose the milestone");
    expect(entryBlocker({ type: "RELEASE", status: "PENDING", amount: 100, milestoneId: "m1" }, { ...ctx, claimApproved: false })).toMatch(/evidence must be approved/);
    expect(entryBlocker({ type: "RELEASE", status: "PENDING", amount: 700_000, milestoneId: "m1" }, ctx)).toMatch(/milestone's budget/);
    expect(entryBlocker({ type: "RELEASE", status: "PENDING", amount: 600_000, milestoneId: "m1" }, ctx)).toBeNull();
    expect(entryBlocker({ type: "REFUND", status: "PENDING", amount: 2_000_000, offerId: "a" }, ctx)).toBe("Not enough money in escrow");
  });
});

describe("round status", () => {
  const round: RoundInput = {
    cancelled: false,
    target: 5_000_000,
    closedEarly: false,
    accepted: [{ offerId: "a", amount: 3_000_000, agreementSigned: true }],
    entries: [],
    milestones: [
      { id: "m1", budget: 2_000_000 },
      { id: "m2", budget: 3_000_000 },
    ],
  };
  const deposit = (offerId: string, amount: number): Entry => ({ type: "DEPOSIT", status: "POSTED", amount, offerId });
  const release = (milestoneId: string, amount: number): Entry => ({ type: "RELEASE", status: "POSTED", amount, milestoneId });

  it("stays open until fully committed", () => expect(evaluateRound(round)).toEqual({ status: "OPEN", committed: 3_000_000, fundedTotal: 0 }));

  it("is committed until every agreement is signed and every deposit posted", () => {
    const full = { ...round, accepted: [...round.accepted, { offerId: "b", amount: 2_000_000, agreementSigned: false }] };
    expect(evaluateRound(full).status).toBe("COMMITTED");
    expect(evaluateRound({ ...full, entries: [deposit("a", 3_000_000), deposit("b", 2_000_000)] }).status).toBe("COMMITTED");
    const signed = { ...full, accepted: full.accepted.map((o) => ({ ...o, agreementSigned: true })) };
    expect(evaluateRound({ ...signed, entries: [deposit("a", 3_000_000), deposit("b", 1_999_000)] }).status).toBe("COMMITTED");
    expect(evaluateRound({ ...signed, entries: [deposit("a", 3_000_000), deposit("b", 2_000_000)] })).toEqual({ status: "FUNDED", committed: 5_000_000, fundedTotal: 5_000_000 });
  });

  it("can close early below target, scaling milestone releases", () => {
    const early = { ...round, closedEarly: true, entries: [deposit("a", 3_000_000)] };
    expect(evaluateRound(early)).toEqual({ status: "FUNDED", committed: 3_000_000, fundedTotal: 3_000_000 });
    // 60% raised: releases of 1.2M and 1.8M complete the milestones.
    expect(evaluateRound({ ...early, entries: [...early.entries, release("m1", 1_200_000)] }).status).toBe("FUNDED");
    expect(evaluateRound({ ...early, entries: [...early.entries, release("m1", 1_200_000), release("m2", 1_800_000)] }).status).toBe("COMPLETED");
  });

  it("reports cancelled rounds", () => expect(evaluateRound({ ...round, cancelled: true }).status).toBe("CANCELLED"));
});

describe("deal documents", () => {
  const ctx: DocContext = {
    ref: "RZ-ABC123",
    businessTitle: "Karachi Cold Chain",
    founderName: "Ayesha Khan",
    investorName: "Omar Siddiqui",
    amount: 2_500_000,
    currency: "PKR",
    dealType: "MUSHARAKAH",
    terms: { profitSharePercent: 40, termMonths: 36 },
    conditions: "Monthly management accounts",
    milestones: [{ month: 3, title: "First refrigerated van", budget: 1_000_000 }],
    date: "2026-09-30",
  };

  it("writes structure-specific terms and the platform terms", () => {
    const sheet = termSheetText(ctx);
    expect(sheet).toContain("Karachi Cold Chain");
    expect(sheet).toContain("Monthly management accounts");
    const agreement = agreementText(ctx);
    expect(agreement).toMatch(/Musharakah/);
    expect(agreement).toMatch(/40% to the Investor and 60% to the Founder/);
    expect(agreement).toMatch(/10%/);
    expect(agreement).toMatch(/25%/);
    expect(agreement).toContain("First refrigerated van");
    expect(agreementText({ ...ctx, dealType: "EQUITY", terms: { equityPercent: 10, valuation: 20_000_000 } })).not.toMatch(/Musharakah partnership/);
  });

  it("renders a multi-page PDF with the signature log", async () => {
    const bytes = await renderDocumentPdf({
      title: "Investment agreement",
      body: agreementText(ctx).repeat(4),
      bodyHash: "a".repeat(64),
      status: "SIGNED",
      signatures: [{ party: "INVESTOR", typedName: "Omar Siddiqui", signedAt: new Date("2026-09-30T10:00:00Z"), ip: "203.0.113.5", bodyHash: "a".repeat(64) }],
      footer: "RZ-ABC123",
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
});
