import { ApiError } from "./api";

// In-memory sliding window. Per-process only; swap for Redis if you scale out.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    throw new ApiError(429, "RATE_LIMITED", "Too many requests, try again later");
  }
  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (now - v[v.length - 1] >= windowMs) hits.delete(k);
  }
}
