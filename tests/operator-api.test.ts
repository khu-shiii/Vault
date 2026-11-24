import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { db } from "../src/lib/db";
import { sha256 } from "../src/lib/crypto/merkle";
import { POST as identify } from "../src/app/v1/identify/route";
import { POST as batch } from "../src/app/v1/events/batch/route";
import { POST as evaluate } from "../src/app/v1/decisions/evaluate/route";
import { GET as listEvents } from "../src/app/v1/events/route";
import { GET as inspect } from "../src/app/v1/inspect/route";

const run = randomBytes(4).toString("hex");
const KEY_A = `vk_op_${run}_a`;
const KEY_B = `vk_op_${run}_b`;
const call = (key: string, body?: unknown, method = "POST", url = "http://localhost/x") =>
  new Request(url, { method, headers: { "x-api-key": key, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
let decisionId = "";
let documentId = "";

beforeAll(async () => {
  const [a, b] = await Promise.all([db.organization.create({ data: { name: `op-a-${run}` } }), db.organization.create({ data: { name: `op-b-${run}` } })]);
  for (const [org, key] of [[a.id, KEY_A], [b.id, KEY_B]] as const) {
    await db.apiKey.create({ data: { organizationId: org, label: "t", prefix: key.slice(0, 10), keyHash: sha256(key) } });
  }
  const doc = await db.document.create({
    data: { organizationId: a.id, title: "op-doc", fileHash: "a".repeat(64), merkleRoot: "b".repeat(64), fileSize: 1, mimeType: "text/plain" },
  });
  documentId = doc.id;
  await identify(call(KEY_A, { externalCustomerId: "op-c", traits: { phone: "+15550293841", email: "o@x.test", consent: { whatsapp: true, email: true, call: true } } }), {});
  await batch(call(KEY_A, { events: [{ eventId: `${run}-e1`, externalCustomerId: "op-c", eventName: "purchase_completed", occurredAt: "2026-11-20T10:00:00Z", source: "t", schemaVersion: 1 }] }), {});
  decisionId = (await (await evaluate(call(KEY_A, { externalCustomerId: "op-c" }), {})).json()).id;
});

describe("operator support endpoints", () => {
  it("lists recent events for the organization only", async () => {
    const a = await (await listEvents(call(KEY_A, undefined, "GET"), {})).json();
    const b = await (await listEvents(call(KEY_B, undefined, "GET"), {})).json();
    expect(a.events.map((e: { eventId: string }) => e.eventId)).toContain(`${run}-e1`);
    expect(b.events).toEqual([]);
  });

  it("inspect resolves customer, decision and document ids", async () => {
    const q = (key: string, term: string) => inspect(call(key, undefined, "GET", `http://localhost/v1/inspect?q=${encodeURIComponent(term)}`), {});
    const customer = await (await q(KEY_A, "op-c")).json();
    expect(customer.kind).toBe("customer");
    expect(customer.replay.map((f: { source: string }) => f.source)).toEqual(expect.arrayContaining(["sdk_client", "decision_engine"]));
    expect((await (await q(KEY_A, decisionId)).json()).kind).toBe("decision");
    expect((await (await q(KEY_A, documentId)).json()).kind).toBe("document");
  });

  it("inspect never crosses organizations and validates input", async () => {
    const q = (key: string, term: string) => inspect(call(key, undefined, "GET", `http://localhost/v1/inspect?q=${encodeURIComponent(term)}`), {});
    expect((await q(KEY_B, decisionId)).status).toBe(404);
    expect((await q(KEY_B, documentId)).status).toBe(404);
    expect((await q(KEY_A, "")).status).toBe(400);
  });
});