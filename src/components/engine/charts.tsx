"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine,
} from "recharts";
import { formatNairaCompact } from "@/lib/format";
import { DONUT_COLORS } from "@/lib/portfolio/metrics";

const FRESH = "#4E9E6B";
const LOSS = "#C0392B";
const axisTick = { fontSize: 10, fill: "currentColor" };

function money(n: number): string {
  const s = formatNairaCompact(Math.abs(n));
  return n < 0 ? `−${s}` : s;
}

export function EquityCurveChart({ data }: { data: { date: string; cum: number }[] }) {
  if (!data.length) return <Empty label="No closed trades yet — the equity curve builds as positions realise." />;
  return (
    <div className="h-56 w-full text-ink/60">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={FRESH} stopOpacity={0.32} />
              <stop offset="100%" stopColor={FRESH} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} vertical={false} />
          <XAxis dataKey="date" tick={axisTick} tickFormatter={(d) => String(d).slice(5)} minTickGap={24} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} tickFormatter={money} width={52} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.25} />
          <Tooltip
            formatter={(v: number) => [money(v), "Cumulative realised"]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Area type="monotone" dataKey="cum" stroke={FRESH} strokeWidth={2.5} fill="url(#eqFill)" dot={{ r: 2, fill: FRESH }} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyPnlChart({
  data,
}: {
  data: { month: string; intraday: number; weekly: number; monthly: number; total: number }[];
}) {
  if (!data.length) return <Empty label="Monthly P&L appears once positions close." />;
  return (
    <div className="h-56 w-full text-ink/60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} vertical={false} />
          <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} tickFormatter={money} width={52} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.25} />
          <Tooltip formatter={(v: number, k) => [money(v), k]} cursor={{ fill: "currentColor", fillOpacity: 0.05 }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
          <Bar dataKey="intraday" stackId="p" fill="#8AC873" />
          <Bar dataKey="weekly" stackId="p" fill="#5FB0C9" />
          <Bar dataKey="monthly" stackId="p" fill="#C9A227" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AllocationDonut({ data }: { data: { label: string; value: number }[] }) {
  const rows = data.filter((d) => d.value > 0);
  if (!rows.length) return <Empty label="No capital deployed." />;
  return (
    <div className="h-56 w-full text-ink/60">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="label"
            innerRadius={45}
            outerRadius={80}
            paddingAngle={1}
            strokeWidth={0}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number, n) => [formatNairaCompact(v), n]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-56 items-center justify-center px-6 text-center">
      <p className="max-w-xs font-sans text-[12px] leading-relaxed text-ink/45">{label}</p>
    </div>
  );
}
