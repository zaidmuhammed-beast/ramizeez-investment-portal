import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { renderDocumentPdf } from "@/lib/deals/pdf";
import { BRAND } from "@/config/brand";

/** A term sheet or agreement as a PDF with its signature log, for its parties and the deals team. */
export async function GET(_req: Request, ctx: RouteContext<"/api/deals/documents/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session || session.stage !== "ACTIVE" || session.user.status !== "ACTIVE") return new Response("Unauthorized", { status: 401 });
  const doc = await db.dealDocument.findUnique({
    where: { id },
    include: { signatures: { orderBy: { signedAt: "asc" } }, offer: { include: { pitch: { select: { founderId: true } } } } },
  });
  const u = session.user;
  const allowed = doc && (doc.offer.investorId === u.id || doc.offer.pitch.founderId === u.id || can(u, "deals.view"));
  if (!doc || !allowed) return new Response("Not found", { status: 404 });

  const pdf = await renderDocumentPdf({
    title: doc.title,
    body: doc.body,
    bodyHash: doc.bodyHash,
    status: doc.status,
    signatures: doc.signatures.map((s) => ({ party: s.party, typedName: s.typedName, signedAt: s.signedAt, ip: s.ip, bodyHash: s.bodyHash })),
    footer: `${BRAND.name} · ${doc.title} · downloaded by ${u.firstName} ${u.lastName} ${new Date().toISOString().slice(0, 10)}`,
  });
  await audit("document.downloaded", { actorId: u.id, targetType: "DealDocument", targetId: doc.id });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.kind.toLowerCase()}-${doc.id.slice(-6)}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
