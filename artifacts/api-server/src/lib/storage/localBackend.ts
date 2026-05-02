import { createReadStream, existsSync } from "fs";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import path from "path";
import type { Readable } from "stream";
import {
  ObjectNotFoundError,
  type StorageBackend,
  type StorageObjectFile,
} from "./types";

const UPLOAD_TTL_SEC = 900;

function getLocalStorageDir(): string {
  const dir = process.env.LOCAL_STORAGE_DIR || "";
  if (!dir) {
    throw new Error(
      "LOCAL_STORAGE_DIR not set. Set it to a writable absolute path (e.g. /var/lib/dgenergy/storage).",
    );
  }
  return dir;
}

function getPublicBaseUrl(): string {
  const base = process.env.PUBLIC_BASE_URL || "";
  if (!base) {
    throw new Error(
      "PUBLIC_BASE_URL not set. Set it to your public site origin (e.g. https://erp.dynamicgreenenergy.in).",
    );
  }
  return base.replace(/\/+$/, "");
}

function getUploadSecret(): string {
  const secret = process.env.LOCAL_STORAGE_UPLOAD_SECRET || "";
  if (!secret || secret.length < 16) {
    throw new Error(
      "LOCAL_STORAGE_UPLOAD_SECRET not set or too short. Set a random string of at least 16 chars.",
    );
  }
  return secret;
}

function getPublicSearchDirs(): Array<string> {
  const raw = process.env.LOCAL_STORAGE_PUBLIC_DIRS || "";
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function uploadsDir(): string {
  return path.join(getLocalStorageDir(), "uploads");
}

function fileForObjectId(objectId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(objectId)) {
    throw new ObjectNotFoundError();
  }
  return path.join(uploadsDir(), objectId);
}

function metaForObjectId(objectId: string): string {
  return `${fileForObjectId(objectId)}.meta.json`;
}

export function signUploadToken(objectId: string, expiresAt: number): string {
  const secret = getUploadSecret();
  return createHmac("sha256", secret)
    .update(`${objectId}|${expiresAt}`)
    .digest("base64url");
}

export function verifyUploadToken(
  objectId: string,
  expiresAt: number,
  token: string,
): boolean {
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const expected = signUploadToken(objectId, expiresAt);
  if (expected.length !== token.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

export async function writeUploadedObject(
  objectId: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const filePath = fileForObjectId(objectId);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
  const meta = { contentType, size: body.length };
  await writeFile(metaForObjectId(objectId), JSON.stringify(meta));
}

async function readMeta(
  objectId: string,
): Promise<{ contentType: string; size?: number } | null> {
  try {
    const raw = await readFile(metaForObjectId(objectId), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function streamToStorageObjectFile(
  filePath: string,
  contentType: string,
  size: number,
  isPublic: boolean,
): StorageObjectFile {
  return {
    contentType,
    size,
    cacheControl: `${isPublic ? "public" : "private"}, max-age=3600`,
    body: createReadStream(filePath) as unknown as Readable,
  };
}

export class LocalStorageBackend implements StorageBackend {
  async generateUploadURL(): Promise<{ uploadURL: string; objectId: string }> {
    const objectId = randomUUID();
    const expires = Date.now() + UPLOAD_TTL_SEC * 1000;
    const sig = signUploadToken(objectId, expires);
    const base = getPublicBaseUrl();
    const uploadURL = `${base}/api/storage/uploads/local/${objectId}?expires=${expires}&sig=${sig}`;
    return { uploadURL, objectId };
  }

  uploadURLToObjectPath(uploadURL: string): string {
    try {
      const url = new URL(uploadURL);
      const m = url.pathname.match(/\/api\/storage\/uploads\/local\/([^/?]+)/);
      if (m) return `/objects/${m[1]}`;
    } catch {
      // not an absolute URL; fall through
    }
    return uploadURL;
  }

  async getObjectFile(objectId: string): Promise<StorageObjectFile> {
    const filePath = fileForObjectId(objectId);
    if (!existsSync(filePath)) {
      throw new ObjectNotFoundError();
    }
    const meta = await readMeta(objectId);
    const st = await stat(filePath);
    return streamToStorageObjectFile(
      filePath,
      meta?.contentType || "application/octet-stream",
      st.size,
      false,
    );
  }

  async searchPublicObjectFile(filePath: string): Promise<StorageObjectFile | null> {
    if (filePath.includes("..")) return null;
    const dirs = getPublicSearchDirs();
    for (const dir of dirs) {
      const full = path.join(dir, filePath);
      if (!full.startsWith(path.resolve(dir))) continue;
      if (existsSync(full)) {
        const st = await stat(full);
        if (!st.isFile()) continue;
        return streamToStorageObjectFile(
          full,
          guessContentType(full),
          st.size,
          true,
        );
      }
    }
    return null;
  }
}

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}
