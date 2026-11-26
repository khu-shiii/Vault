import { Prisma } from "@prisma/client";
import { ApiError, handle, ok, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { appendAudit } from "@/lib/audit/append";
import { requirePermission } from "@/lib/auth/session";
import { buildMerkleTreeFromLeaves, CHUNK_SIZE } from "@/lib/crypto/merkle";
import { parseHashes } from "@/lib/verify";

export const dynamic = "force-dynamic";

function chunkSizesFor(leafCount: number, fileSize?: number): number[] | undefined {
  if (fileSize === undefined) return undefined;
  return Array.from({ length: leafCount }, (_, i) =>
    Math.max(0, Math.min(CHUNK_SIZE, fileSize - i * CHUNK_SIZE))
  );
}

/** Adds a new version. The browser sends only hashes; the server derives the root. */
export const POST = handle(async (req, { params }) => {
  const user = await requirePermission(req, "document:upload");
  const { fileHash, leaves, fileSize } = parseHashes(await readJson(req));
  const tree = buildMerkleTreeFromLeaves(leaves, chunkSizesFor(leaves.length, fileSize));
  const merkleRoot = tree.root;
  const docId: string = params.id;

  const created = await db.$transaction(async (tx) => {
    // Serialise version writers per document (same lock pattern as appendAudit).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${docId}))`;

    const doc = await tx.document.findFirst({
      where: { id: docId, organizationId: user.organizationId },
      select: { id: true, merkleRoot: true, fileHash: true, fileSize: true, metadata: true },
    });
    if (!doc) throw new ApiError(404, "NOT_FOUND", "Document not found");

    const duplicate =
      doc.merkleRoot === merkleRoot ||
      (await tx.documentVersion.findFirst({
        where: { documentId: docId, rootHash: merkleRoot },
        select: { id: true },
      }));
    if (duplicate) {
      throw new ApiError(409, "IDENTICAL_BYTES", "This content is already recorded as a version.");
    }

    let last = await tx.documentVersion.findFirst({
      where: { documentId: docId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    // Documents uploaded before versioning have no version rows yet.
    // Their current root becomes version 1 before the new one is added.
    if (!last) {
      const blockCount = await tx.merkleBlock.count({ where: { documentId: docId } });
      await tx.documentVersion.create({
        data: { documentId: docId, versionNumber: 1, rootHash: doc.merkleRoot, leafCount: blockCount },
      });
      last = { versionNumber: 1 };
    }

    const versionNumber = last.versionNumber + 1;
    const version = await tx.documentVersion.create({
      data: { documentId: docId, versionNumber, rootHash: merkleRoot, leafCount: leaves.length },
    });

    // Replace stored leaf blocks so tamper localization checks against the current version.
    await tx.merkleBlock.deleteMany({ where: { documentId: docId } });
    await tx.merkleBlock.createMany({
      data: tree.blocks.map((b) => ({ ...b, documentId: docId })),
    });

    // Preserve the original v1 fileHash so genesis hash verification stays valid across versions.
    const meta =
      doc.metadata && typeof doc.metadata === "object" && !Array.isArray(doc.metadata)
        ? (doc.metadata as Record<string, unknown>)
        : {};
    const genesisFileHash = typeof meta.genesisFileHash === "string" ? meta.genesisFileHash : doc.fileHash;
    const nextFileSize = fileSize ?? doc.fileSize;

    await tx.document.update({
      where: { id: docId },
      data: {
        fileHash,
        merkleRoot,
        fileSize: nextFileSize,
        metadata: { ...meta, genesisFileHash } as Prisma.InputJsonObject,
      },
    });

    const versions = await tx.documentVersion.findMany({
      where: { documentId: docId },
      orderBy: { versionNumber: "desc" },
      select: { id: true, versionNumber: true, rootHash: true, leafCount: true, createdAt: true },
    });

    return { id: version.id, versionNumber, fileSize: nextFileSize, versions };
  });

  // Written after the transaction commits, so appendAudit's own lock does not wait on ours.
  const entry = await appendAudit(docId, user.userId, "UPLOAD", {
    event: "VERSION_ADDED",
    versionNumber: created.versionNumber,
    rootHash: merkleRoot,
    fileHash,
  });

  return ok(
    {
      versionId: created.id,
      versionNumber: created.versionNumber,
      rootHash: merkleRoot,
      fileHash,
      fileSize: created.fileSize,
      blockCount: tree.blocks.length,
      versions: created.versions,
      auditEntry: {
        seq: entry.seq,
        actionType: entry.actionType,
        actorEmail: user.email,
        timestamp: entry.timestamp,
        previousHash: entry.previousHash,
        currentHash: entry.currentHash,
        payload: entry.payloadData,
      },
    },
    201
  );
});