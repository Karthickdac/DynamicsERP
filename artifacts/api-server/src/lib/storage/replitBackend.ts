import { Storage, File } from "@google-cloud/storage";
import { randomUUID } from "crypto";
import type { Readable } from "stream";
import {
  ObjectNotFoundError,
  type StorageBackend,
  type StorageObjectFile,
} from "./types";
import { getObjectAclPolicy } from "../objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  return {
    bucketName: pathParts[1],
    objectName: pathParts.slice(2).join("/"),
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }
  const { signed_url: signedURL } = (await response.json()) as { signed_url: string };
  return signedURL;
}

function getPublicObjectSearchPaths(): Array<string> {
  const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
  const paths = Array.from(
    new Set(
      pathsStr
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    )
  );
  if (paths.length === 0) {
    throw new Error(
      "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
        "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
    );
  }
  return paths;
}

function getPrivateObjectDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) {
    throw new Error(
      "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
        "tool and set PRIVATE_OBJECT_DIR env var."
    );
  }
  return dir;
}

async function fileToStorageObjectFile(file: File): Promise<StorageObjectFile> {
  const [metadata] = await file.getMetadata();
  const aclPolicy = await getObjectAclPolicy(file);
  const isPublic = aclPolicy?.visibility === "public";

  return {
    contentType: (metadata.contentType as string) || "application/octet-stream",
    size: metadata.size != null ? Number(metadata.size) : undefined,
    cacheControl: `${isPublic ? "public" : "private"}, max-age=3600`,
    body: file.createReadStream() as unknown as Readable,
  };
}

export class ReplitStorageBackend implements StorageBackend {
  async generateUploadURL(): Promise<{ uploadURL: string; objectId: string }> {
    const privateObjectDir = getPrivateObjectDir();
    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const uploadURL = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
    return { uploadURL, objectId };
  }

  uploadURLToObjectPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) objectEntityDir = `${objectEntityDir}/`;

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async getObjectFile(objectId: string): Promise<StorageObjectFile> {
    let entityDir = getPrivateObjectDir();
    if (!entityDir.endsWith("/")) entityDir = `${entityDir}/`;

    const objectEntityPath = `${entityDir}${objectId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return fileToStorageObjectFile(objectFile);
  }

  async searchPublicObjectFile(filePath: string): Promise<StorageObjectFile | null> {
    for (const searchPath of getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (exists) {
        return fileToStorageObjectFile(file);
      }
    }
    return null;
  }
}
