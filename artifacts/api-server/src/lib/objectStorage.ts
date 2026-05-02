// Backwards-compatible re-export. The implementation now lives in ./storage and
// supports both Replit (GCS sidecar) and local filesystem backends, selected via
// the STORAGE_BACKEND env var ("replit" by default, or "local").
export {
  ObjectStorageService,
  ObjectNotFoundError,
  type StorageObjectFile,
} from "./storage";
