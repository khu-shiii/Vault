// Browser fetch wrapper: unwraps { success, data }, refreshes the session once on 401.
let refreshing: Promise<boolean> | null = null;
const refreshSession = () =>
  (refreshing ??= fetch("/api/auth/refresh", { method: "POST" })
    .then((r) => r.ok)
    .finally(() => {
      refreshing = null;
    }));

const AUTHLESS = ["/api/auth/login", "/api/auth/refresh", "/api/auth/logout"];

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  let res = await fetch(path, init);
  if (res.status === 401 && !AUTHLESS.includes(path) && (await refreshSession())) {
    res = await fetch(path, init);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    if (res.status === 401 && !AUTHLESS.includes(path)) window.location.href = "/login";
    throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  }
  return json.data as T;
}
