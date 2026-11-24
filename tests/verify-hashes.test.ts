import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes, webcrypto } from "crypto";
import { db } from "../src/lib/db";
import { buildMerkleTree, chunkBuffer, sha256 } from "../src/lib/crypto/merkle";
import { digestFile } from "../src/lib/crypto/merkle-browser";
import { POST as verifyHashes } from "../src/app/api/verify/hashes/route";
import { POST as verifyFile } from "../src/app/api/verify/route";

const original = randomBytes(600 * 1024); // 3 chunks
const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const json = (body: unknown) =>
  new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeAll(async () => {
  if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  const org = await db.organization.create({ data: { name: `vh-${randomBytes(4).toString("hex")}` } });
  const tree = buildMerkleTree(chunkBuffer(original));
  await db.document.create({
    data: {
      organizationId: org.id, title: "hash-verify-doc", fileHash: sha256(original), merkleRoot: tree.root,
      fileSize: original.length, mimeType: "application/octet-stream", merkleBlocks: { create: tree.blocks },
    },
  });
});

describe("POST /api/verify/hashes", () => {
  it("accepts hashes computed in the browser", async () => {
    const { fileHash, leaves } = await digestFile(ab(original));
    const body = await (await verifyHashes(json({ fileHash, leaves }), {})).json();
    expect(body.data.authentic).toBe(true);
    expect(body.data.document.title).toBe("hash-verify-doc");
  });

  it("locates the changed block without ever receiving the file", async () => {
    const tampered = Buffer.from(original);
    tampered[300 * 1024] ^= 0xff; // block 1
    const { fileHash, leaves } = await digestFile(ab(tampered));
    const body = await (await verifyHashes(json({ fileHash, leaves }), {})).json();
    expect(body.data.authentic).toBe(false);
    expect(body.data.closestMatch.tamperedBlocks.map((b: { index: number }) => b.index)).toEqual([1]);
  });

  it("rejects malformed hashes", async () => {
    expect((await verifyHashes(json({ fileHash: "nope", leaves: [] }), {})).status).toBe(400);
  });

  it("the file-upload fallback still works", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(original)]), "a.bin");
    const res = await verifyFile(new Request("http://localhost/x", { method: "POST", body: fd }), {});
    expect((await res.json()).data.authentic).toBe(true);
  });
});