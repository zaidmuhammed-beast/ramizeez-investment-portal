// Browser-only helpers that keep uploads small: serverless hosts (e.g. Netlify Functions)
// reject request bodies over about 6 MB, and phone photos are often 4–8 MB each.

/** Re-encodes a large photo as a JPEG no wider or taller than `max` pixels. Other files pass through. */
export async function shrinkImage(blob: Blob, max = 1600, quality = 0.85): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(blob.type)) return blob;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return blob; // not decodable here: let the server's own checks decide
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && blob.size < 900_000) {
    bitmap.close();
    return blob;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return out && out.size < blob.size ? out : blob;
}

/** The most one form submission should carry, leaving headroom under the host's request limit. */
export const MAX_SUBMISSION_BYTES = 4.5 * 1024 * 1024;

export const totalFileBytes = (fd: FormData) => [...fd.values()].reduce((n, v) => n + (v instanceof File ? v.size : 0), 0);

export const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
