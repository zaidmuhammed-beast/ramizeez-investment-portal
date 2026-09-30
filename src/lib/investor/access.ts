import "server-only";
import type { InvestorProfile, ViewLevel } from "@prisma/client";
import { db } from "../db";
import { requestMeta } from "../request";
import type { CurrentUser } from "../auth/session";
import { recomputeTier } from "../onboarding";
import { matchPitch, type InvestorPrefs, type Match } from "./matching";
import { windowStart, summaryQuota } from "./activity";
import type { Level } from "./disclosure";
import { INVESTOR_LIMITS } from "@/config/platform";

export function prefsOf(inv: InvestorProfile): InvestorPrefs {
  return {
    currency: inv.currency,
    verifiedBudget: inv.verifiedBudget === null ? null : Number(inv.verifiedBudget),
    ticketMin: Number(inv.ticketMin),
    ticketMax: Number(inv.ticketMax),
    sectors: inv.sectors,
    stages: inv.stages,
    dealTypes: inv.dealTypes,
    geographies: inv.geographies,
    shariahOnly: inv.shariahOnly,
  };
}

const matchable = (p: { founderId: string; currency: string; minTicket: unknown; sector: string | null; type: "IDEA" | "EXISTING"; dealType: string | null; country: string | null }) => ({
  founderId: p.founderId,
  currency: p.currency,
  minTicket: p.minTicket === null ? null : Number(p.minTicket),
  sector: p.sector,
  type: p.type,
  dealType: p.dealType,
  country: p.country,
});

/** The investor side of the current user, or null if they can't use the portal yet. */
export async function investorContext(user: CurrentUser) {
  if (!user.roles.includes("INVESTOR")) return null;
  const [tier, profile] = await Promise.all([recomputeTier(user.id), db.investorProfile.findUnique({ where: { userId: user.id } })]);
  const ready = tier >= 3 && !!profile && profile.verifiedBudget !== null;
  return { tier, profile, prefs: profile ? prefsOf(profile) : null, ready };
}

export async function quotaUsage(investorId: string, tier: number) {
  const since = windowStart();
  const [unlocks, requests] = await Promise.all([
    db.ndaSignature.count({ where: { investorId, signedAt: { gte: since } } }),
    db.accessRequest.count({ where: { investorId, createdAt: { gte: since } } }),
  ]);
  return {
    unlocks,
    unlockLimit: summaryQuota(tier),
    requests,
    requestLimit: tier >= 4 ? INVESTOR_LIMITS.fullAccessRequests : 0,
  };
}

/**
 * Resolves what an investor may see of one pitch. Access already granted (a signed NDA or an
 * approved request) survives later budget changes, but ends if the pitch is no longer listed.
 */
export async function pitchAccess(user: CurrentUser, pitchId: string) {
  const ctx = await investorContext(user);
  const pitch = await db.pitch.findFirst({
    where: { id: pitchId, status: "LISTED" },
    include: {
      costItems: true,
      milestones: true,
      ndaSignatures: { where: { investorId: user.id } },
      accessRequests: { where: { investorId: user.id } },
      watchers: { where: { investorId: user.id } },
      deal: { select: { status: true } },
    },
  });
  if (!ctx || !ctx.ready || !ctx.prefs || !pitch) return { ctx, pitch: null, level: "NONE" as Level, match: null };
  // Once a round stops collecting commitments, only investors who already unlocked it keep access.
  const roundOpen = !pitch.deal || pitch.deal.status === "OPEN";
  const match = matchPitch(user.id, ctx.prefs, matchable(pitch));
  const nda = pitch.ndaSignatures[0] ?? null;
  const request = pitch.accessRequests[0] ?? null;
  let level: Level = "NONE";
  if (request?.status === "APPROVED" && ctx.tier >= 4) level = "FULL";
  else if (nda) level = "SUMMARY";
  else if (match.eligible && roundOpen) level = "TEASER";
  return { ctx, pitch, level, match, nda, request, watching: pitch.watchers.length > 0 };
}

/** Records a view. Page views are de-duplicated for 30 minutes; file opens are always logged. */
export async function logView(investorId: string, pitchId: string, level: ViewLevel, fileId?: string) {
  if (level !== "FILE") {
    const recent = await db.pitchViewLog.findFirst({
      where: { investorId, pitchId, level, createdAt: { gte: new Date(Date.now() - 30 * 60_000) } },
      select: { id: true },
    });
    if (recent) return;
  }
  const { ip } = await requestMeta();
  await db.pitchViewLog.create({ data: { investorId, pitchId, level, fileId, ip } });
}

export type Opportunity = Awaited<ReturnType<typeof listOpportunities>>[number];

/** Listed pitches the investor may see, best fit first. `all` widens past sector/stage/region preferences. */
export async function listOpportunities(user: CurrentUser, prefs: InvestorPrefs, all: boolean) {
  const pitches = await db.pitch.findMany({
    where: { status: "LISTED" },
    orderBy: { listedAt: "desc" },
    include: {
      ndaSignatures: { where: { investorId: user.id }, select: { id: true } },
      accessRequests: { where: { investorId: user.id }, select: { status: true } },
      watchers: { where: { investorId: user.id }, select: { pitchId: true } },
      deal: { select: { status: true } },
    },
  });
  return pitches
    .map((p) => ({ pitch: p, match: matchPitch(user.id, prefs, matchable(p)) as Match }))
    .filter(({ pitch, match }) => (match.eligible && (all || match.preferred) && (!pitch.deal || pitch.deal.status === "OPEN")) || pitch.ndaSignatures.length > 0)
    .sort((a, b) => b.match.fit - a.match.fit || (b.pitch.screeningScore ?? 0) - (a.pitch.screeningScore ?? 0));
}
