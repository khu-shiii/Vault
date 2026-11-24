import { digestFile } from "./crypto/merkle-browser";

const MAX_BYTES = 200 * 1024 * 1024;

/** Hashes the file in the browser and sends only hashes to the server. */
export async function verifyInBrowser(file: File, documentId?: string) {
  if (!globalThis.crypto?.subtle) throw new Error("Browser hashing needs HTTPS or localhost");
  if (file.size > MAX_BYTES) throw new Error("File is too large to hash in the browser (limit 200 MB)");
  const { fileHash, leaves } = await digestFile(await file.arrayBuffer());
  const res = await fetch("/api/verify/hashes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileHash, leaves, documentId: documentId?.trim() || undefined }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? "Verification failed");
  return json.data;
}