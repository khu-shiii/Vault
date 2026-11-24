import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { db } from "../src/lib/db";
import { sha256 } from "../src/lib/crypto/merkle";
import { POST as identify } from "../src/app/v1/identify/route";
import { POST as batch } from "../src/app/v1/events/batch/route";
import { POST as interaction } from "../src/app/v1/interaction-events/route";
import { GET as timeline } from "../src/app/v1/customers/[id]/timeline/route";
import { POST as evaluate } from "../src/app/v1/decisions/evaluate/route";
import { GET as getDecision } from "../src/app/v1/decisions/[id]/route";
import { POST as dispatch } from "../src/app/v1/decisions/[id]/dispatch/route";
import { POST as mockAction } from "../src/app/v1/mock/actions/route";

const run = randomBytes(4).toString("hex");
const KEY_A = `vk_test_${run}_a`;
const KEY_B = `vk_test_${run}_b`;
const ALL = { whatsapp: true, email: true, call: true };
let orgA = "";

const call = (key: string | null, body?: unknown, method = "POST") =>
  new Request("http://localhost/x", {
    method,
    headers: { ...(key ? { "x-api-key": key } : {}), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ev = (id: string, name: string, customer: string, at: string, props: Record<string, unknown> = {}) => ({
  eventId: `${run}-${id}`, externalCustomerId: customer, eventName: name, occurredAt: at,
  source: "web_browser", schemaVersion: 1, properties: props,
});
const ident = (customer: string, traits: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  identify(call(KEY_A, { externalCustomerId: customer, traits, ...extra }), {});
const ingest = (events: unknown[]) => batch(call(KEY_A, { events }), {});
const decide = async (customer: string, now?: string) =>
  (await (await evaluate(call(KEY_A, { externalCustomerId: customer, now }), {})).json()) as Record<string, any>;
const go = async (id: string, now?: string) =>
  (await (await dispatch(call(KEY_A, { now }), { params: { id } })).json()) as Record<string, any>;
const show = async (id: string, key = KEY_A) => getDecision(call(key, undefined, "GET"), { params: { id } });
const deliver = (customer: string, actionId: string, status: string, n: string) =>
  interaction(call(KEY_A, { externalCustomerId: customer, type: "delivery_status", actionId, status, interactionId: `${run}-${n}` }), {});
const phone = { phone: "+15550293841", email: "c@x.test", consent: ALL };

beforeAll(async () => {
  const [a, b] = await Promise.all([db.organization.create({ data: { name: `v1-a-${run}` } }), db.organization.create({ data: { name: `v1-b-${run}` } })]);
  orgA = a.id;
  for (const [org, key] of [[a.id, KEY_A], [b.id, KEY_B]] as const) {
    await db.apiKey.create({ data: { organizationId: org, label: "t", prefix: key.slice(0, 10), keyHash: sha256(key) } });
  }
});

describe("auth and intake", () => {
  it("rejects missing and unknown API keys", async () => {
    expect((await batch(call(null, { events: [] }), {})).status).toBe(401);
    expect((await batch(call("vk_nope", { events: [] }), {})).status).toBe(401);
  });

  it("links anonymous events when the customer is identified", async () => {
    await ingest([{ eventId: `${run}-anon`, anonymousId: "anon-1", eventName: "page_view", occurredAt: "2026-11-20T09:00:00Z", source: "web_browser", schemaVersion: 1 }]);
    const body = await (await ident("c-pay", phone, { anonymousId: "anon-1" })).json();
    expect(body.linkedEvents).toBe(1);
  });

  it("returns accepted, duplicates and rejected (PRD contract)", async () => {
    const good = ev("p1", "payment_failed", "c-pay", "2026-11-20T10:00:00Z", { documentTitle: "NDA.pdf", attemptCount: 2 });
    const first = await ingest([good]);
    expect(first.status).toBe(202);
    expect(await first.json()).toMatchObject({ accepted: [good.eventId], duplicates: [], rejected: [] });

    const again = await (await ingest([good, { ...good, eventId: `${run}-bad`, schemaVersion: 2 }])).json();
    expect(again.duplicates).toEqual([good.eventId]);
    expect(again.accepted).toEqual([]);
    expect(again.rejected).toEqual([`${run}-bad`]);
  });
});

describe("payment_failed fallback chain", () => {
  let decisionId = "";
  let actions: any[] = [];

  it("evaluates once; re-evaluating the same trigger reuses the decision", async () => {
    const d = await decide("c-pay", "2026-11-20T12:00:00Z");
    expect(d.intent).toBe("payment_failed");
    expect(d.steps).toHaveLength(3);
    expect(d.steps[1].dependsOnStep).toBe(1);
    decisionId = d.id;
    const again = await decide("c-pay", "2026-11-20T12:00:00Z");
    expect(again.id).toBe(decisionId);
    expect(again.reused).toBe(true);
  });

  it("dispatch sends only the first step, labels everything mock, and is idempotent", async () => {
    const r = await go(decisionId);
    expect(r.actions.map((a: any) => a.status)).toEqual(["accepted", "queued", "queued"]);
    expect(r.actions.every((a: any) => a.mock === true)).toBe(true);
    const r2 = await go(decisionId);
    expect(r2.actions.map((a: any) => a.actionId)).toEqual(r.actions.map((a: any) => a.actionId));
    actions = r2.actions;
    expect(await db.action.count({ where: { decisionId } })).toBe(3);
  });

  it("a failed WhatsApp triggers the email, a timed-out email triggers the call", async () => {
    const r1 = await (await deliver("c-pay", actions[0].actionId, "failed", "i1")).json();
    expect(r1.actionStatus).toBe("failed");
    expect((await (await deliver("c-pay", actions[0].actionId, "failed", "i1")).json()).duplicate).toBe(true);
    await deliver("c-pay", actions[1].actionId, "timeout", "i2");
    const d = await (await show(decisionId)).json();
    expect(d.actions.map((a: any) => a.status)).toEqual(["failed", "timeout", "accepted"]);
  });

  it("timeline merges SDK and synthetic origins in time order", async () => {
    const body = await (await timeline(call(KEY_A, undefined, "GET"), { params: { id: "c-pay" } })).json();
    const origins = body.items.map((i: any) => i.origin);
    expect(origins).toEqual(expect.arrayContaining(["sdk_client", "synthetic_simulation"]));
    const times = body.items.map((i: any) => new Date(i.occurredAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe("halting, consent and quiet hours", () => {
  it("payment_recovered halts the remaining fallback steps immediately", async () => {
    await ident("c-rec", phone);
    await ingest([ev("r1", "payment_failed", "c-rec", "2026-11-20T10:00:00Z")]);
    const d = await decide("c-rec");
    await go(d.id);
    await ingest([ev("r2", "payment_recovered", "c-rec", "2026-11-20T11:00:00Z")]);
    const after = await (await show(d.id)).json();
    expect(after.actions.map((a: any) => a.status)).toEqual(["accepted", "halted", "halted"]);
  });

  it("excludes a channel without consent and logs the reason", async () => {
    await ident("c-nc", { ...phone, consent: { whatsapp: false, email: true, call: true } });
    await ingest([ev("n1", "payment_failed", "c-nc", "2026-11-20T10:00:00Z")]);
    const d = await decide("c-nc");
    expect(d.excluded[0]).toMatchObject({ channel: "whatsapp", reasonCodes: ["EXCLUDED_NO_CONSENT"] });
    expect(d.steps[0]).toMatchObject({ channel: "email", dependsOnStep: null });
  });

  it("revoking consent via an interaction affects later decisions", async () => {
    await ident("c-rev", phone);
    await interaction(call(KEY_A, { externalCustomerId: "c-rev", type: "consent_change", payload: { channel: "email", granted: false } }), {});
    await ingest([ev("v1", "purchase_completed", "c-rev", "2026-11-20T10:00:00Z")]);
    const d = await decide("c-rev");
    expect(d.steps.map((s: any) => s.channel)).toEqual(["whatsapp"]);
  });

  it("defers during quiet hours and releases once the window ends", async () => {
    await ident("c-q", { ...phone, quietHours: { start: "22:00", end: "08:00", utcOffsetMinutes: 0 } });
    await ingest([ev("q1", "purchase_completed", "c-q", "2026-11-24T23:00:00Z")]);
    const d = await decide("c-q", "2026-11-24T23:30:00Z");
    expect(d.steps[0].status).toBe("deferred");
    const night = await go(d.id, "2026-11-24T23:30:00Z");
    expect(night.actions.map((a: any) => a.status)).toEqual(["deferred", "accepted"]); // email is not quiet-gated
    const morning = await go(d.id, "2026-11-25T08:05:00Z");
    expect(morning.actions.map((a: any) => a.status)).toEqual(["accepted", "accepted"]);
  });

  it("applies organization-defined event mappings", async () => {
    await db.organization.update({ where: { id: orgA }, data: { eventMappings: { loan_declined: { intent: "payment_failed", purpose: "loan_followup" } } } });
    await ident("c-map", phone);
    await ingest([ev("m1", "loan_declined", "c-map", "2026-11-20T10:00:00Z")]);
    const d = await decide("c-map");
    expect(d).toMatchObject({ intent: "payment_failed", purpose: "loan_followup" });
  });
});

describe("isolation and transport contract", () => {
  it("another organization cannot read a decision", async () => {
    const d = await decide("c-pay", "2026-11-20T12:00:00Z");
    expect((await show(d.id, KEY_B)).status).toBe(404);
  });

  it("mock transport accepts valid requests (mock:true) and rejects invalid ones", async () => {
    const valid = {
      actionId: "a1", decisionId: "d1", externalCustomerId: "c", channel: "whatsapp", purpose: "p", action: "send_message",
      recipient: { phone: "+15550293841" }, content: { type: "template", templateKey: "t", parameters: {} },
      reasonCodes: ["X"], idempotencyKey: "d1:whatsapp:1",
    };
    const ok = await mockAction(call(KEY_A, valid), {});
    expect(ok.status).toBe(202);
    expect(await ok.json()).toEqual({ actionId: "a1", status: "accepted", mock: true });
    expect((await mockAction(call(KEY_A, { ...valid, channel: "sms" }), {})).status).toBe(400);
  });
});