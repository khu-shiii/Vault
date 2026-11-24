"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface DayRow {
  day: string;
  verified: number;
  failed: number;
  events: number;
  excluded: number;
  successRate: number;
}

export default function AnalyticsCharts({ daily }: { daily: DayRow[] }) {
  if (daily.length === 0) return <p className="text-sm text-slate-500">No data in the last 30 days.</p>;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section>
        <h3 className="mb-2 font-semibold">Verifications per day</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="verified" name="Authentic" fill="#16a34a" stackId="v" />
            <Bar dataKey="failed" name="Not authentic" fill="#dc2626" stackId="v" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h3 className="mb-2 font-semibold">Verification success rate (%)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="successRate" name="Success rate" stroke="#2563eb" />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h3 className="mb-2 font-semibold">SDK event volume</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="events" name="Events" stroke="#7c3aed" />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h3 className="mb-2 font-semibold">Policy exclusions</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="excluded" name="Excluded actions" fill="#ea580c" />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}