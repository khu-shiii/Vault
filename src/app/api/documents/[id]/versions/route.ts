import { ApiError, handle, ok, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { appendAudit } from "@/lib/audit/append";
import { requirePermission } from "@/lib/auth/session";
import { parseHashes, rootFromLeaves } from "@/lib/verify";

export const dynamic = "force-dynamic";

/** Adds a new version. The browser sends only hashes; the server derives the root. */
export const POST = handle(async (req, { params }) => {
  const user = await requirePermission(req, "document:upload");
  const { fileHash, leaves } = parseHashes(await readJson(req));
  const merkleRoot = rootFromLeaves(leaves);
  const docId: string = params.id;

  const created = await db.$transaction(async (tx) => {
    // Serialise version writers per document (same lock pattern as appendAudit).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${docId}))`;

    const doc = await tx.document.findFirst({
      where: { id: docId, organizationId: user.organizationId },
      select: { id: true, merkleRoot: true },
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

    await tx.document.update({
      where: { id: docId },
      data: { fileHash, merkleRoot },
    });

    return { id: version.id, versionNumber };
  });

  // Written after the transaction commits, so appendAudit's own lock does not wait on ours.
  await appendAudit(docId, user.userId, "UPLOAD", {
    event: "VERSION_ADDED",
    versionNumber: created.versionNumber,
    rootHash: merkleRoot,
    fileHash,
  });

  return ok({ versionId: created.id, versionNumber: created.versionNumber, rootHash: merkleRoot }, 201);
});