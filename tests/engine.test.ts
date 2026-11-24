import { describe, expect, it } from "vitest";
import { evaluate, quietWindow, type CustomerCtx } from "../src/lib/intelligence/engine";

const all: CustomerCtx = {
  phone: "+15550293841", email: "c@x.test",
  consent: { whatsapp: true, email: true, call: true }, quietHours: null,
};
const now = new Date("2026-11-24T12:00:00Z");
const run = (intent: "purchase_completed" | "payment_failed" | "callback_requested", c: Partial<CustomerCtx> = {}, recovered = false, at = now) =>
  evaluate({ intent, purpose: "p", customer: { ...all, ...c }, now: at, recovered });

describe("decision matrix", () => {
  it("purchase_completed: WhatsApp and email, both independent", () => {
    const r = run("purchase_completed");
    expect(r.steps.map((s) => [s.channel, s.dependsOnStep])).toEqual([["whatsapp", null], ["email", null]]);
  });

  it("payment_failed: WhatsApp then email then call as chained fallbacks", () => {
    const r = run("payment_failed");
    expect(r.steps.map((s) => [s.channel, s.dependsOnStep])).toEqual([["whatsapp", null], ["email", 1], ["call", 2]]);
    expect(r.priority).toBe(90);
  });

  it("halts the whole plan once the customer has recovered", () => {
    const r = run("payment_failed", {}, true);
    expect(r.halted).toBe(true);
    expect(r.steps).toHaveLength(0);
    expect(r.reasonCodes).toContain("HALTED_RECOVERED");
  });

  it("callback_requested without a phone logs an explicit reason", () => {
    const r = run("callback_requested", { phone: null });
    expect(r.steps).toHaveLength(0);
    expect(r.excluded[0].reasonCodes).toEqual(expect.arrayContaining(["CALL_UNAVAILABLE", "EXCLUDED_NO_RECIPIENT"]));
  });
});

describe("policy gates", () => {
  it("excludes channels without consent and promotes the next fallback", () => {
    const r = run("payment_failed", { consent: { whatsapp: false, email: true, call: true } });
    expect(r.excluded).toEqual([{ step: 1, channel: "whatsapp", reasonCodes: ["EXCLUDED_NO_CONSENT"] }]);
    expect(r.steps[0]).toMatchObject({ channel: "email", dependsOnStep: null });
    expect(r.steps[0].reasonCodes).toContain("PROMOTED_TO_PRIMARY");
    expect(r.steps[1]).toMatchObject({ channel: "call", dependsOnStep: 2 });
  });

  it("treats missing consent as no consent", () => {
    expect(run("purchase_completed", { consent: {} }).steps).toHaveLength(0);
  });

  it("defers WhatsApp and calls (not email) during quiet hours", () => {
    const qh = { start: "22:00", end: "08:00", utcOffsetMinutes: 0 };
    const r = run("purchase_completed", { quietHours: qh }, false, new Date("2026-11-24T23:30:00Z"));
    expect(r.steps[0]).toMatchObject({ channel: "whatsapp", status: "deferred", notBefore: "2026-11-25T08:00:00.000Z" });
    expect(r.steps[1]).toMatchObject({ channel: "email", status: "eligible", notBefore: null });
    expect(r.gates.whatsapp.quietHours).toBe("active");
  });
});

describe("quietWindow", () => {
  const qh = { start: "22:00", end: "08:00", utcOffsetMinutes: 0 };
  it("is clear outside the window and respects the UTC offset", () => {
    expect(quietWindow(new Date("2026-11-24T12:00:00Z"), qh).inWindow).toBe(false);
    expect(quietWindow(new Date("2026-11-24T12:00:00Z"), { ...qh, utcOffsetMinutes: 600 }).inWindow).toBe(true); // 22:00 local
  });
});