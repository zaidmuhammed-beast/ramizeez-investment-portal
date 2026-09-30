import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { createHash } from "node:crypto";
import { env } from "../env";

// OWASP-recommended argon2id parameters.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashSecret = (plain: string) => hash(plain, OPTIONS);

export async function verifySecret(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

/** A real hash to verify against when the user does not exist, so timing doesn't reveal it. */
let dummyHash: Promise<string> | undefined;
export const getDummyHash = () => (dummyHash ??= hashSecret("dummy-password-for-timing"));

/**
 * Checks the Have I Been Pwned range API using k-anonymity: only the first 5 characters
 * of the SHA-1 hash leave the server. Fails open if the service is unreachable.
 */
export async function isBreachedPassword(password: string): Promise<boolean> {
  if (!env().HIBP_CHECK) return false;
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [s, count] = line.trim().split(":");
      return s === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}
