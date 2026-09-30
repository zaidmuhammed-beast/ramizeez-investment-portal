import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { requestMeta } from "./request";

export async function audit(
  action: string,
  opts: {
    actorId?: string | null;
    targetType?: string;
    targetId?: string;
    metadata?: Prisma.InputJsonValue;
  } = {},
) {
  const { ip, userAgent } = await requestMeta();
  await db.auditLog.create({
    data: {
      action,
      actorId: opts.actorId ?? null,
      targetType: opts.targetType,
      targetId: opts.targetId,
      metadata: opts.metadata,
      ip,
      userAgent,
    },
  });
}
