"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryBreakdown } from "@/lib/cpi/calculate";

type Props = {
  breakdown: CategoryBreakdown[];
  officialYoy: number | null;
  personalYoy: number;
};

export function CategoryBreakdownChart({
  breakdown,
  officialYoy,
  personalYoy,
}: Props) {
  // Color each bar relative to the official headline if available, otherwise
  // relative to the user's personal CPI.
  const benchmark = officialYoy ?? personalYoy;
  const data = breakdown.map((b) => ({
    name: b.short_name,
    yoy: Number(b.yoy_pct.toFixed(2)),
    weight: Number((b.user_weight * 100).toFixed(1)),
    color: b.yoy_pct > benchmark ? "#dc2626" : "#059669",
  }));

  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
        >
          <CartesianGrid stroke="rgb(0 0 0 / 0.06)" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 12, fill: "currentColor" }}
            stroke="currentColor"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 12, fill: "currentColor" }}
            stroke="currentColor"
          />
          {officialYoy != null && (
            <ReferenceLine
              x={Number(officialYoy.toFixed(2))}
              stroke="#525252"
              strokeDasharray="4 3"
              label={{
                value: `Official ${officialYoy.toFixed(1)}%`,
                position: "insideTopRight",
                fontSize: 11,
                fill: "currentColor",
              }}
            />
          )}
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.08)",
            }}
            formatter={(_v, _n, item) => {
              const p = item.payload as { yoy: number; weight: number };
              return [`${p.yoy}% YoY · ${p.weight}% of spend`, "Inflation"];
            }}
          />
          <Bar dataKey="yoy" radius={[0, 6, 6, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Personal CPI over time — one point per period that has YoY for the
// headline AND coverage of the user's spending. Empty/sparse series renders
// as an empty-state card instead of a chart.
export type SeriesPoint = {
  period: string;
  personal_yoy: number;
  official_yoy: number | null;
};

export function PersonalCpiTimeSeries({ series }: { series: SeriesPoint[] }) {
  if (series.length < 2) {
    return (
      <div className="rounded-2xl border border-black/5 bg-white p-6 text-sm text-zinc-600 shadow-sm dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-400">
        <p className="font-medium text-zinc-800 dark:text-zinc-200">
          Not enough history yet.
        </p>
        <p className="mt-1">
          {series.length === 0
            ? "We'll plot your personal CPI here once data lands for at least two periods with year-on-year inflation."
            : "We have one period with YoY data so far — a second one will start the line."}
        </p>
      </div>
    );
  }

  const data = series.map((s) => ({
    period: new Date(s.period).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
    personal: Number(s.personal_yoy.toFixed(2)),
    official: s.official_yoy != null ? Number(s.official_yoy.toFixed(2)) : null,
  }));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="rgb(0 0 0 / 0.06)" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 12, fill: "currentColor" }}
            stroke="currentColor"
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 12, fill: "currentColor" }}
            stroke="currentColor"
            width={48}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)" }}
            formatter={(value) => {
              const n = typeof value === "number" ? value : Number(value);
              return Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="personal"
            name="Your CPI"
            stroke="#059669"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="official"
            name="Official"
            stroke="#737373"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={{ r: 2 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
