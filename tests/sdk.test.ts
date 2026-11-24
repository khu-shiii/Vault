import { describe, expect, it, vi } from "vitest";
import { createVault } from "../src/sdk/client";

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("SDK client", () => {
  it("retries a network failure and resends the SAME eventIds", async () => {
    const bodies: any[] = [];
    let calls = 0;
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      calls++;
      bodies.push(JSON.parse(String(init?.body)));
      if (calls === 1) throw new Error("network down");
      return reply(202, { accepted: bodies[1].events.map((e: any) => e.eventId), duplicates: [], rejected: [] });
    }) as unknown as typeof fetch;

    const vault = createVault({ endpoint: "http://x", apiKey: "k", fetchImpl, storage: mem(), autoFlush: false, retryBaseMs: 1 });
    vault.track("payment_failed", { orderId: "o1" });
    await vault.flush();

    expect(calls).toBe(2);
    expect(bodies[0].events[0].eventId).toBe(bodies[1].events[0].eventId);
    expect(vault.pending()).toBe(0);
  });

  it("keeps the queue when retries are exhausted", async () => {
    const errors: unknown[] = [];
    const fetchImpl = vi.fn(async () => { throw new Error("down"); }) as unknown as typeof fetch;
    const vault = createVault({ endpoint: "http://x", apiKey: "k", fetchImpl, storage: mem(), autoFlush: false, retryBaseMs: 1, maxRetries: 1, onError: (e) => errors.push(e) });
    vault.track("a");
    await vault.flush();
    expect(vault.pending()).toBe(1);
    expect(errors).toHaveLength(1);
  });

  it("does not retry a 4xx and drops the bad batch", async () => {
    const fetchImpl = vi.fn(async () => reply(400, { success: false })) as unknown as typeof fetch;
    const vault = createVault({ endpoint: "http://x", apiKey: "k", fetchImpl, storage: mem(), autoFlush: false, retryBaseMs: 1 });
    vault.track("a");
    await vault.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(vault.pending()).toBe(0);
  });

  it("identify sends the anonymousId and tags queued events", async () => {
    const calls: any[] = [];
    const fetchImpl = vi.fn(async (url: any, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return reply(200, { customerId: "c", externalCustomerId: "cust_1", linkedEvents: 0 });
    }) as unknown as typeof fetch;
    const vault = createVault({ endpoint: "http://x", apiKey: "k", fetchImpl, storage: mem(), autoFlush: false });
    vault.track("page_view");
    await vault.identify("cust_1", { phone: "+15550293841" });
    expect(calls[0].url).toBe("http://x/v1/identify");
    expect(calls[0].body.anonymousId).toBe(vault.anonymousId);
  });
});