import { Readable } from "stream";
import {
  ObjectNotFoundError,
  type StorageBackend,
  type StorageObjectFile,
} from "./types";
import { ReplitStorageBackend } from "./replitBackend";
import { LocalStorageBackend } from "./localBackend";

export { ObjectNotFoundError };
export type { StorageObjectFile };

let cachedBackend: StorageBackend | null = null;

export function getStorageBackend(): StorageBackend {
  if (cachedBackend) return cachedBackend;
  const kind = (process.env.STORAGE_BACKEND || "replit").toLowerCase();
  switch (kind) {
    case "local":
      cachedBackend = new LocalStorageBackend();
      break;
    case "replit":
      cachedBackend = new ReplitStorageBackend();
      break;
    default:
      throw new Error(
        `Unknown STORAGE_BACKEND: "${kind}". Use "replit" or "local".`,
      );
  }
  return cachedBackend;
}

export class ObjectStorageService {
  private readonly backend: StorageBackend;

  constructor(backend?: StorageBackend) {
    this.backend = backend ?? getStorageBackend();
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const { uploadURL } = await this.backend.generateUploadURL();
    return uploadURL;
  }

  normalizeObjectEntityPath(uploadURL: string): string {
    return this.backend.uploadURLToObjectPath(uploadURL);
  }

  async getObjectEntityFile(objectPath: string): Promise<StorageObjectFile> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const objectId = objectPath.slice("/objects/".length);
    if (!objectId) {
      throw new ObjectNotFoundError();
    }
    return this.backend.getObjectFile(objectId);
  }

  async searchPublicObject(filePath: string): Promise<StorageObjectFile | null> {
    return this.backend.searchPublicObjectFile(filePath);
  }

  async downloadObject(file: StorageObjectFile): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": file.contentType,
      "Cache-Control": file.cacheControl,
    };
    if (file.size != null) {
      headers["Content-Length"] = String(file.size);
    }
    const webStream =
      file.body instanceof ReadableStream
        ? file.body
        : (Readable.toWeb(file.body as Readable) as ReadableStream<Uint8Array>);
    return new Response(webStream as ReadableStream, { headers });
  }
}
