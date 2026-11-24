import { db } from "./db";

/**
 * Hash-only lookup: if this root belongs to an OLDER version of a document,
 * return the verdict. Returns null when no older version matches.
 */
export async function findSupersededVersion(merkleRoot: string) {
  const old = await db.documentVersion.findFirst({
    where: { rootHash: merkleRoot },
    select: {
      versionNumber: true,
      documentId: true,
      document: { select: { title: true } },
    },
  });
  if (!old) return null;

  const latest = await db.documentVersion.findFirst({
    where: { documentId: old.documentId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });

  return {
    documentTitle: old.document.title,
    versionNumber: old.versionNumber,
    currentVersionNumber: latest?.versionNumber ?? old.versionNumber,
  };
}