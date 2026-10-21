import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";
import { randomBytes } from "crypto";
import { sha256, chunkBuffer, buildMerkleTree } from "../src/lib/crypto/merkle";
import { calculateAuditHash, calculateGenesisHash } from "../src/lib/crypto/hash-chain";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production database");
  }

  const password = process.env.SEED_PASSWORD ?? randomBytes(12).toString("hex");
  const passwordHash = await hash(password);

  const org = await prisma.organization.create({ data: { name: "Demo Organization" } });
  const admin = await prisma.user.create({
    data: { organizationId: org.id, email: "admin@example.com", passwordHash, role: "ADMIN" },
  });

  const content = Buffer.from("Sample document content for local development.");
  const tree = buildMerkleTree(chunkBuffer(content));

  const document = await prisma.document.create({
    data: {
      organizationId: org.id,
      title: "sample.txt",
      fileHash: sha256(content),
      merkleRoot: tree.root,
      fileSize: content.length,
      mimeType: "text/plain",
      metadata: { description: "Seed document" },
    },
  });

  await prisma.merkleBlock.createMany({
    data: tree.blocks.map((b) => ({ ...b, documentId: document.id })),
  });

  const payload = { title: document.title, fileHash: document.fileHash, merkleRoot: tree.root };
  const timestamp = new Date();
  const previousHash = calculateGenesisHash(document.id, document.fileHash);
  const currentHash = calculateAuditHash(
    { seq: 1, documentId: document.id, actorId: admin.id, actionType: "UPLOAD", timestamp, payload },
    previousHash
  );
  await prisma.auditLogEntry.create({
    data: {
      documentId: document.id, actorId: admin.id, actionType: "UPLOAD",
      seq: 1, timestamp, payloadData: payload, previousHash, currentHash,
    },
  });

  console.log(`Seeded. Admin login: admin@example.com / ${process.env.SEED_PASSWORD ? "(SEED_PASSWORD)" : password}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());