import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as refresh } from "../src/app/api/auth/refresh/route";
import { GET as listUsers, POST as createUser } from "../src/app/api/users/route";
import { PATCH as patchUser } from "../src/app/api/users/[id]/route";
import { GET as listEvents } from "../src/app/api/security-events/route";

const run = randomBytes(4).toString("hex");
const PW = "Test-Passw0rd!";
const email = (n: string) => `${n}-${run}@users.test`;
const cookieOf = (res: Response) =>
  res.headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => !c.endsWith("=")).join("; ");
const req = (method: string, cookie?: string, body?: unknown) =>
  new Request("http://localhost/x", {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
const loginAs = (n: string, pw = PW) => login(req("POST", undefined, { email: email(n), password: pw }), {});
const cookieFor = async (n: string) => cookieOf(await loginAs(n));
const patch = (cookie: string, id: string, body: unknown) => patchUser(req("PATCH", cookie, body), { params: { id } });

const ids: Record<string, string> = {};
const orgs: Record<string, string> = {};
let hash = "";

async function mk(name: string, org: string, role: "ADMIN" | "SIGNER" | "VIEWER") {
  const u = await db.user.create({ data: { organizationId: orgs[org], email: email(name), passwordHash: hash, role } });
  ids[name] = u.id;
}

beforeAll(async () => {
  hash = await hashPassword(PW);
  for (const o of ["A", "B", "C"]) orgs[o] = (await db.organization.create({ data: { name: `users-${o}-${run}` } })).id;
  await mk("a1", "A", "ADMIN");
  await mk("a3", "A", "ADMIN");
  await mk("signer", "A", "SIGNER");
  await mk("viewer", "A", "VIEWER");
  await mk("reset", "A", "VIEWER");
  await mk("disable", "A", "VIEWER");
  await mk("b1", "B", "ADMIN");
  await mk("c1", "C", "ADMIN");
  await mk("c2", "C", "ADMIN");
});

describe("access control", () => {
  it("401 without a session, 403 for non-admins", async () => {
    expect((await listUsers(req("GET"), {})).status).toBe(401);
    expect((await listUsers(req("GET", await cookieFor("signer")), {})).status).toBe(403);
    expect((await listUsers(req("GET", await cookieFor("viewer")), {})).status).toBe(403);
  });

  it("lists only the admin's own organization", async () => {
    const body = await (await listUsers(req("GET", await cookieFor("a1")), {})).json();
    const emails = body.data.users.map((u: { email: string }) => u.email);
    expect(emails).toContain(email("signer"));
    expect(emails).not.toContain(email("b1"));
  });

  it("cannot modify a user in another organization", async () => {
    const a1 = await cookieFor("a1");
    expect((await patch(a1, ids.b1, { role: "VIEWER" })).status).toBe(404);
  });
});

describe("creating users", () => {
  it("creates, rejects duplicates, weak passwords and bad roles", async () => {
    const a1 = await cookieFor("a1");
    const good = { email: email("created"), password: "A-long-password-1", role: "SIGNER" };
    const res = await createUser(req("POST", a1, good), {});
    expect(res.status).toBe(201);
    expect((await createUser(req("POST", a1, good), {})).status).toBe(409);
    expect((await createUser(req("POST", a1, { ...good, email: email("x1"), password: "short" }), {})).status).toBe(400);
    expect((await createUser(req("POST", a1, { ...good, email: email("x2"), role: "PUBLIC_VERIFIER" }), {})).status).toBe(400);
    expect((await loginAs("created", "A-long-password-1")).status).toBe(200);
  });
});

describe("protecting admins", () => {
  it("cannot change own role or disable self", async () => {
    const a1 = await cookieFor("a1");
    expect((await patch(a1, ids.a1, { role: "VIEWER" })).status).toBe(400);
    expect((await patch(a1, ids.a1, { disabled: true })).status).toBe(400);
  });

  it("a demoted admin loses admin access immediately", async () => {
    const a1 = await cookieFor("a1");
    const a3 = await cookieFor("a3");
    expect((await listUsers(req("GET", a3), {})).status).toBe(200);
    expect((await patch(a1, ids.a3, { role: "SIGNER" })).status).toBe(200);
    expect((await listUsers(req("GET", a3), {})).status).toBe(403); // same access token, fresh DB check
  });

  it("two admins demoting each other concurrently leaves one admin", async () => {
    const [c1, c2] = [await cookieFor("c1"), await cookieFor("c2")];
    const results = await Promise.all([patch(c1, ids.c2, { role: "SIGNER" }), patch(c2, ids.c1, { role: "SIGNER" })]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    const admins = await db.user.count({ where: { organizationId: orgs.C, role: "ADMIN", disabledAt: null } });
    expect(admins).toBeGreaterThanOrEqual(1);
  });
});

describe("password reset and disabling", () => {
  it("reset ends old sessions and the old password stops working", async () => {
    const a1 = await cookieFor("a1");
    const oldSession = await cookieFor("reset");
    expect((await patch(a1, ids.reset, { password: "Brand-new-pass-1" })).status).toBe(200);
    expect((await refresh(req("POST", oldSession), {})).status).toBe(401);
    expect((await loginAs("reset")).status).toBe(401);
    expect((await loginAs("reset", "Brand-new-pass-1")).status).toBe(200);
  });

  it("disabled users cannot log in or refresh; enabling restores access", async () => {
    const a1 = await cookieFor("a1");
    const session = await cookieFor("disable");
    expect((await patch(a1, ids.disable, { disabled: true })).status).toBe(200);
    expect((await loginAs("disable")).status).toBe(403);
    expect((await refresh(req("POST", session), {})).status).toBe(401);
    expect((await patch(a1, ids.disable, { disabled: false })).status).toBe(200);
    expect((await loginAs("disable")).status).toBe(200);
  });
});

describe("security events", () => {
  it("records admin actions", async () => {
    const body = await (await listEvents(req("GET", await cookieFor("a1")), {})).json();
    const actions = body.data.events.map((e: { action: string }) => e.action);
    for (const a of ["USER_CREATED", "USER_ROLE_CHANGED", "USER_PASSWORD_RESET", "USER_DISABLED", "USER_ENABLED"]) {
      expect(actions).toContain(a);
    }
  });
});