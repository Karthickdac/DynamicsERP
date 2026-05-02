import express, { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { verifyUploadToken, writeUploadedObject } from "../lib/storage/localBackend";
import { requireAuth, requireRole } from "../middlewares/authMiddleware";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const ALLOWED_UPLOAD_CONTENT_TYPES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload. Admin-only.
 * Server-side enforces an image-only content-type allowlist and a 2 MB cap
 * before issuing the URL.
 */
router.post(
  "/storage/uploads/request-url",
  requireAuth,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    const { name, size, contentType } = parsed.data;

    if (!ALLOWED_UPLOAD_CONTENT_TYPES.has(contentType.toLowerCase())) {
      res.status(400).json({ error: "Unsupported file type. Allowed: PNG, JPG, GIF, WEBP, SVG." });
      return;
    }
    if (size > MAX_UPLOAD_BYTES) {
      res.status(400).json({ error: "File too large. Maximum size is 2 MB." });
      return;
    }

    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * PUT /storage/uploads/local/:objectId
 *
 * Receives a file upload for the local-filesystem storage backend. The URL is
 * issued by /storage/uploads/request-url (server-side admin-gated) and signed
 * with a short-lived HMAC token, so this endpoint authenticates via the
 * signature rather than session cookies (presigned-URL pattern).
 *
 * Only active when STORAGE_BACKEND=local; in Replit mode the upload URL points
 * directly at GCS and never reaches this route.
 */
router.put(
  "/storage/uploads/local/:objectId",
  express.raw({ type: "*/*", limit: MAX_UPLOAD_BYTES }),
  async (req: Request, res: Response) => {
    if ((process.env.STORAGE_BACKEND || "").toLowerCase() !== "local") {
      res.status(404).json({ error: "Local upload endpoint not enabled" });
      return;
    }

    const { objectId } = req.params as { objectId: string };
    const expires = Number(req.query.expires);
    const sig = String(req.query.sig || "");

    if (!objectId || !expires || !sig) {
      res.status(400).json({ error: "Missing upload signature" });
      return;
    }
    if (!verifyUploadToken(objectId, expires, sig)) {
      res.status(403).json({ error: "Invalid or expired upload signature" });
      return;
    }

    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: "Empty request body" });
      return;
    }
    if (body.length > MAX_UPLOAD_BYTES) {
      res.status(413).json({ error: "File too large" });
      return;
    }

    const contentType = (req.header("content-type") || "application/octet-stream").split(";")[0].trim();
    if (!ALLOWED_UPLOAD_CONTENT_TYPES.has(contentType.toLowerCase())) {
      res.status(400).json({ error: "Unsupported file type" });
      return;
    }

    try {
      await writeUploadedObject(objectId, body, contentType);
      res.status(200).json({ ok: true });
    } catch (error) {
      req.log.error({ err: error }, "Error writing local upload");
      res.status(500).json({ error: "Failed to store upload" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
