// Renders a deal document and its signature log as a PDF.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { watermarkSafe } from "@/lib/investor/watermark";

const PAGE: [number, number] = [595, 842]; // A4
const MARGIN = 56;

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

export type SignatureRow = { party: string; typedName: string; signedAt: Date; ip: string | null; bodyHash: string };

export async function renderDocumentPdf(opts: { title: string; body: string; bodyHash: string; status: string; signatures: SignatureRow[]; footer: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = PAGE[0] - MARGIN * 2;
  let page = doc.addPage(PAGE);
  let y = PAGE[1] - MARGIN;
  const newPageIfNeeded = (h: number) => {
    if (y - h < MARGIN + 20) {
      page = doc.addPage(PAGE);
      y = PAGE[1] - MARGIN;
    }
  };
  const write = (text: string, f: PDFFont, size: number, gap = 4, color = rgb(0.1, 0.1, 0.15)) => {
    for (const line of wrap(watermarkSafe(text), f, size, width)) {
      newPageIfNeeded(size + gap);
      page.drawText(line, { x: MARGIN, y, size, font: f, color });
      y -= size + gap;
    }
  };

  write(opts.title, bold, 14, 8);
  if (opts.status !== "SIGNED") write("NOT YET FULLY SIGNED", bold, 9, 10, rgb(0.7, 0.2, 0.1));
  y -= 6;
  for (const para of opts.body.split("\n\n")) {
    write(para, font, 9.5, 3.5);
    y -= 6;
  }
  y -= 10;
  write("SIGNATURES", bold, 11, 6);
  for (const s of opts.signatures) {
    write(`${s.party}: ${s.typedName}, signed electronically ${s.signedAt.toISOString().replace("T", " ").slice(0, 19)} UTC from ${s.ip ?? "unknown IP"}`, font, 9, 3);
  }
  y -= 8;
  write(`Document fingerprint (SHA-256): ${opts.bodyHash}`, font, 7.5, 3, rgb(0.4, 0.4, 0.45));

  for (const [i, p] of doc.getPages().entries()) {
    p.drawText(watermarkSafe(`${opts.footer} · page ${i + 1} of ${doc.getPageCount()}`), { x: MARGIN, y: 24, size: 7, font, color: rgb(0.45, 0.45, 0.5) });
  }
  doc.setTitle(watermarkSafe(opts.title));
  return doc.save();
}
