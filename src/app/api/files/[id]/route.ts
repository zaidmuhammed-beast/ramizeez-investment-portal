import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { readStoredFile } from "@/lib/storage";

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session || session.stage !== "ACTIVE" || session.user.status !== "ACTIVE") return new Response("Unauthorized", { status: 401 });
  const file = await db.storedFile.findUnique({ where: { id } });
  if (!file) return notFound();

  const isOwner = file.ownerId === session.userId;
  const isPitchFile = file.kind === "PITCH_DECK" || file.kind === "PITCH_IMAGE" || file.kind === "PITCH_DOCUMENT";
  // KYC officers see KYC documents; pitch reviewers see only pitch material.
  const isReviewer = isPitchFile
    ? can(session.user, "pitches.view")
    : file.kind === "MILESTONE_EVIDENCE" || file.kind === "INVESTOR_REPORT"
      ? can(session.user, "deals.view")
      : can(session.user, "kyc.files.view");
  if (!isOwner && !isReviewer) return notFound();
  if (!isOwner) {
    await audit("file.viewed", { actorId: session.userId, targetType: "StoredFile", targetId: file.id, metadata: { ownerId: file.ownerId, kind: file.kind } });
  }

  const body = await readStoredFile(file);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(body.length),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Sandbox images; Chrome's PDF viewer refuses to render inside a sandboxed document.
      ...(file.mimeType.startsWith("image/") ? { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" } : {}),
    },
  });
}
