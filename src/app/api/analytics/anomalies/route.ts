import { ApiError, handle, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Daily SDK event counts for 30 days, scored by the FastAPI service. */
export const GET = handle(async (req) => {
  const user = await requirePermission(req, "document:read");
  const since = new Date(Date.now() - 30 * 86_400_000);

  const events = await db.sdkEvent.findMany({
    where: { organizationId: user.organizationId, receivedAt: { gte: since } },
    select: { receivedAt: true },
    take: 20000,
  });

  const byDay = new Map<string, number>();
  for (const e of events) {
    const d = e.receivedAt.toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const days = [...byDay.keys()].sort();
  const values = days.map((d) => byDay.get(d) ?? 0);

  if (values.length < 2) return ok({ model: "none", days: [] });

  const base = process.env.ANOMALY_URL;
  if (!base) throw new ApiError(503, "ANOMALY_UNAVAILABLE", "ANOMALY_URL is not set");

  let res: Response;
  try {
    res = await fetch(`${base}/score`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values, threshold: 3 }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    throw new ApiError(503, "ANOMALY_UNAVAILABLE", "Anomaly service did not respond");
  }
  if (!res.ok) throw new ApiError(503, "ANOMALY_UNAVAILABLE", "Anomaly service returned an error");

  const scored = (await res.json()) as { model: string; scores: number[]; anomalies: number[] };
  return ok({
    model: scored.model,
    days: days.map((day, i) => ({
      day,
      count: values[i],
      z: scored.scores[i],
      flagged: scored.anomalies.includes(i),
    })),
  });
});