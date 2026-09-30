import "server-only";
import { db } from "../db";
import { seal, unseal } from "../keys";
import { generateTotpSecret } from "./totp";

/** Returns the user's pending/active TOTP secret, creating one on first use. */
export async function ensureTotpSecret(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { totpSecretEnc: true } });
  if (user.totpSecretEnc) return unseal(user.totpSecretEnc);
  const secret = generateTotpSecret();
  await db.user.update({ where: { id: userId }, data: { totpSecretEnc: seal(secret) } });
  return secret;
}
