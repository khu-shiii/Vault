import { createHash } from "crypto";
import { MerkleProofStep, MerkleTreeResult } from "../types";

export const CHUNK_SIZE = 256 * 1024;

const LEAF_PREFIX = 0x00;
const NODE_PREFIX = 0x01;

export function sha256(data: Buffer | string): string {
  const hash = createHash("sha256");
  if (typeof data === "string") hash.update(data, "utf8");
  else hash.update(data);
  return hash.digest("hex");
}

/** Hash of one file chunk (leaf). Domain-separated from internal nodes. */
export function hashLeaf(chunk: Buffer): string {
  return createHash("sha256").update(Buffer.from([LEAF_PREFIX])).update(chunk).digest("hex");
}

/** Hash of two child hashes (internal node). */
export function hashNode(left: string, right: string): string {
  return createHash("sha256")
    .update(Buffer.from([NODE_PREFIX]))
    .update(Buffer.from(left, "hex"))
    .update(Buffer.from(right, "hex"))
    .digest("hex");
}

export function chunkBuffer(buffer: Buffer, chunkSize: number = CHUNK_SIZE): Buffer[] {
  if (buffer.length === 0) return [Buffer.alloc(0)];
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    chunks.push(buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length)));
  }
  return chunks;
}

export function buildMerkleTree(chunks: Buffer[], chunkSize: number = CHUNK_SIZE): MerkleTreeResult {
  const input = chunks.length === 0 ? [Buffer.alloc(0)] : chunks;
  const leaves = input.map(hashLeaf);
  const levels: string[][] = [leaves];

  let level = leaves;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      // An odd node is promoted unchanged. It is NOT duplicated, which
      // would let [A,B,C] and [A,B,C,C] share a root.
      next.push(i + 1 < level.length ? hashNode(level[i], level[i + 1]) : level[i]);
    }
    levels.push(next);
    level = next;
  }

  const root = level[0];
  const blocks = leaves.map((blockHash, index) => ({
    blockIndex: index,
    blockHash,
    parentHash: levels.length > 1 ? levels[1][Math.floor(index / 2)] : root,
    chunkSize: input[index].length,
    chunkOffset: index * chunkSize,
  }));

  return { root, leaves, levels, blocks };
}

export function generateMerkleProof(leafIndex: number, levels: string[][]): MerkleProofStep[] {
  if (leafIndex < 0 || leafIndex >= levels[0].length) {
    throw new Error(`Invalid leaf index: ${leafIndex}`);
  }
  const proof: MerkleProofStep[] = [];
  let index = leafIndex;
  for (let l = 0; l < levels.length - 1; l++) {
    const level = levels[l];
    if (index % 2 === 1) {
      proof.push({ position: "left", hash: level[index - 1] });
    } else if (index + 1 < level.length) {
      proof.push({ position: "right", hash: level[index + 1] });
    } // else: promoted node, no sibling, no step
    index = Math.floor(index / 2);
  }
  return proof;
}

export function verifyMerkleProof(leafHash: string, proof: MerkleProofStep[], root: string): boolean {
  let current = leafHash.toLowerCase();
  for (const step of proof) {
    current =
      step.position === "left"
        ? hashNode(step.hash.toLowerCase(), current)
        : hashNode(current, step.hash.toLowerCase());
  }
  return current === root.toLowerCase();
}