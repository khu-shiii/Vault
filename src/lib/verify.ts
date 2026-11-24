import { ApiError } from "./api";
import { db } from "./db";
import { hashNode, sha256 } from "./crypto/merkle";

const HEX64 = /^[0-9a-f]{64}$/;

/** The server derives the root itself from the leaves, so a client cannot claim a root it didn't compute. */
export function rootFromLeaves(leaves: string[]): string {
  let level = leaves;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? hashNode(level[i], level[i + 1]) : level[i]);
    level = next;
  }
  return level[0];
}

export function parseHashes(body: Record<string, unknown>) {
  const fileHash = typeof body.fileHash === "string" ? body.fileHash.toLowerCase() : "";
  const leaves = Array.isArray(body.leaves) ? body.leaves : [];
  if (!HEX64.test(fileHash) || leaves.length < 1 || leaves.length > 4096 || !leaves.every((l) => typeof l === "string" && HEX64.test(l.toLowerCase()))) {
    throw new ApiError(400, "BAD_REQUEST", "fileHash and leaves (1 to 4096 SHA-256 hex strings) are required");
  }
  const documentId = typeof body.documentId === "string" && body.documentId.trim() ? body.documentId.trim().slice(0, 64) : undefined;
  return { fileHash, leaves: (leaves as string[]).map((l) => l.toLowerCase()), documentId };
}

async function locateTampering(leaves: string[], documentId?: string) {
  let id = documentId;
  if (!id) {
    const rows = await db.merkleBlock.findMany({ where: { blockHash: { in: leaves } }, select: { documentId: true } });
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.documentId, (counts.get(r.documentId) ?? 0) + 1);
    id = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
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

export async function verifyHashes(input: { fileHash: string; leaves: string[]; documentId?: string; ip: string }) {
  const merkleRoot = rootFromLeaves(input.leaves);
  const computed = { fileHash: input.fileHash, merkleRoot, blocks: input.leaves.length };

  const match = await db.document.findFirst({
    where: { merkleRoot, fileHash: input.fileHash },
    select: { id: true, title: true, createdAt: true },
  });
  const closest = match ? null : await locateTampering(input.leaves, input.documentId);

  await db.verificationAttempt.create({
    data: {
      documentId: match?.id ?? null,
      isAuthentic: !!match,
      fileHash: input.fileHash,
      merkleRoot,
      ipAddressHash: sha256(`${process.env.JWT_ACCESS_SECRET ?? ""}:${input.ip}`), // salted, raw IP never stored
    },
  });

  if (match) return { authentic: true, document: { title: match.title, registeredAt: match.createdAt }, computed };
  return { authentic: false, closestMatch: closest, computed };
}