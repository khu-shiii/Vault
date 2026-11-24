export const CHUNK_SIZE = 256 * 1024;

const LEAF = new Uint8Array([0x00]);
const NODE = new Uint8Array([0x01]);

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function sha256Parts(...parts: Uint8Array[]): Promise<string> {
  const joined = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    joined.set(p, offset);
    offset += p.length;
  }
  return toHex(await crypto.subtle.digest("SHA-256", joined));
}

export async function merkleRoot(leaves: string[]): Promise<string> {
  let level = leaves;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      // An odd node is promoted unchanged (same rule as the server).
      next.push(i + 1 < level.length ? await sha256Parts(NODE, fromHex(level[i]), fromHex(level[i + 1])) : level[i]);
    }
    level = next;
  }
  return level[0];
}

export interface FileDigest { fileHash: string; root: string; leaves: string[] }

/** Computes the whole-file hash, leaf hashes and Merkle root locally. The bytes never leave the browser. */
export async function digestFile(data: ArrayBuffer, chunkSize: number = CHUNK_SIZE): Promise<FileDigest> {
  const bytes = new Uint8Array(data);
  const fileHash = toHex(await crypto.subtle.digest("SHA-256", bytes));
  const leaves: string[] = [];
  if (bytes.length === 0) {
    leaves.push(await sha256Parts(LEAF, new Uint8Array(0)));
  } else {
    // Sequential on purpose: avoids holding hundreds of chunk copies in memory at once.
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      leaves.push(await sha256Parts(LEAF, bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length))));
    }
  }
  return { fileHash, leaves, root: await merkleRoot(leaves) };
}