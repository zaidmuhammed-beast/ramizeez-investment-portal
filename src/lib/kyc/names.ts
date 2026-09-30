// Name normalisation and fuzzy matching for document ↔ profile and watchlist checks.

const HONORIFICS = new Set(["MR", "MRS", "MS", "MISS", "DR", "SYED", "SYEDA", "HAJI", "HAFIZ", "MIAN", "CH", "CHAUDHRY"]);

export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !HONORIFICS.has(t))
    .join(" ");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Similarity in [0, 1]. Token-order independent (Muhammad Ali Khan ≈ Khan Muhammad Ali)
 * and tolerant of common transliteration differences (Mohammed / Muhammad).
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = normalizeName(a).split(" ").filter(Boolean);
  const tb = normalizeName(b).split(" ").filter(Boolean);
  if (!ta.length || !tb.length) return 0;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const used = new Set<number>();
  let total = 0;
  for (const t of short) {
    let best = 0;
    let bestIdx = -1;
    long.forEach((u, idx) => {
      if (used.has(idx)) return;
      const s = 1 - levenshtein(t, u) / Math.max(t.length, u.length);
      if (s > best) {
        best = s;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0) used.add(bestIdx);
    total += best;
  }
  // Penalise unmatched extra tokens lightly (middle names are often omitted).
  return (total / short.length) * (0.85 + 0.15 * (short.length / long.length));
}
