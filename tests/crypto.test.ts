import { describe, it, expect } from "vitest";
import {
  buildMerkleTree,
  chunkBuffer,
  generateMerkleProof,
  sha256,
  verifyMerkleProof,
  CHUNK_SIZE,
} from "../src/lib/crypto/merkle";
import {
  calculateAuditHash,
  calculateGenesisHash,
  canonicalJson,
  verifyAuditChain,
} from "../src/lib/crypto/hash-chain";
import { AuditLogEntryData } from "../src/lib/types";

describe("Merkle tree", () => {
  it("splits a 600 KB buffer into 3 chunks", () => {
    const chunks = chunkBuffer(Buffer.alloc(600 * 1024, 0x41), CHUNK_SIZE);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].length).toBe(CHUNK_SIZE);
    expect(chunks[2].length).toBe(88 * 1024);
  });

  it("gives different roots for [A,B,C] and [A,B,C,C]", () => {
    const [A, B, C] = ["A", "B", "C"].map((s) => Buffer.from(s));
    expect(buildMerkleTree([A, B, C]).root).not.toBe(buildMerkleTree([A, B, C, C]).root);
  });

  it("produces valid proofs for every leaf, for 1 to 17 chunks", () => {
    for (let n = 1; n <= 17; n++) {
      const chunks = Array.from({ length: n }, (_, i) => Buffer.from(`chunk${i}`));
      const tree = buildMerkleTree(chunks);
      tree.leaves.forEach((leaf, i) => {
        const proof = generateMerkleProof(i, tree.levels);
        expect(verifyMerkleProof(leaf, proof, tree.root)).toBe(true);
      });
    }
  });

  it("rejects a proof when the block data was changed", () => {
    const chunks = ["a", "b", "c", "d"].map((s) => Buffer.from(s));
    const tree = buildMerkleTree(chunks);
    const proof = generateMerkleProof(0, tree.levels);
    expect(verifyMerkleProof(sha256("tampered"), proof, tree.root)).toBe(false);
  });
});

describe("Audit chain", () => {
  const docId = "doc-1";
  const fileHash = "ab".repeat(32);

  function makeChain(): AuditLogEntryData[] {
    const make = (seq: number, prev: string, actorId: string): AuditLogEntryData => {
      const timestamp = new Date(`2026-03-01T10:0${seq}:00Z`);
      const payload = { n: seq };
      const currentHash = calculateAuditHash(
        { seq, documentId: docId, actorId, actionType: "VIEW", timestamp, payload },
        prev
      );
      return {
        id: `e${seq}`, documentId: docId, seq, actionType: "VIEW", actorId,
        timestamp, payloadData: payload, previousHash: prev, currentHash,
      };
    };
    const e1 = make(1, calculateGenesisHash(docId, fileHash), "user-1");
    const e2 = make(2, e1.currentHash, "user-1");
    const e3 = make(3, e2.currentHash, "user-2");
    return [e1, e2, e3];
  }

  it("accepts a valid chain", () => {
    expect(verifyAuditChain(makeChain(), docId, fileHash).isValid).toBe(true);
  });

  it("detects a changed actor", () => {
    const chain = makeChain();
    chain[1].actorId = "attacker";
    expect(verifyAuditChain(chain, docId, fileHash).isValid).toBe(false);
  });

  it("detects a removed entry in the middle", () => {
    const chain = makeChain();
    chain.splice(1, 1);
    expect(verifyAuditChain(chain, docId, fileHash).isValid).toBe(false);
  });

  it("detects removed last entries when the head hash is known", () => {
    const chain = makeChain();
    const head = chain[2].currentHash;
    expect(verifyAuditChain(chain.slice(0, 2), docId, fileHash, head).isValid).toBe(false);
  });

  it("gives the same canonical JSON regardless of key order", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 1 } })).toBe(canonicalJson({ a: { b: 1, y: 2 }, z: 1 }));
  });

  it("rejects Date values in payloads", () => {
    expect(() => canonicalJson({ d: new Date() })).toThrow();
  });
});