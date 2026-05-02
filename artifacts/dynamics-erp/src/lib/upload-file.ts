type UploadResponse = {
  uploadURL: string;
  objectPath: string;
};

export async function uploadFile(file: File): Promise<UploadResponse> {
  const presignRes = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });
  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err?.error ?? `Failed to get upload URL (${presignRes.status})`);
  }
  const { uploadURL, objectPath } = (await presignRes.json()) as UploadResponse;

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!putRes.ok) {
    throw new Error(`Failed to upload file to storage (${putRes.status})`);
  }

  return { uploadURL, objectPath };
}

export function objectPathToUrl(objectPath: string | null | undefined): string | null {
  if (!objectPath) return null;
  if (objectPath.startsWith("http://") || objectPath.startsWith("https://")) return objectPath;
  if (objectPath.startsWith("/objects/")) return `/api/storage${objectPath}`;
  return objectPath;
}
