import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes, webcrypto } from "crypto";
import { buildMerkleTree, chunkBuffer, sha256 } from "../src/lib/crypto/merkle";
import { digestFile, merkleRoot } from "../src/lib/crypto/merkle-browser";

beforeAll(() => {
  if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
});

const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe("browser Merkle hashing matches the server", () => {
  const CHUNK = 1024;
  for (const size of [0, 1, 1023, 1024, 1025, 2048, 3 * 1024 + 5, 5 * 1024, 7 * 1024, 9 * 1024]) {
    it(`size ${size}`, async () => {
      const buf = randomBytes(size);
      const server = buildMerkleTree(chunkBuffer(buf, CHUNK), CHUNK);
      const client = await digestFile(ab(buf), CHUNK);
      expect(client.leaves).toEqual(server.leaves);
      expect(client.root).toBe(server.root);
      expect(client.fileHash).toBe(sha256(buf));
    });
  }

  it("default 256 KB chunking (3 chunks)", async () => {
    const buf = randomBytes(600 * 1024);
    const server = buildMerkleTree(chunkBuffer(buf));
    const client = await digestFile(ab(buf));
    expect(client.root).toBe(server.root);
    expect(client.leaves).toHaveLength(3);
  });

  it("a single leaf is its own root", async () => {
    expect(await merkleRoot(["a".repeat(64)])).toBe("a".repeat(64));
  });

  it("changing one byte changes the root", async () => {
    const buf = randomBytes(5000);
    const other = Buffer.from(buf);
    other[2500] ^= 0xff;
    expect((await digestFile(ab(buf), CHUNK)).root).not.toBe((await digestFile(ab(other), CHUNK)).root);
  });
});