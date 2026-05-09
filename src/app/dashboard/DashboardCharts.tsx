"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
