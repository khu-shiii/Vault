"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { DayRow } from "@/components/analytics/AnalyticsCharts";

const AnalyticsCharts = dynamic(() => import("@/components/analytics/AnalyticsCharts"), {
  ssr: false,
  loading: () => <p className="text-sm text-slate-500">Loading charts…</p>,
});

interface Raw {
  verifications: { at: string; authentic: boolean }[];
  events: { at: string }[];
  exclusions: { at: string; count: number }[];
}

interface Anomalies {
  model: string;
  days: { day: string; count: number; z: number; flagged: boolean }[];
}

export default function AnalyticsPage() {
  const [raw, setRaw] = useState<Raw | null>(null);
  const [anomalies, setAnomalies] = useState<Anomalies | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/analytics", { credentials: "same-origin" });
      if (!r.ok) {
        setError("Could not load analytics. Make sure you are logged in.");
        return;
      }
      setRaw((await r.json()).data as Raw);

      // The anomaly service is optional. If it is down, the charts still work.
      const a = await fetch("/api/analytics/anomalies", { credentials: "same-origin" });
      if (a.ok) setAnomalies((await a.json()).data as Anomalies);
    })().catch(() => setError("Network error while loading analytics."));
  }, []);

  // Groups large raw logs by day once per data change, not on every render.
  const daily = useMemo<DayRow[]>(() => {
    if (!raw) return [];
    const map = new Map<string, Omit<DayRow, "successRate">>();
    const row = (day: string) => {
      let r = map.get(day);
      if (!r) {
        r = { day, verified: 0, failed: 0, events: 0, excluded: 0 };
        map.set(day, r);
      }
      return r;
    };
    for (const v of raw.verifications) {
      const r = row(v.at.slice(0, 10));
      if (v.authentic) r.verified += 1;
      else r.failed += 1;
    }
    for (const e of raw.events) row(e.at.slice(0, 10)).events += 1;
    for (const x of raw.exclusions) row(x.at.slice(0, 10)).excluded += x.count;

    return [...map.values()]
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((r) => {
        const total = r.verified + r.failed;
        return { ...r, successRate: total ? Math.round((100 * r.verified) / total) : 0 };
      });
  }, [raw]);

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-slate-600">Last 30 days for your organisation.</p>
      </header>

      {error && <p role="alert" className="text-red-700">{error}</p>}
      {!raw && !error && <p className="text-sm text-slate-500">Loading…</p>}

      {raw && <AnalyticsCharts daily={daily} />}

      {anomalies && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Unusual event days ({anomalies.model})</h2>
          {anomalies.days.length === 0 ? (
            <p className="text-sm text-slate-500">Not enough data to score yet (needs at least 2 days).</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {anomalies.days
                .filter((d) => d.flagged)
                .map((d) => (
                  <li key={d.day}>
                    {d.day}: {d.count} events (z = {d.z})
                  </li>
                ))}
              {anomalies.days.every((d) => !d.flagged) && <li>No unusual days found.</li>}
            </ul>
          )}
          <p className="mt-2 text-xs text-slate-500">
            This is a simple statistical heuristic, not a trained model. It flags days far from the average.
          </p>
        </section>
      )}
    </main>
  );
}