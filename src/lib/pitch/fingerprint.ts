import { createHash } from "node:crypto";
import type { PitchData } from "./data";

/** JSON with object keys sorted at every level, so equal content always serialises identically. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

// Workflow and bookkeeping fields are not part of what the founder authored.
const NON_CONTENT = ["id", "founderId", "status", "savedSections", "teaser", "screeningScore", "assignedToId", "submittedAt", "listedAt", "createdAt", "updatedAt"] as const;

/** The authored content of a pitch plus the SHA-256 of each attached file. */
export function submissionSnapshot(p: PitchData, fileHashes: Record<string, string>) {
  const content: Record<string, unknown> = { ...p };
  for (const k of NON_CONTENT) delete content[k];
  return { content, files: fileHashes };
}

export const fingerprint = (snapshot: unknown) => createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
