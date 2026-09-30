import "server-only";
import { db } from "../db";
import { nameSimilarity, normalizeName } from "./names";

const MATCH_THRESHOLD = 0.86;
export const RESCREEN_DAYS = 30;

export type AmlHit = { entryId: string; name: string; listSource: string; score: number; dobMatch: boolean };

/**
 * Screens a person against the in-house watchlist (sanctions, proscribed persons, PEPs
 * and internal blacklist entries loaded by the compliance team).
 */
export async function screenPerson(userId: string, fullName: string, dateOfBirth?: Date) {
  const entries = await db.watchlistEntry.findMany();
  const hits: AmlHit[] = [];
  for (const e of entries) {
    const score = Math.max(nameSimilarity(fullName, e.fullName), ...e.aliases.map((a) => nameSimilarity(fullName, a)));
    const dobMatch = !!(dateOfBirth && e.dateOfBirth && e.dateOfBirth.toISOString().slice(0, 10) === dateOfBirth.toISOString().slice(0, 10));
    if (score >= MATCH_THRESHOLD || (dobMatch && score >= 0.7)) {
      hits.push({ entryId: e.id, name: e.fullName, listSource: e.listSource, score: Math.round(score * 100) / 100, dobMatch });
    }
  }
  return db.amlScreening.create({
    data: {
      userId,
      result: hits.length ? "POTENTIAL_MATCH" : "CLEAR",
      hits,
      screenedName: normalizeName(fullName),
      nextScreeningAt: new Date(Date.now() + RESCREEN_DAYS * 86_400_000),
    },
  });
}
