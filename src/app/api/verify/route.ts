import { ApiError, clientIp, handle, ok, readFileUpload } from "@/lib/api";
import { db } from "@/lib/db";
import { buildMerkleTree, chunkBuffer, sha256 } from "@/lib/crypto/merkle";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Finds which stored blocks differ from the candidate file.
 * Without a documentId, picks the registered document sharing the most block hashes.
 */
async function locateTampering(leaves: string[], documentId?: string) {
  let id = documentId;
  if (!id) {
    const rows = await db.merkleBlock.findMany({ where: { blockHash: { in: leaves } }, select: { documentId: true } });
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.documentId, (counts.get(r.documentId) ?? 0) + 1);
    id = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }
  if (!id) return null;

  const doc = await db.document.findUnique({
    where: { id },
    select: { id: true, title: true, merkleBlocks: { orderBy: { blockIndex: "asc" } } },
  });
  if (!doc) return null;

  const stored = doc.merkleBlocks;
  const tamperedBlocks = [];
  for (let i = 0; i < Math.max(stored.length, leaves.length); i++) {
    if (stored[i]?.blockHash !== leaves[i]) {
      tamperedBlocks.push({
        index: i,
        byteStart: stored[i]?.chunkOffset ?? null,
        byteEnd: stored[i] ? stored[i].chunkOffset + stored[i].chunkSize : null,
      });
    }
  }
  return { id: doc.id, title: doc.title, storedBlocks: stored.length, candidateBlocks: leaves.length, tamperedBlocks };
}

export const POST = handle(async (req) => {
  const ip = clientIp(req);
  rateLimit(`verify:${ip}`, 30, 60_000);

  const { form, buf } = await readFileUpload(req);
  const rawId = form.get("documentId");
  const documentId = typeof rawId === "string" && rawId.trim() ? rawId.trim().slice(0, 64) : undefined;
  if (rawId !== null && typeof rawId !== "string") throw new ApiError(400, "BAD_REQUEST", "Invalid documentId");

  const fileHash = sha256(buf);
  const tree = buildMerkleTree(chunkBuffer(buf));
  const computed = { fileHash, merkleRoot: tree.root, blocks: tree.leaves.length };

  const match = await db.document.findFirst({
    where: { merkleRoot: tree.root, fileHash },
    select: { id: true, title: true, createdAt: true },
  });
  const closest = match ? null : await locateTampering(tree.leaves, documentId);

  await db.verificationAttempt.create({
    data: {
      documentId: match?.id ?? null,
      isAuthentic: !!match,
      fileHash,
      merkleRoot: tree.root,
      ipAddressHash: sha256(`${process.env.JWT_ACCESS_SECRET ?? ""}:${ip}`), // salted, raw IP never stored
    },
  });

  if (match) return ok({ authentic: true, document: { title: match.title, registeredAt: match.createdAt }, computed });
  return ok({ authentic: false, closestMatch: closest, computed });
});
