import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { pitchRef } from "@/lib/investor/disclosure";
import { watermarkImage, watermarkPdf } from "@/lib/investor/watermark";
import { readStoredFile } from "@/lib/storage";

const deny = (status = 404) => new Response(status === 401 ? "Unauthorized" : "Not found", { status });

/** A monthly report attachment: for the round's investors (published reports, watermarked), its founder and the team. */
export async function GET(_req: Request, ctx: RouteContext<"/api/reports/[reportId]/files/[fileId]">) {
  const { reportId, fileId } = await ctx.params;
  const session = await getSession();
  if (!session || session.stage !== "ACTIVE" || session.user.status !== "ACTIVE") return deny(401);
  const report = await db.investorReport.findUnique({ where: { id: reportId }, include: { deal: { include: { pitch: { select: { founderId: true } } } } } });
  if (!report || !report.fileIds.includes(fileId)) return deny();
  const u = session.user;
  const founder = report.deal.pitch.founderId === u.id;
  const team = can(u, "deals.view");
  const investor = report.status === "PUBLISHED" && !!(await db.offer.findFirst({ where: { pitchId: report.deal.pitchId, investorId: u.id, status: "ACCEPTED" }, select: { id: true } }));
  if (!founder && !team && !investor) return deny();
  const file = await db.storedFile.findUnique({ where: { id: fileId } });
  if (!file) return deny();

  const raw = new Uint8Array(await readStoredFile(file));
  let body: Uint8Array = raw;
  let type = file.mimeType;
  if (investor && !founder && !team) {
    const stamp = `${u.firstName} ${u.lastName} · ${u.id} · ${pitchRef(report.deal.pitchId)} ${report.period} · ${new Date().toISOString().slice(0, 10)} · CONFIDENTIAL`;
    if (file.mimeType === "application/pdf") body = await watermarkPdf(raw, stamp);
    else if (file.mimeType === "image/jpeg" || file.mimeType === "image/png") body = await watermarkImage(raw, file.mimeType, stamp);
    else return new Response("This file type can't be shown.", { status: 415 });
    type = "application/pdf";
  }
  if (!founder) await audit("report.file.viewed", { actorId: u.id, targetType: "StoredFile", targetId: fileId, metadata: { reportId } });
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": type, "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
