import { Prisma } from "@prisma/client";
import { db } from "../db";
import { calculateAuditHash, calculateGenesisHash } from "../crypto/hash-chain";
import type { ActionType } from "../types";

export async function appendAudit(
  documentId: string,
  actorId: string | null,
  actionType: ActionType,
  payload: Record<string, unknown>
) {
  return db.$transaction(async (tx) => {
    // Serialize writers per document so the chain can't fork.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${documentId}))`;

    const doc = await tx.document.findUniqueOrThrow({ where: { id: documentId } });
    const last = await tx.auditLogEntry.findFirst({
      where: { documentId },
      orderBy: { seq: "desc" },
    });

    const seq = (last?.seq ?? 0) + 1;
    const previousHash = last?.currentHash ?? calculateGenesisHash(documentId, doc.fileHash);
    const timestamp = new Date();
    const currentHash = calculateAuditHash(
      { seq, documentId, actorId, actionType, timestamp, payload },
      previousHash
    );

    return tx.auditLogEntry.create({
      data: {
        documentId,
        actorId,
        actionType,
        seq,
        timestamp,
        payloadData: payload as Prisma.InputJsonObject,
        previousHash,
        currentHash,
      },
    });
  });
}