import { ApiError, handle, ok, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

async function ownedDocument(req: Request, id: string) {
  const user = await requirePermission(req, "document:read");
  const doc = await db.document.findFirst({ where: { id, organizationId: user.organizationId }, select: { id: true } });
  if (!doc) throw new ApiError(404, "NOT_FOUND", "Document not found");
  return doc.id;
}

/** GET: the current chain head as an anchor string "seq:hash". Store it somewhere outside this database. */
export const GET = handle(async (req, { params }) => {
  const documentId = await ownedDocument(req, params.id);
  const head = await db.auditLogEntry.findFirst({
    where: { documentId },
    orderBy: { seq: "desc" },
    select: { seq: true, currentHash: true },
  });
  if (!head) throw new ApiError(404, "NOT_FOUND", "No audit entries");
  return ok({
    documentId,
    seq: head.seq,
    hash: head.currentHash,
    anchor: `${head.seq}:${head.currentHash}`,
    issuedAt: new Date().toISOString(),
  });
});

/** POST { anchor }: is the entry you saved earlier still in the chain, unchanged? */
export const POST = handle(async (req, { params }) => {
  const documentId = await ownedDocument(req, params.id);
  const body = await readJson(req);
  const m = typeof body.anchor === "string" ? /^(\d{1,9}):([0-9a-f]{64})$/.exec(body.anchor.trim()) : null;
  if (!m) throw new ApiError(400, "BAD_REQUEST", "Anchor must look like <seq>:<64-char hash>");
  const entry = await db.auditLogEntry.findUnique({
    where: { uq_audit_doc_seq: { documentId, seq: Number(m[1]) } },
    select: { currentHash: true },
  });
  return ok({ intact: entry?.currentHash === m[2], seq: Number(m[1]) });
});