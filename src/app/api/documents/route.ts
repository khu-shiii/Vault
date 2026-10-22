import { handle, ok, readFileUpload } from "@/lib/api";
import { db } from "@/lib/db";
import { appendAudit } from "@/lib/audit/append";
import { requireAuth } from "@/lib/auth/session";
import { buildMerkleTree, chunkBuffer, sha256 } from "@/lib/crypto/merkle";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const user = await requireAuth(req, ["ADMIN", "SIGNER", "VIEWER"]);
  const documents = await db.document.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, title: true, fileSize: true, mimeType: true, fileHash: true, merkleRoot: true, createdAt: true },
  });
  return ok({ documents });
});

// Only hashes are stored. The uploaded bytes are discarded after hashing.
export const POST = handle(async (req) => {
  const user = await requireAuth(req, ["ADMIN", "SIGNER"]);
  const { form, name, type, buf } = await readFileUpload(req);

  const title = (String(form.get("title") ?? "").trim() || name || "untitled").slice(0, 255);
  const fileHash = sha256(buf);
  const tree = buildMerkleTree(chunkBuffer(buf));

  const document = await db.document.create({
    data: {
      organizationId: user.organizationId,
      title,
      fileHash,
      merkleRoot: tree.root,
      fileSize: buf.length,
      mimeType: type || "application/octet-stream",
      merkleBlocks: { create: tree.blocks },
    },
  });

  try {
    await appendAudit(document.id, user.userId, "UPLOAD", { title, fileHash, merkleRoot: tree.root });
  } catch (e) {
    await db.document.delete({ where: { id: document.id } }).catch(() => {}); // no audit entry yet, so delete is allowed
    throw e;
  }

  return ok(
    {
      document: {
        id: document.id, title, fileHash, merkleRoot: tree.root,
        fileSize: buf.length, blocks: tree.blocks.length, createdAt: document.createdAt,
      },
    },
    201
  );
});
