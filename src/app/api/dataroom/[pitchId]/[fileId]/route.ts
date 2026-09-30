import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSession } from "@/lib/auth/session";
import { pitchAccess, logView } from "@/lib/investor/access";
import { pitchRef } from "@/lib/investor/disclosure";
import { watermarkImage, watermarkPdf } from "@/lib/investor/watermark";
import { readStoredFile } from "@/lib/storage";

const deny = (status = 404) => new Response(status === 401 ? "Unauthorized" : "Not found", { status });

/** Serves a data-room document as a per-viewer watermarked PDF, only to approved investors. */
export async function GET(_req: Request, ctx: RouteContext<"/api/dataroom/[pitchId]/[fileId]">) {
  const { pitchId, fileId } = await ctx.params;
  const session = await getSession();
  if (!session || session.stage !== "ACTIVE" || session.user.status !== "ACTIVE") return deny(401);

  const access = await pitchAccess(session.user, pitchId);
  if (!access.pitch || access.level !== "FULL") return deny();
  const p = access.pitch;
  if (fileId !== p.deckFileId && !p.imageFileIds.includes(fileId) && !p.documentFileIds.includes(fileId)) return deny();
  const file = await db.storedFile.findUnique({ where: { id: fileId } });
  if (!file) return deny();

  const u = session.user;
  const stamp = `${u.firstName} ${u.lastName} · ${u.id} · ${pitchRef(pitchId)} · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · CONFIDENTIAL`;
  const raw = new Uint8Array(await readStoredFile(file));
  let body: Uint8Array;
  if (file.mimeType === "application/pdf") body = await watermarkPdf(raw, stamp);
  else if (file.mimeType === "image/jpeg" || file.mimeType === "image/png") body = await watermarkImage(raw, file.mimeType, stamp);
  else return new Response("This file type can't be shown in the data room.", { status: 415 });

  await logView(u.id, pitchId, "FILE", fileId);
  await audit("dataroom.file.viewed", { actorId: u.id, targetType: "StoredFile", targetId: fileId, metadata: { pitchId } });
  const name = (file.originalName ?? "document").replace(/\.[a-z0-9]+$/i, "").replace(/[^\w.-]+/g, "_").slice(0, 80);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pitchRef(pitchId)}-${name}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
