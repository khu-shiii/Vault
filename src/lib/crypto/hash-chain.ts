import { sha256 } from "./merkle";
import { ActionType, AuditLogEntryData } from "../types";

/** Deterministic JSON. Rejects values that cannot be hashed safely. */
export function canonicalJson(obj: unknown): string {
  if (obj === undefined || (typeof obj === "number" && !Number.isFinite(obj))) {
    throw new TypeError("Value cannot be canonicalized");
  }
  if (obj instanceof Date) {
    throw new TypeError("Convert Date to an ISO string before hashing");
  }
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalJson).join(",") + "]";

  const record = obj as Record<string, unknown>;
  return (
    "{" +
    Object.keys(record)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`)
      .join(",") +
    "}"
  );
}

export function calculateGenesisHash(documentId: string, fileHash: string): string {
  return sha256(canonicalJson({ type: "GENESIS", documentId, fileHash }));
}

export interface AuditHashInput {
  seq: number;
  documentId: string;
  actorId: string | null;
  actionType: ActionType;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export function calculateAuditHash(entry: AuditHashInput, previousHash: string): string {
  return sha256(
    canonicalJson({
      v: 1,
      seq: entry.seq,
      documentId: entry.documentId,
      actorId: entry.actorId,
      action: entry.actionType,
      ts: entry.timestamp.toISOString(),
      payload: entry.payload,
      prev: previousHash,
    })
  );
}

export interface ChainVerificationResult {
  isValid: boolean;
  brokenSeq?: number;
  reason?: string;
}

/**
 * Verifies a full chain. Pass the document's id and fileHash so the first
 * entry is tied to the document. Pass expectedHeadHash (stored somewhere
 * outside the DB) to detect truncation.
 */
export function verifyAuditChain(
  entries: AuditLogEntryData[],
  documentId: string,
  fileHash: string,
  expectedHeadHash?: string
): ChainVerificationResult {
  const sorted = [...entries].sort((a, b) => a.seq - b.seq);
  let prev = calculateGenesisHash(documentId, fileHash);

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (e.seq !== i + 1) {
      return { isValid: false, brokenSeq: e.seq, reason: `Missing or out-of-order seq at position ${i + 1}` };
    }
    if (e.documentId !== documentId) {
      return { isValid: false, brokenSeq: e.seq, reason: "Entry belongs to a different document" };
    }
    if (e.previousHash !== prev) {
      return { isValid: false, brokenSeq: e.seq, reason: "previous_hash does not match the prior entry" };
    }
    const expected = calculateAuditHash(
      {
        seq: e.seq,
        documentId: e.documentId,
        actorId: e.actorId ?? null,
        actionType: e.actionType,
        timestamp: new Date(e.timestamp),
        payload: e.payloadData,
      },
      e.previousHash
    );
    if (expected !== e.currentHash) {
      return { isValid: false, brokenSeq: e.seq, reason: `Entry ${e.seq} was modified` };
    }
    prev = e.currentHash;
  }

  if (expectedHeadHash && prev !== expectedHeadHash) {
    return { isValid: false, reason: "Chain head does not match the anchored hash (entries removed?)" };
  }
  return { isValid: true };
}