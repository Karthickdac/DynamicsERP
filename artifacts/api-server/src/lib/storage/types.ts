import type { Readable } from "stream";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export interface StorageObjectFile {
  contentType: string;
  size?: number;
  cacheControl: string;
  body: ReadableStream<Uint8Array> | Readable;
}

export interface StorageBackend {
  generateUploadURL(): Promise<{ uploadURL: string; objectId: string }>;
  uploadURLToObjectPath(uploadURL: string): string;
  getObjectFile(objectId: string): Promise<StorageObjectFile>;
  searchPublicObjectFile(filePath: string): Promise<StorageObjectFile | null>;
}
