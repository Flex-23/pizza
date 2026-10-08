import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/lib/env";

/**
 * Image storage behind a tiny adapter interface.
 *
 * The default "local" driver writes into ./public/uploads. Swapping to S3,
 * Supabase Storage or anything else means adding a driver here and flipping
 * STORAGE_DRIVER in .env.local — no calling code changes.
 */

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: "TOO_LARGE" | "WRONG_TYPE" | "FAILED" };

export interface StorageDriver {
  upload(file: File): Promise<UploadResult>;
  remove(url: string): Promise<void>;
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const PUBLIC_PREFIX = "/uploads/";

/**
 * Everything both drivers must agree on before a byte is stored: the declared
 * type is one we serve, the size is within the limit, the bytes really are that
 * kind of image, and the name is ours rather than the browser's.
 */
type AcceptedUpload =
  | { ok: true; buffer: Buffer; filename: string }
  | { ok: false; error: "TOO_LARGE" | "WRONG_TYPE" | "FAILED" };

async function acceptUpload(file: File): Promise<AcceptedUpload> {
  if (
    !ALLOWED_IMAGE_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
    )
  ) {
    return { ok: false, error: "WRONG_TYPE" };
  }

  if (file.size > env.MAX_UPLOAD_MB * 1024 * 1024) {
    return { ok: false, error: "TOO_LARGE" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!isRealImage(buffer, file.type)) {
    return { ok: false, error: "WRONG_TYPE" };
  }

  // Random name: never trust the client-supplied filename for a path.
  const extension = EXTENSION_BY_TYPE[file.type] ?? ".jpg";
  const filename = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}${extension}`;

  return { ok: true, buffer, filename };
}

const localDriver: StorageDriver = {
  async upload(file) {
    const accepted = await acceptUpload(file);
    if (!accepted.ok) return accepted;

    try {
      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(
        path.join(UPLOAD_DIR, accepted.filename),
        accepted.buffer,
      );

      return { ok: true, url: `${PUBLIC_PREFIX}${accepted.filename}` };
    } catch {
      return { ok: false, error: "FAILED" };
    }
  },

  async remove(url) {
    if (!url.startsWith(PUBLIC_PREFIX)) return;

    const filename = path.basename(url);
    const target = path.join(UPLOAD_DIR, filename);

    // Refuse anything that resolves outside the uploads folder.
    if (!target.startsWith(UPLOAD_DIR)) return;

    try {
      await unlink(target);
    } catch {
      // Already gone — nothing to do.
    }
  },
};

/**
 * Magic-number check, so a renamed .exe cannot be stored just because the
 * browser claimed a friendly MIME type.
 */
function isRealImage(buffer: Buffer, declaredType: string): boolean {
  if (buffer.length < 12) return false;

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const riff = buffer.toString("ascii", 0, 4) === "RIFF";
  const isWebp = riff && buffer.toString("ascii", 8, 12) === "WEBP";
  const isAvif = buffer.toString("ascii", 4, 8) === "ftyp";

  switch (declaredType) {
    case "image/jpeg":
      return isJpeg;
    case "image/png":
      return isPng;
    case "image/webp":
      return isWebp;
    case "image/avif":
      return isAvif;
    default:
      return false;
  }
}

/**
 * Supabase Storage, for hosts whose filesystem does not survive a deploy.
 *
 * Spoken to over its REST API rather than through `@supabase/supabase-js`: two
 * requests do not justify the dependency, and this keeps the service-role key
 * confined to this file.
 *
 * The bucket must be created as **public** — the images are menu photos shown
 * to every visitor, and a public bucket is what lets `next/image` fetch them
 * without a signed URL per request.
 */
/**
 * Supabase puts an API gateway in front of Storage which wants the key in
 * `apikey`, while Storage itself reads `Authorization`. Sending both is what
 * makes the request work through either path.
 */
function supabaseAuthHeaders() {
  return {
    Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    apikey: env.SUPABASE_SECRET_KEY,
  };
}

const supabaseDriver: StorageDriver = {
  async upload(file) {
    const accepted = await acceptUpload(file);
    if (!accepted.ok) return accepted;

    const base = env.SUPABASE_URL.replace(/\/+$/, "");
    const objectPath = `${env.SUPABASE_STORAGE_BUCKET}/${accepted.filename}`;

    try {
      const response = await fetch(`${base}/storage/v1/object/${objectPath}`, {
        method: "POST",
        headers: {
          ...supabaseAuthHeaders(),
          "Content-Type": file.type,
          // The name is generated here and cannot already exist; refusing to
          // overwrite turns a collision into an error rather than data loss.
          "x-upsert": "false",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
        body: new Uint8Array(accepted.buffer),
      });

      if (!response.ok) {
        console.error(
          `[storage] Supabase upload failed (${response.status}): ${await response.text()}`,
        );
        return { ok: false, error: "FAILED" };
      }

      return {
        ok: true,
        url: `${base}/storage/v1/object/public/${objectPath}`,
      };
    } catch (error) {
      console.error("[storage] Supabase upload failed:", error);
      return { ok: false, error: "FAILED" };
    }
  },

  async remove(url) {
    const base = env.SUPABASE_URL.replace(/\/+$/, "");
    const prefix = `${base}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/`;

    // Only ever delete something this driver stored: an image left over from
    // the local driver, or any other URL, must not be turned into a delete
    // against the bucket.
    if (!url.startsWith(prefix)) return;

    const objectName = url.slice(prefix.length);
    if (!objectName || objectName.includes("/")) return;

    try {
      await fetch(
        `${base}/storage/v1/object/${env.SUPABASE_STORAGE_BUCKET}/${objectName}`,
        {
          method: "DELETE",
          headers: supabaseAuthHeaders(),
        },
      );
    } catch {
      // A leftover image costs storage, not correctness — never fail the edit
      // the admin was actually making.
    }
  },
};

const drivers: Record<string, StorageDriver> = {
  local: localDriver,
  supabase: supabaseDriver,
};

export function getStorage(): StorageDriver {
  return drivers[env.STORAGE_DRIVER] ?? localDriver;
}
