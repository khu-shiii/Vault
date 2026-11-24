import { describe, expect, it, beforeAll } from "vitest";
import { randomBytes } from "crypto";
import { db } from "../src/lib/db";
import { signAccessToken } from "../src/lib/auth/tokens";
import { GET as analytics } from "../src/app/api/analytics/route";

let cookie: string;

beforeAll(async () => {
  const suffix = randomBytes(4).toString("hex");
  const org = await db.organization.create({ data: { name: `an-${suffix}` } });
  const user = await db.user.create({
    data: { organizationId: org.id, email: `an-${suffix}@test.local`, passwordHash: "x", role: "VIEWER" },
  });
  const token = await signAccessToken({ userId: user.id, email: user.email, role: "VIEWER", organizationId: org.id });
  cookie = `vault_access=${token}`;
});

describe("GET /api/analytics", () => {
  it("rejects requests without a session", async () => {
    const res = await analytics(new Request("http://localhost/api/analytics"), {});
    expect(res.status).toBe(401);
  });

  it("returns the three raw series for a logged-in user", async () => {
    const res = await analytics(
      new Request("http://localhost/api/analytics", { headers: { cookie } }),
      {}
    );
    expect(res.status).toBe(200);
    const body = (await res.json()).data;
    expect(Array.isArray(body.verifications)).toBe(true);
    expect(Array.isArray(body.events)).toBe(true);
    expect(Array.isArray(body.exclusions)).toBe(true);
  });
});