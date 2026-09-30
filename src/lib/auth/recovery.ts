import "server-only";
import { randomBytes } from "node:crypto";
import { hashSecret, verifySecret } from "./password";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function code(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export async function generateRecoveryCodes(count = 10) {
  const plain = Array.from({ length: count }, code);
  const hashed = await Promise.all(plain.map(hashSecret));
  return { plain, hashed };
}

export const normalizeRecoveryCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{4})(.{4})$/, "$1-$2");

/** Returns the remaining hashes if the code matched, or null. */
export async function consumeRecoveryCode(hashes: string[], input: string): Promise<string[] | null> {
  const candidate = normalizeRecoveryCode(input);
  for (let i = 0; i < hashes.length; i++) {
    if (await verifySecret(hashes[i], candidate)) return hashes.filter((_, j) => j !== i);
  }
  return null;
}
