import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { matchPitch, regionsOf, type InvestorPrefs, type MatchablePitch } from "@/lib/investor/matching";
import { pitchRef, revenueBand, stripContactDetails, visibleAt } from "@/lib/investor/disclosure";
import { activityFlags, summaryQuota } from "@/lib/investor/activity";
import { watermarkImage, watermarkPdf, watermarkSafe } from "@/lib/investor/watermark";

const investor: InvestorPrefs = {
  currency: "USD",
  verifiedBudget: 200_000,
  ticketMin: 10_000,
  ticketMax: 75_000,
  sectors: ["Food & beverage"],
  stages: ["IDEA", "EARLY"],
  dealTypes: ["EQUITY", "MUSHARAKAH"],
  geographies: ["Pakistan"],
  shariahOnly: false,
};
const pitch: MatchablePitch = { founderId: "founder", currency: "PKR", minTicket: 100_000, sector: "Food & beverage", type: "IDEA", dealType: "MUSHARAKAH", country: "PK" };

describe("matching", () => {
  it("matches on budget, deal type and preferences", () => {
    const m = matchPitch("inv", investor, pitch);
    expect(m).toMatchObject({ eligible: true, preferred: true, fit: 100 });
  });
  it("compares the minimum ticket with the verified budget across currencies", () => {
    // USD 200k ≈ PKR 56M, so a PKR 60M minimum ticket is out of budget.
    expect(matchPitch("inv", investor, { ...pitch, minTicket: 60_000_000 }).eligible).toBe(false);
    expect(matchPitch("inv", { ...investor, verifiedBudget: null }, pitch).eligible).toBe(false);
  });
  it("applies hard rules: deal type, Shariah-only, own pitch", () => {
    expect(matchPitch("inv", investor, { ...pitch, dealType: "REVENUE_SHARE" }).eligible).toBe(false);
    expect(matchPitch("inv", { ...investor, shariahOnly: true, dealTypes: ["EQUITY"] }, { ...pitch, dealType: "EQUITY" }).eligible).toBe(false);
    expect(matchPitch("founder", investor, pitch).reasons).toContain("Your own pitch");
  });
  it("treats sector, stage and region as soft preferences", () => {
    const m = matchPitch("inv", { ...investor, stages: ["IDEA"] }, { ...pitch, sector: "Fintech", country: "AE", type: "EXISTING" });
    expect(m.eligible).toBe(true);
    expect(m.preferred).toBe(false);
    expect(m.fit).toBe(40); // deal type + ticket fit only
  });
  it("maps countries to preference regions", () => {
    expect(regionsOf("PK")).toEqual(["Global", "Pakistan"]);
    expect(regionsOf("AE")).toContain("GCC");
    expect(regionsOf("GB")).toContain("United Kingdom");
    expect(regionsOf("DE")).toContain("Europe");
    expect(regionsOf("CA")).toContain("North America");
    expect(regionsOf("MY")).toContain("Asia-Pacific");
  });
});

describe("disclosure", () => {
  it("hides confidential fields until the full data room", () => {
    expect(visibleAt("SUMMARY", "pricing", ["pricing"])).toBe(false);
    expect(visibleAt("SUMMARY", "solution", ["pricing"])).toBe(true);
    expect(visibleAt("FULL", "pricing", ["pricing"])).toBe(true);
    expect(visibleAt("TEASER", "solution", [])).toBe(false);
  });
  it("shows revenue as a band and uses an anonymous reference", () => {
    expect(revenueBand(null, "PKR")).toBeNull();
    expect(revenueBand(5_000_000, "PKR")).toBe("PKR 1–10M a year");
    expect(revenueBand(200_000, "USD")).toBe("Over PKR 50M a year");
    expect(pitchRef("cmabcdef123456")).toBe("RZ-123456");
  });
  it("strips contact details from messages", () => {
    const out = stripContactDetails("Call me on +92 300 1234567 or ahmed@example.com, see www.mysite.pk or example.com/deck, DM @ahmed_k. Budget PKR 500,000.");
    expect(out).not.toMatch(/300|ahmed@|mysite|example\.com|@ahmed_k/);
    expect(out).toContain("Budget PKR 500,000.");
  });
});

describe("activity", () => {
  it("sets quotas by tier", () => {
    expect([summaryQuota(2), summaryQuota(3), summaryQuota(4)]).toEqual([0, 5, 10]);
  });
  it("flags investors who unlock many summaries without expressing interest", () => {
    const unlocks = Array.from({ length: 8 }, (_, i) => ({ sector: i < 4 ? "Fintech" : "Education" }));
    expect(activityFlags({ unlocks, requests: 0 })).toHaveLength(3);
    expect(activityFlags({ unlocks, requests: 1 })).toEqual([]);
    expect(activityFlags({ unlocks: unlocks.slice(0, 3), requests: 0 })).toEqual([]);
  });
});

describe("watermarking", () => {
  it("keeps names printable in standard PDF fonts", () => {
    expect(watermarkSafe("Zoë Ahmed — ۱۲")).toBe("Zoe Ahmed ? ??");
  });
  it("stamps every page of a PDF", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    doc.addPage([800, 600]);
    const original = await doc.save();
    const stamped = await watermarkPdf(original, "Ahmed Khan · ABC123 · RZ-123456");
    const reloaded = await PDFDocument.load(stamped);
    expect(reloaded.getPageCount()).toBe(2);
    expect(stamped.length).toBeGreaterThan(original.length);
    // The viewer's identity is in the page content (hex-encoded text, possibly compressed).
    const hex = Buffer.from("Ahmed Khan ? ABC123 ? RZ-123456").toString("hex").toUpperCase();
    const raw = Buffer.from(stamped).toString("latin1");
    const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)].map((m) => {
      try {
        return inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
      } catch {
        return m[1];
      }
    });
    expect([raw, ...streams].some((t) => t.toUpperCase().includes(hex))).toBe(true);
  });
  it("wraps images in a watermarked PDF page", async () => {
    // 1×1 transparent PNG.
    const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));
    const pdf = await watermarkImage(png, "image/png", "Viewer");
    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  });
});
