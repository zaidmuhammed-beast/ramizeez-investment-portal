import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStore } from "@netlify/blobs";
import type { FileKind, StoredFile } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { dataKey } from "./keys";
import { decryptBuffer, encryptBuffer, randomToken, sha256Hex } from "./crypto";

export const maxFileBytes = () => env().MAX_UPLOAD_MB * 1024 * 1024;

/** Encrypted file bodies. Files are encrypted before they reach either backend. */
const backend = {
  async put(key: string, body: Buffer) {
    if (env().STORAGE_DRIVER === "netlify-blobs") {
      await getStore({ name: "uploads", consistency: "strong" }).set(key, new Uint8Array(body).buffer);
      return;
    }
    const dir = path.resolve(env().STORAGE_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, key), body, { mode: 0o600 });
  },
  async get(key: string): Promise<Buffer> {
    if (env().STORAGE_DRIVER === "netlify-blobs") {
      const data = await getStore({ name: "uploads", consistency: "strong" }).get(key, { type: "arrayBuffer" });
      if (!data) throw new Error(`Stored file ${key} is missing`);
      return Buffer.from(data);
    }
    return readFile(path.join(path.resolve(env().STORAGE_DIR), key));
  },
};

// Detect the real type from magic bytes — the browser-supplied MIME type is not trusted.
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}

export class FileRejected extends Error {}

export async function saveFile(opts: {
  ownerId: string;
  kind: FileKind;
  file: File;
  liveCapture?: boolean;
  allow: ("image" | "pdf")[];
  /** Optional narrower list of accepted types, e.g. only JPEG/PNG. */
  mimes?: string[];
}): Promise<StoredFile> {
  const { file } = opts;
  if (file.size === 0) throw new FileRejected("The file is empty");
  if (file.size > maxFileBytes()) throw new FileRejected(`Files must be ${env().MAX_UPLOAD_MB} MB or smaller`);
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  const okImage = opts.allow.includes("image") && mime?.startsWith("image/");
  const okPdf = opts.allow.includes("pdf") && mime === "application/pdf";
  if (!mime || !(okImage || okPdf)) {
    throw new FileRejected(opts.allow.includes("pdf") ? "Upload a JPG, PNG, WebP or PDF file" : "Upload a JPG, PNG or WebP image");
  }
  if (opts.mimes && !opts.mimes.includes(mime)) {
    throw new FileRejected(`This file type isn't accepted here. Use ${opts.mimes.map((m) => m.split("/")[1].toUpperCase()).join(", ")}.`);
  }

  const storageKey = randomToken(24);
  await backend.put(storageKey, encryptBuffer(buf, dataKey()));

  return db.storedFile.create({
    data: {
      ownerId: opts.ownerId,
      kind: opts.kind,
      originalName: file.name?.slice(0, 200) || null,
      mimeType: mime,
      size: buf.length,
      sha256: sha256Hex(buf),
      storageKey,
      liveCapture: opts.liveCapture ?? false,
    },
  });
}

export async function readStoredFile(file: StoredFile): Promise<Buffer> {
  return decryptBuffer(await backend.get(file.storageKey), dataKey());
}
