// Per-viewer watermarking for data-room documents. Every page carries the viewer's name,
// investor ID and the time, so a leaked copy can be traced back to them.
import { PDFDocument, StandardFonts, degrees, rgb, type PDFPage, type PDFFont } from "pdf-lib";

/** pdf-lib's standard fonts only encode WinAnsi; replace anything else so names never break stamping. */
export const watermarkSafe = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\x20-\x7E]/g, "?");

function stamp(page: PDFPage, font: PDFFont, text: string) {
  const { width, height } = page.getSize();
  const size = Math.max(10, Math.min(width, height) / 28);
  const textWidth = font.widthOfTextAtSize(text, size);
  // Diagonal tiles across the page.
  for (let y = -height; y < height * 2; y += size * 9) {
    for (let x = -width; x < width * 2; x += textWidth + size * 6) {
      page.drawText(text, { x, y, size, font, color: rgb(0.55, 0.1, 0.1), opacity: 0.12, rotate: degrees(30) });
    }
  }
  // A clear footer line as well.
  page.drawText(text, { x: 18, y: 12, size: 7, font, color: rgb(0.5, 0.1, 0.1), opacity: 0.8 });
}

/** Stamps every page of a PDF. */
export async function watermarkPdf(pdf: Uint8Array, text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const safe = watermarkSafe(text);
  for (const page of doc.getPages()) stamp(page, font, safe);
  doc.setProducer("RamiZeeZ data room");
  return doc.save();
}

/** Wraps a JPEG or PNG in a single-page, watermarked PDF. */
export async function watermarkImage(image: Uint8Array, mimeType: "image/jpeg" | "image/png", text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const img = mimeType === "image/png" ? await doc.embedPng(image) : await doc.embedJpg(image);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const page = doc.addPage([img.width * scale, img.height * scale]);
  page.drawImage(img, { x: 0, y: 0, width: img.width * scale, height: img.height * scale });
  stamp(page, await doc.embedFont(StandardFonts.HelveticaBold), watermarkSafe(text));
  return doc.save();
}
