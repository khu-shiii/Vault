import { ApiError, handle, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { appendAudit } from "@/lib/audit/append";
import { requireAuth } from "@/lib/auth/session";
import { verifyAuditChain } from "@/lib/crypto/hash-chain";
import type { AuditLogEntryData } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const user = await requireAuth(req, ["ADMIN", "SIGNER", "VIEWER"]);

  const doc = await db.document.findFirst({
    where: { id: params.id, organizationId: user.organizationId }, // tenant isolation
    include: { _count: { select: { merkleBlocks: true } } },
  });
  if (!doc) throw new ApiError(404, "NOT_FOUND", "Document not found");

  await appendAudit(doc.id, user.userId, "VIEW", {});

  const entries = await db.auditLogEntry.findMany({
    where: { documentId: doc.id },
    orderBy: { seq: "asc" },
    include: { actor: { select: { email: true } } },
  });
  const chain = verifyAuditChain(entries as unknown as AuditLogEntryData[], doc.id, doc.fileHash);

  return ok({
    document: {
      id: doc.id, title: doc.title, fileHash: doc.fileHash, merkleRoot: doc.merkleRoot,
      fileSize: doc.fileSize, mimeType: doc.mimeType, blockCount: doc._count.merkleBlocks, createdAt: doc.createdAt,
    },
    chain,
    auditLog: entries.map((e) => ({
      seq: e.seq, actionType: e.actionType, actorEmail: e.actor?.email ?? null,
      timestamp: e.timestamp, previousHash: e.previousHash, currentHash: e.currentHash, payload: e.payloadData,
    })),
  });
});
