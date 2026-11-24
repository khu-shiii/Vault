import { ApiError, clientIp, handle, ok, readFileUpload } from "@/lib/api";
import { buildMerkleTree, chunkBuffer, sha256 } from "@/lib/crypto/merkle";
import { rateLimit } from "@/lib/rate-limit";
import { parseHashes, verifyHashes } from "@/lib/verify";

/** Fallback: the server hashes an uploaded file and discards it. Prefer POST /api/verify/hashes. */
export const POST = handle(async (req) => {
  const ip = clientIp(req);
  rateLimit(`verify:${ip}`, 30, 60_000);

  const { form, buf } = await readFileUpload(req);
  const rawId = form.get("documentId");
  if (rawId !== null && typeof rawId !== "string") throw new ApiError(400, "BAD_REQUEST", "Invalid documentId");

  const tree = buildMerkleTree(chunkBuffer(buf));
  const hashes = parseHashes({ fileHash: sha256(buf), leaves: tree.leaves, documentId: rawId ?? undefined });
  return ok(await verifyHashes({ ...hashes, ip }));
});