import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes, webcrypto } from "crypto";
import { db } from "../src/lib/db";
import { buildMerkleTree, chunkBuffer, sha256 } from "../src/lib/crypto/merkle";
import { digestFile } from "../src/lib/crypto/merkle-browser";
import { signAccessToken } from "../src/lib/auth/tokens";
import { POST as uploadDoc } from "../src/app/api/documents/route";
import { GET as getDoc } from "../src/app/api/documents/[id]/route";
import { POST as createVersion } from "../src/app/api/documents/[id]/versions/route";
import { POST as verifyHashes } from "../src/app/api/verify/hashes/route";

const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const json = (body: unknown, cookie?: string) =>
  new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
const fileUpload = (buf: Buffer, cookie: string, title: string) => {
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(buf)]), `${title}.bin`);
  fd.append("title", title);
  return new Request("http://localhost/api/documents", { method: "POST", headers: { cookie }, body: fd });
};

let orgId: string;
let userId: string;
let cookie: string;
let signerCookie: string;
let viewerCookie: string;

beforeAll(async () => {
  if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  const suffix = randomBytes(4).toString("hex");
  const org = await db.organization.create({ data: { name: `ver-${suffix}` } });
  orgId = org.id;
  const user = await db.user.create({
    data: { organizationId: orgId, email: `ver-${suffix}@test.local`, passwordHash: "x", role: "ADMIN" },
  });
  const signer = await db.user.create({
    data: { organizationId: orgId, email: `ver-signer-${suffix}@test.local`, passwordHash: "x", role: "SIGNER" },
  });
  const viewer = await db.user.create({
    data: { organizationId: orgId, email: `ver-viewer-${suffix}@test.local`, passwordHash: "x", role: "VIEWER" },
  });
  userId = user.id;
  cookie = `vault_access=${await signAccessToken({ userId, email: user.email, role: "ADMIN", organizationId: orgId })}`;
  signerCookie = `vault_access=${await signAccessToken({ userId: signer.id, email: signer.email, role: "SIGNER", organizationId: orgId })}`;
  viewerCookie = `vault_access=${await signAccessToken({ userId: viewer.id, email: viewer.email, role: "VIEWER", organizationId: orgId })}`;
});

/** Creates a document from the given bytes, the same way the upload path does (no versions yet). */
async function makeDocument(bytes: Buffer) {
  const tree = buildMerkleTree(chunkBuffer(bytes));
  return db.document.create({
    data: {
      organizationId: orgId,
      title: `doc-${randomBytes(3).toString("hex")}`,
      fileHash: sha256(bytes),
      merkleRoot: tree.root,
      fileSize: bytes.length,
      mimeType: "application/octet-stream",
      merkleBlocks: { create: tree.blocks },
    },
  });
}

describe("POST /api/documents/[id]/versions", () => {
  it("rejects requests without a session", async () => {
    const doc = await makeDocument(randomBytes(1024));
    const { fileHash, leaves } = await digestFile(ab(randomBytes(1024)));
    const res = await createVersion(json({ fileHash, leaves }), { params: { id: doc.id } });
    expect(res.status).toBe(401);
  });

  it("adds version 2 and keeps the original as version 1", async () => {
    const original = randomBytes(600 * 1024);
    const revised = Buffer.from(original);
    revised[300 * 1024] ^= 0xff;
    const doc = await makeDocument(original);

    const { fileHash, leaves } = await digestFile(ab(revised));
    const res = await createVersion(json({ fileHash, leaves }, cookie), { params: { id: doc.id } });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.versionNumber).toBe(2);

    const versions = await db.documentVersion.findMany({
      where: { documentId: doc.id },
      orderBy: { versionNumber: "asc" },
    });
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2]);
  });

  it("returns 409 when the same bytes are submitted again", async () => {
    const original = randomBytes(300 * 1024);
    const revised = Buffer.from(original);
    revised[0] ^= 0xff;
    const doc = await makeDocument(original);
    const { fileHash, leaves } = await digestFile(ab(revised));

    const first = await createVersion(json({ fileHash, leaves }, cookie), { params: { id: doc.id } });
    expect(first.status).toBe(201);
    const second = await createVersion(json({ fileHash, leaves }, cookie), { params: { id: doc.id } });
    expect(second.status).toBe(409);
  });

  it("returns 404 for a document in another organisation", async () => {
    const doc = await makeDocument(randomBytes(1024));
    const other = await db.organization.create({ data: { name: `other-${randomBytes(3).toString("hex")}` } });
    const otherUser = await db.user.create({
      data: { organizationId: other.id, email: `other-${randomBytes(3).toString("hex")}@test.local`, passwordHash: "x", role: "ADMIN" },
    });
    const otherToken = await signAccessToken({
      userId: otherUser.id, email: otherUser.email, role: "ADMIN", organizationId: other.id,
    });
    const { fileHash, leaves } = await digestFile(ab(randomBytes(1024)));
    const res = await createVersion(json({ fileHash, leaves }, `vault_access=${otherToken}`), { params: { id: doc.id } });
    expect(res.status).toBe(404);
  });
});

describe("verify state after versioning", () => {
  it("old bytes are superseded, new bytes are current", async () => {
    const original = randomBytes(300 * 1024);
    const revised = Buffer.from(original);
    revised[10] ^= 0xff;
    const doc = await makeDocument(original);

    const newDigest = await digestFile(ab(revised));
    const created = await createVersion(json(newDigest, cookie), { params: { id: doc.id } });
    expect(created.status).toBe(201);

    const oldDigest = await digestFile(ab(original));
    const oldBody = (await (await verifyHashes(json(oldDigest), {})).json()).data;
    expect(oldBody.state).toBe("superseded");
    expect(oldBody.versionNumber).toBe(1);
    expect(oldBody.currentVersionNumber).toBe(2);

    const newBody = (await (await verifyHashes(json(newDigest), {})).json()).data;
    expect(newBody.state).toBe("current");
    expect(newBody.authentic).toBe(true);
  });

  it("unknown bytes are unrecognized", async () => {
    const digest = await digestFile(ab(randomBytes(2048)));
    const body = (await (await verifyHashes(json(digest), {})).json()).data;
    expect(body.state).toBe("unrecognized");
    expect(body.authentic).toBe(false);
  });

  it("keeps the audit chain valid and updates merkle blocks for tamper localization across versions", async () => {
    const v1 = randomBytes(600 * 1024); // 3 chunks
    const up = await uploadDoc(fileUpload(v1, signerCookie, "versioned-doc"), {});
    expect(up.status).toBe(201);
    const docId = (await up.json()).data.document.id as string;

    // Viewer cannot add a version; Signer can.
    const v2 = Buffer.from(v1);
    v2[10] ^= 0xff; // modifies block 0
    const d2 = await digestFile(ab(v2));
    expect((await createVersion(json({ ...d2, fileSize: v2.length }, viewerCookie), { params: { id: docId } })).status).toBe(403);

    const added = await createVersion(json({ ...d2, fileSize: v2.length }, signerCookie), { params: { id: docId } });
    expect(added.status).toBe(201);
    const addedData = (await added.json()).data;
    expect(addedData.versionNumber).toBe(2);
    expect(addedData.auditEntry.payload.event).toBe("VERSION_ADDED");

    // Audit chain must still verify cleanly against the preserved v1 genesis hash.
    const detail = await getDoc(new Request("http://localhost/x", { headers: { cookie: signerCookie } }), { params: { id: docId } });
    expect(detail.status).toBe(200);
    const detailData = (await detail.json()).data;
    expect(detailData.chain.isValid).toBe(true);
    expect(detailData.versions.map((v: { versionNumber: number }) => v.versionNumber)).toEqual([2, 1]);
    expect(detailData.auditLog.map((e: { actionType: string }) => e.actionType)).toEqual(["UPLOAD", "UPLOAD", "VIEW"]);

    // Tampering block 2 of v2 must pinpoint ONLY block 2 (not block 0 from v1).
    const tamperedV2 = Buffer.from(v2);
    tamperedV2[550 * 1024] ^= 0xff; // block 2
    const td = await digestFile(ab(tamperedV2));
    const verifyRes = (await (await verifyHashes(json({ ...td, documentId: docId }), {})).json()).data;
    expect(verifyRes.state).toBe("unrecognized");
    expect(verifyRes.closestMatch.tamperedBlocks.map((b: { index: number }) => b.index)).toEqual([2]);
  });
});