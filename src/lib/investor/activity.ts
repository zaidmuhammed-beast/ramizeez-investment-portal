// Investor activity rules: monthly unlock quotas and misuse flags. Pure and unit-tested.
import { INVESTOR_LIMITS } from "@/config/platform";

export const WINDOW_DAYS = 30;
export const windowStart = (now = new Date()) => new Date(now.getTime() - WINDOW_DAYS * 86_400_000);

export const summaryQuota = (tier: number) => (tier >= 4 ? INVESTOR_LIMITS.summaryUnlocks.tier4 : tier >= 3 ? INVESTOR_LIMITS.summaryUnlocks.tier3 : 0);

export type Activity = {
  /** NDAs signed in the window, with the sector of each pitch. */
  unlocks: { sector: string | null }[];
  /** Access requests (any status) in the window. */
  requests: number;
};

/** Reasons to review an investor, or an empty list. */
export function activityFlags(a: Activity): string[] {
  const flags: string[] = [];
  if (a.unlocks.length >= INVESTOR_LIMITS.flagUnlocksWithoutInterest && a.requests === 0) {
    flags.push(`Unlocked ${a.unlocks.length} summaries in ${WINDOW_DAYS} days without expressing interest in any`);
  }
  const bySector = new Map<string, number>();
  for (const u of a.unlocks) if (u.sector) bySector.set(u.sector, (bySector.get(u.sector) ?? 0) + 1);
  for (const [sector, count] of bySector) {
    if (count >= 4 && a.requests === 0) flags.push(`Unlocked ${count} ${sector} summaries without expressing interest`);
  }
  return flags;
}
