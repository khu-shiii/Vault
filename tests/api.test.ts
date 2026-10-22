import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";
import { buildMerkleTree, chunkBuffer } from "../src/lib/crypto/merkle";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as refresh } from "../src/app/api/auth/refresh/route";
import { GET as me } from "../src/app/api/auth/me/route";
import { GET as listDocs, POST as upload } from "../src/app/api/documents/route";
import { GET as getDoc } from "../src/app/api/documents/[id]/route";
import { POST as verify } from "../src/app/api/verify/route";

const run = randomBytes(4).toString("hex");
const PASSWORD = "Test-Passw0rd!";
const email = (name: string) => `${name}-${run}@test.local`;

const url = (p: string) => `http://localhost${p}`;
const cookieOf = (res: Response) =>
  res.headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => !c.endsWith("=")).join("; ");
const get = (cookie?: string) => new Request(url("/x"), { headers: cookie ? { cookie } : {} });
const loginReq = (e: string, password: string) =>
  new Request(url("/api/auth/login"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: e, password }),
  });
const fileReq = (buf: Buffer, cookie?: string, fields: Record<string, string> = {}) => {
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(buf)]), "test.bin");
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request(url("/x"), { method: "POST", headers: cookie ? { cookie } : {}, body: fd });
};
const loginAs = async (name: string) => cookieOf(await login(loginReq(email(name), PASSWORD), {}));

beforeAll(async () => {
  const [org, otherOrg] = await Promise.all([
    db.organization.create({ data: { name: `test-${run}` } }),
    db.organization.create({ data: { name: `test-other-${run}` } }),
  ]);
  const passwordHash = await hashPassword(PASSWORD);
  await db.user.createMany({
    data: [
      { organizationId: org.id, email: email("admin"), passwordHash, role: "ADMIN" },
      { organizationId: org.id, email: email("viewer"), passwordHash, role: "VIEWER" },
      { organizationId: otherOrg.id, email: email("other"), passwordHash, role: "ADMIN" },
    ],
  });
});

describe("auth", () => {
  it("rejects a wrong password", async () => {
    const res = await login(loginReq(email("admin"), "wrong"), {});
    expect(res.status).toBe(401);
  });

  it("logs in, sets httpOnly cookies and never returns the password hash", async () => {
    const res = await login(loginReq(email("admin"), PASSWORD), {});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.user.email).toBe(email("admin"));
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(res.headers.getSetCookie().every((c) => c.toLowerCase().includes("httponly"))).toBe(true);
  });

  it("/me needs a cookie", async () => {
    expect((await me(get(), {})).status).toBe(401);
    const res = await me(get(await loginAs("admin")), {});
    expect(res.status).toBe(200);
  });

  it("rotates refresh tokens and rejects a replayed one", async () => {
    const cookie = await loginAs("viewer");
    expect((await refresh(new Request(url("/x"), { method: "POST", headers: { cookie } }), {})).status).toBe(200);
    expect((await refresh(new Request(url("/x"), { method: "POST", headers: { cookie } }), {})).status).toBe(401);
  });
});

describe("documents + verify", () => {
  const original = randomBytes(600 * 1024); // 3 chunks
  let admin = "";
  let docId = "";

  beforeAll(async () => {
    admin = await loginAs("admin");
  });

  it("requires auth and the right role to upload", async () => {
    expect((await upload(fileReq(original), {})).status).toBe(401);
    expect((await upload(fileReq(original, await loginAs("viewer")), {})).status).toBe(403);
  });

  it("uploads: correct Merkle root and an UPLOAD audit entry", async () => {
    const res = await upload(fileReq(original, admin, { title: "Test doc" }), {});
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data.document.merkleRoot).toBe(buildMerkleTree(chunkBuffer(original)).root);
    expect(body.data.document.blocks).toBe(3);
    docId = body.data.document.id;

    const entries = await db.auditLogEntry.findMany({ where: { documentId: docId } });
    expect(entries.map((e) => e.actionType)).toEqual(["UPLOAD"]);
  });

  it("lists the document and returns a valid audit chain (UPLOAD then VIEW)", async () => {
    const list = await (await listDocs(get(admin), {})).json();
    expect(list.data.documents.some((d: { id: string }) => d.id === docId)).toBe(true);

    const res = await getDoc(get(admin), { params: { id: docId } });
    const body = await res.json();
    expect(body.data.chain.isValid).toBe(true);
    expect(body.data.auditLog.map((e: { actionType: string }) => e.actionType)).toEqual(["UPLOAD", "VIEW"]);
  });

  it("detects a tampered audit entry in the document view", async () => {
    // The trigger blocks UPDATE, so simulate tampering by skipping it for this transaction only.
    await db.$transaction([
      db.$executeRaw`ALTER TABLE audit_log_entries DISABLE TRIGGER trg_audit_immutable`,
      db.$executeRaw`UPDATE audit_log_entries SET actor_id = NULL WHERE document_id = ${docId} AND seq = 1`,
      db.$executeRaw`ALTER TABLE audit_log_entries ENABLE TRIGGER trg_audit_immutable`,
    ]);
    const body = await (await getDoc(get(admin), { params: { id: docId } })).json();
    expect(body.data.chain.isValid).toBe(false);
    expect(body.data.chain.brokenSeq).toBe(1);
  });

  it("hides documents from other organizations", async () => {
    const other = await loginAs("other");
    expect((await getDoc(get(other), { params: { id: docId } })).status).toBe(404);
  });

  it("verify: identical file is authentic", async () => {
    const body = await (await verify(fileReq(original), {})).json();
    expect(body.data.authentic).toBe(true);
    expect(body.data.document.title).toBe("Test doc");
  });

  it("verify: one flipped byte is rejected and the changed block is located", async () => {
    const tampered = Buffer.from(original);
    tampered[300 * 1024] ^= 0xff; // lives in block 1 (256-512 KB)
    const body = await (await verify(fileReq(tampered), {})).json();
    expect(body.data.authentic).toBe(false);
    expect(body.data.closestMatch.tamperedBlocks.map((b: { index: number }) => b.index)).toEqual([1]);
  });

  it("verify: requires a file", async () => {
    const res = await verify(new Request(url("/x"), { method: "POST", body: new FormData() }), {});
    expect(res.status).toBe(400);
  });
});
