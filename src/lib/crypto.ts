import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// AES-256-GCM. Serialized as base64(iv[12] | tag[16] | ciphertext).
const IV_LEN = 12;
const TAG_LEN = 16;

export function encryptBuffer(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

export function decryptBuffer(blob: Buffer, key: Buffer): Buffer {
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = blob.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export function encryptString(plain: string, key: Buffer): string {
  return encryptBuffer(Buffer.from(plain, "utf8"), key).toString("base64");
}

export function decryptString(blob: string, key: Buffer): string {
  return decryptBuffer(Buffer.from(blob, "base64"), key).toString("utf8");
}

/** Deterministic keyed hash, so equal values can be found without storing them in clear. */
export function blindIndex(value: string, key: Buffer): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
