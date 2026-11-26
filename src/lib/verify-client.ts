import { api } from "./client";
import { digestFile } from "./crypto/merkle-browser";

const MAX_BYTES = 200 * 1024 * 1024;

/** Computes the file SHA-256 and Merkle leaf hashes locally in the browser. */
export async function hashFileInBrowser(file: File) {
  if (!globalThis.crypto?.subtle) throw new Error("Browser hashing needs HTTPS or localhost");
  if (file.size > MAX_BYTES) throw new Error("File is too large to hash in the browser (limit 200 MB)");
  const { fileHash, leaves } = await digestFile(await file.arrayBuffer());
  return { fileHash, leaves, fileSize: file.size };
}

/** Hashes the file in the browser and sends only hashes to the server. */
export async function verifyInBrowser(file: File, documentId?: string) {
  const { fileHash, leaves } = await hashFileInBrowser(file);
  const res = await fetch("/api/verify/hashes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileHash, leaves, documentId: documentId?.trim() || undefined }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? "Verification failed");
  return json.data;
}

/** Hashes a modified file in the browser and records it as the next document version. */
export async function addDocumentVersionInBrowser(documentId: string, file: File) {
  const { fileHash, leaves, fileSize } = await hashFileInBrowser(file);
  return api(`/api/documents/${encodeURIComponent(documentId)}/versions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileHash, leaves, fileSize }),
  });
}