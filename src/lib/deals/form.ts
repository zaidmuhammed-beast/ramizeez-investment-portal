// Parses offer forms (used by investors and founders). Pure.
import type { OfferTerms } from "./offers";

const n = (v: FormDataEntryValue | null) => {
  if (v === null || String(v).trim() === "") return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? x : NaN;
};

export function parseOfferForm(fd: FormData) {
  const terms: OfferTerms = {
    equityPercent: n(fd.get("equityPercent")),
    valuation: n(fd.get("valuation")),
    profitSharePercent: n(fd.get("profitSharePercent")),
    revenueSharePercent: n(fd.get("revenueSharePercent")),
    returnCapMultiple: n(fd.get("returnCapMultiple")),
    termMonths: n(fd.get("termMonths")),
  };
  const text = (k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max) || null;
  return { amount: n(fd.get("amount")) ?? NaN, terms, conditions: text("conditions", 2000), note: text("note", 1000) };
}
