"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { DONUT_COLORS, type SectorSlice } from "@/lib/portfolio/metrics";
import { formatPercent } from "@/lib/format";

export function SectorDonut({ data }: { data: SectorSlice[] }) {
  if (!data.length) {
    return (
      <p className="py-8 text-center font-sans text-[12px] text-ink/40">
        Add holdings to see sector allocation.
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="pct"
              nameKey="sector"
              innerRadius={45}
              outerRadius={80}
              paddingAngle={1}
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E8E6E0" }}
              formatter={(v: any, n: any) => [formatPercent(Number(v)), n]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-1">
        {data.map((s, i) => (
          <li key={s.sector} className="flex items-center gap-2 text-[12px]">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="flex-1 truncate text-ink/70">{s.sector}</span>
            <span className="font-semibold tabular-nums text-forest">
              {formatPercent(s.pct)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
