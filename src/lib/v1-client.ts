import { refreshSession } from "./client";

/** Browser fetch for /v1 routes (bare JSON, session cookie auth). Refreshes the session once on 401. */
export async function v1<T = any>(path: string, init?: RequestInit): Promise<T> {
  const run = () => fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  let res = await run();
  if (res.status === 401 && (await refreshSession())) res = await run();
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") window.location.href = "/login";
    throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  }
  return json as T;
}

export const post = <T = any>(path: string, body: unknown) => v1<T>(path, { method: "POST", body: JSON.stringify(body) });