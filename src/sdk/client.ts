export interface VaultOptions {
  endpoint: string; // e.g. "http://localhost:3000"
  apiKey: string; // publishable demo key; use server-side keys in production
  batchSize?: number;
  flushIntervalMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  autoFlush?: boolean;
  onError?: (e: unknown) => void;
  fetchImpl?: typeof fetch;
  storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void };
}

interface QueuedEvent {
  eventId: string; externalCustomerId?: string; anonymousId: string; eventName: string;
  occurredAt: string; source: string; schemaVersion: 1; properties: Record<string, unknown>;
}

const uuid = (): string =>
  (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createVault(opts: VaultOptions) {
  const batchSize = opts.batchSize ?? 20;
  const maxRetries = opts.maxRetries ?? 4;
  const retryBaseMs = opts.retryBaseMs ?? 300;
  const doFetch: typeof fetch = (input, init) => (opts.fetchImpl ?? fetch)(input, init);
  const storage = opts.storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);

  let anonymousId = "";
  try { anonymousId = storage?.getItem("vault_anon") ?? ""; } catch { /* storage unavailable */ }
  if (!anonymousId) {
    anonymousId = uuid();
    try { storage?.setItem("vault_anon", anonymousId); } catch { /* ignore */ }
  }

  let externalCustomerId: string | undefined;
  let queue: QueuedEvent[] = [];
  let flushing: Promise<void> | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  /** Retries network errors, 429 and 5xx with exponential backoff. Other 4xx are returned, not retried. */
  async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
    let attempt = 0;
    for (;;) {
      try {
        const res = await doFetch(opts.endpoint + path, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": opts.apiKey },
          body: JSON.stringify(body),
        });
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
        return { status: res.status, json: await res.json().catch(() => null) };
      } catch (e) {
        if (attempt >= maxRetries) throw e;
        await sleep(retryBaseMs * Math.pow(2, attempt));
        attempt++;
      }
    }
  }

  function flush(): Promise<void> {
    if (!flushing) {
      const run = async () => {
        while (queue.length > 0) {
          const batch = queue.slice(0, batchSize);
          let r: { status: number; json: any };
          try {
            r = await post("/v1/events/batch", { events: batch });
          } catch (e) {
            opts.onError?.(e); // network down: keep the queue for the next flush
            return;
          }
          if (r.status !== 202) opts.onError?.({ status: r.status, body: r.json });
          else if (r.json?.rejected?.length) opts.onError?.({ rejected: r.json.errors ?? r.json.rejected });
          queue = queue.slice(batch.length); // accepted, duplicate and rejected are all resolved
        }
      };
      flushing = run().finally(() => {
        flushing = null;
      });
    }
    return flushing;
  }

  function startTimer() {
    if (opts.autoFlush === false || timer) return;
    timer = setInterval(() => void flush(), opts.flushIntervalMs ?? 5000);
  }

  return {
    anonymousId,
    async identify(id: string, traits?: Record<string, unknown>) {
      externalCustomerId = id;
      queue.forEach((e) => { e.externalCustomerId = id; });
      const r = await post("/v1/identify", { externalCustomerId: id, anonymousId, traits });
      if (r.status !== 200) throw new Error(`identify failed: ${r.status}`);
      return r.json;
    },
    track(eventName: string, properties: Record<string, unknown> = {}) {
      queue.push({
        eventId: uuid(), externalCustomerId, anonymousId, eventName, occurredAt: new Date().toISOString(),
        source: "web_browser", schemaVersion: 1, properties,
      });
      startTimer();
      if (queue.length >= batchSize) void flush();
    },
    flush,
    pending: () => queue.length,
    async shutdown() {
      if (timer) clearInterval(timer);
      timer = undefined;
      await flush();
    },
  };
}