import "server-only";
import { db } from "../db";
import type { KycProvider } from "./provider";
import { runIdentityChecks } from "./checks";

/** Built-in provider for testing: rule-based checks, with liveness and face match left to an officer. */
export const internalProvider: KycProvider = {
  name: "internal",
  async checkIdentity(input) {
    const [docElsewhere, imageElsewhere] = await Promise.all([
      db.identityDocument.count({
        where: { numberIndex: input.document.numberIndex, userId: { not: input.userId } },
      }),
      db.storedFile.count({
        where: { sha256: { in: input.images.map((i) => i.sha256) }, ownerId: { not: input.userId } },
      }),
    ]);
    return runIdentityChecks(input, {
      documentUsedByOthers: docElsewhere > 0,
      imageReusedByOthers: imageElsewhere > 0,
    });
  },
};
