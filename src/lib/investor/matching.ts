// Which listed pitches an investor may see, and how well they fit. Pure and unit-tested.
import { countries } from "countries-list";
import { toPkr } from "@/config/platform";

export const SHARIAH_DEAL_TYPES = ["MUSHARAKAH", "MUDARABAH"] as const;

const GCC = new Set(["AE", "SA", "QA", "KW", "OM", "BH"]);
const NORTH_AMERICA = new Set(["US", "CA", "MX"]);

/** Maps a country to the investor preference regions it belongs to. */
export function regionsOf(countryCode: string | null): string[] {
  if (!countryCode) return [];
  const out = ["Global"];
  const continent = (countries as Record<string, { continent: string }>)[countryCode]?.continent;
  if (countryCode === "PK") out.push("Pakistan");
  else if (GCC.has(countryCode)) out.push("GCC");
  else if (countryCode === "GB") out.push("United Kingdom");
  else if (NORTH_AMERICA.has(countryCode)) out.push("North America");
  else if (continent === "EU") out.push("Europe");
  else if (continent === "AF") out.push("Africa");
  else if (continent === "AS" || continent === "OC") out.push("Asia-Pacific");
  return out;
}

/** Investor stage preferences that an idea / operating business satisfies. */
const STAGES_FOR = { IDEA: ["IDEA"], EXISTING: ["EARLY", "GROWTH", "ESTABLISHED"] } as const;

export type InvestorPrefs = {
  currency: string;
  verifiedBudget: number | null;
  ticketMin: number;
  ticketMax: number;
  sectors: string[];
  stages: string[];
  dealTypes: string[];
  geographies: string[];
  shariahOnly: boolean;
};

export type MatchablePitch = {
  founderId: string;
  currency: string;
  minTicket: number | null;
  sector: string | null;
  type: "IDEA" | "EXISTING";
  dealType: string | null;
  country: string | null;
};

export type Match = {
  /** Hard rules: budget, accepted deal type, Shariah requirement, not your own pitch. */
  eligible: boolean;
  /** Soft preferences: sector, stage and region. */
  preferred: boolean;
  fit: number; // 0–100
  reasons: string[];
};

export function matchPitch(investorId: string, inv: InvestorPrefs, p: MatchablePitch): Match {
  const reasons: string[] = [];
  const budgetPkr = inv.verifiedBudget !== null ? toPkr(inv.verifiedBudget, inv.currency) : 0;
  const minTicketPkr = p.minTicket !== null ? toPkr(p.minTicket, p.currency) : Infinity;

  const withinBudget = minTicketPkr <= budgetPkr;
  const dealOk = !!p.dealType && inv.dealTypes.includes(p.dealType);
  const shariahOk = !inv.shariahOnly || (SHARIAH_DEAL_TYPES as readonly string[]).includes(p.dealType ?? "");
  const notOwn = p.founderId !== investorId;
  if (!withinBudget) reasons.push("Minimum investment is above your verified budget");
  if (!dealOk) reasons.push("Deal structure is not one you accept");
  if (!shariahOk) reasons.push("Not a Shariah-compliant structure");
  if (!notOwn) reasons.push("Your own pitch");

  const sectorOk = !!p.sector && inv.sectors.includes(p.sector);
  const stageOk = STAGES_FOR[p.type].some((s) => inv.stages.includes(s));
  const regionOk = regionsOf(p.country).some((r) => inv.geographies.includes(r));
  const ticketFits = minTicketPkr <= toPkr(inv.ticketMax, inv.currency);

  const fit = (sectorOk ? 30 : 0) + (dealOk ? 25 : 0) + (stageOk ? 15 : 0) + (regionOk ? 15 : 0) + (ticketFits ? 15 : 0);
  return { eligible: withinBudget && dealOk && shariahOk && notOwn, preferred: sectorOk && stageOk && regionOk, fit, reasons };
}
