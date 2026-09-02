"use client";

import { useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNgx } from "@/hooks/useNgx";
import { useIsDark } from "@/hooks/useIsDark";
import { Panel, TileBody } from "@/components/ui/Tile";
import { Delta } from "@/components/ui/Delta";
import { ForecastDisclaimer } from "./ForecastDisclaimer";
import { formatNaira, formatNumber, formatPercent } from "@/lib/format";
import { forecast, seedFromString } from "@/lib/forecast/engine";
import { PngExportButton } from "@/components/ui/ExportButtons";
import type { CompanyChart } from "@/lib/ngx/types";

// Chart palette — chosen per theme so every mark reads on both the light sand
// surface and the dark forest surface (the old #052A22 history line vanished
// on dark).
function chartPalette(dark: boolean) {
  return dark
    ? {
        history: "#E4EDE4",
        median: "#9FE08A",
        band: "#8AC873",
        grid: "rgba(223,230,223,0.10)",
        ref: "rgba(223,230,223,0.30)",
        today: "#8AC873",
        axis: "rgba(223,230,223,0.55)",
      }
    : {
        history: "#0B3B2E",
        median: "#1F7A54",
        band: "#8AC873",
        grid: "#EAE8E2",
        ref: "rgba(26,26,26,0.28)",
        today: "#1A4D40",
        axis: "rgba(26,26,26,0.5)",
      };
}

const HORIZONS = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
] as const;

interface ForecastRow {
  date: string;
  actual: number | null;
  median: number | null;
  band90?: [number, number];
  band50?: [number, number];
}

// Add `n` business days to a base date (rough calendar for future x-axis labels).
function addBusinessDays(base: Date, n: number): string {
  const d = new Date(base);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

export function AiForecastTab({ symbol }: { symbol: string }) {
  const [months, setMonths] = useState(12);
  const query = useNgx<CompanyChart>(`companies/${symbol}/chart`);

  return (
    <div className="space-y-4">
      <ForecastDisclaimer />
      <Panel
        title="AI price forecast · Monte Carlo ensemble"
        subtitle="2,000 simulated paths from fitted drift & volatility"
        right={
          <div className="flex overflow-hidden rounded-md border border-stone text-[11px] font-semibold">
            {HORIZONS.map((h) => (
              <button
                key={h.label}
                onClick={() => setMonths(h.months)}
                className={
                  h.months === months
                    ? "bg-forest px-2.5 py-1 text-[#F5F2EC]"
                    : "bg-surface px-2.5 py-1 text-ink/50 hover:bg-sand"
                }
              >
                {h.label}
              </button>
            ))}
          </div>
        }
      >
        <TileBody query={query} isEmpty={(d) => !d?.data?.length}>
          {(chart) => <ForecastBody chart={chart} symbol={symbol} months={months} />}
        </TileBody>
      </Panel>
    </div>
  );
}

function ForecastBody({
  chart,
  symbol,
  months,
}: {
  chart: CompanyChart;
  symbol: string;
  months: number;
}) {
  const closes = useMemo(
    () => chart.data.map((p) => p.close ?? p.price).filter((v): v is number => v != null && v > 0),
    [chart.data]
  );

  const result = useMemo(
    () => forecast(closes, { paths: 2000, horizonDays: 252, seed: seedFromString(symbol) }),
    [closes, symbol]
  );

  const selectedDays = Math.round((months / 12) * 252);
  const horizon =
    result.horizons.find((h) => h.months === months) ?? result.horizons[result.horizons.length - 1];

  // Build combined history + forecast series for the fan chart.
  const series = useMemo(() => {
    const histWindow = Math.min(126, chart.data.length);
    const hist = chart.data.slice(-histWindow).map((p) => ({
      date: p.date,
      actual: p.close ?? p.price,
      median: null as number | null,
      band90: undefined as [number, number] | undefined,
      band50: undefined as [number, number] | undefined,
    }));
    const lastPrice = result.stats.lastPrice;
    const base = new Date(chart.data.at(-1)?.date ?? new Date().toISOString().slice(0, 10));
    // Join point: continue the median line from the last actual.
    const joined = { ...hist[hist.length - 1], median: lastPrice, band90: [lastPrice, lastPrice] as [number, number], band50: [lastPrice, lastPrice] as [number, number] };
    hist[hist.length - 1] = joined;

    const fc: typeof hist = [];
    for (let step = 5; step <= selectedDays; step += 5) {
      const b = result.bands[step];
      if (!b) continue;
      fc.push({
        date: addBusinessDays(base, step),
        actual: null,
        median: b.p50,
        band90: [b.p10, b.p90],
        band50: [b.p25, b.p75],
      });
    }
    return [...hist, ...fc];
  }, [chart.data, result, selectedDays]);

  const { stats } = result;
  const chartRef = useRef<HTMLDivElement>(null);
  const isDark = useIsDark();
  const c = chartPalette(isDark);
  const joinDate = chart.data.at(-1)?.date ?? series[series.length - 1]?.date;

  return (
    <div className="space-y-4">
      {/* Scenario cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <ScenarioCard label="Bear (P10)" price={horizon.bear} ret={horizon.bearReturnPct} tone="down" />
        <ScenarioCard label="Base (P50)" price={horizon.base} ret={horizon.baseReturnPct} tone="base" />
        <ScenarioCard label="Bull (P90)" price={horizon.bull} ret={horizon.bullReturnPct} tone="up" />
      </div>

      <div className="flex justify-end">
        <PngExportButton targetRef={chartRef} filename={`${symbol}-forecast`} label="Chart PNG" />
      </div>

      {/* Fan chart */}
      <div ref={chartRef} className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 10, bottom: 0, left: -8 }}>
            <defs>
              {/* Outer P10–P90 and inner P25–P75 bands: soft top-down gradients
                  so the fan reads as probability density, not a solid slab. */}
              <linearGradient id="fc-band-outer" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.band} stopOpacity={0.22} />
                <stop offset="100%" stopColor={c.band} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fc-band-inner" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.band} stopOpacity={0.42} />
                <stop offset="100%" stopColor={c.band} stopOpacity={0.16} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: c.axis }}
              minTickGap={44}
              tickLine={false}
              axisLine={{ stroke: c.grid }}
              tickFormatter={(d: string) => (d?.length >= 7 ? d.slice(2) : d)}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 9, fill: c.axis }}
              width={48}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatNumber(v, 0)}
            />
            <Tooltip content={<ForecastTooltip dark={isDark} />} />
            {/* Outer then inner probability bands (range areas). */}
            <Area dataKey="band90" stroke="none" fill="url(#fc-band-outer)" isAnimationActive={false} connectNulls />
            <Area dataKey="band50" stroke="none" fill="url(#fc-band-inner)" isAnimationActive={false} connectNulls />
            {/* Last-traded reference + the history↔forecast divider. */}
            <ReferenceLine y={stats.lastPrice} stroke={c.ref} strokeDasharray="2 3" />
            <ReferenceLine
              x={joinDate}
              stroke={c.today}
              strokeDasharray="3 3"
              strokeOpacity={0.7}
              label={{ value: "Today", position: "insideTopRight", fontSize: 9, fill: c.today }}
            />
            <Line dataKey="actual" stroke={c.history} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
            <Line dataKey="median" stroke={c.median} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-sm" style={{ backgroundColor: c.history }} /> Historical
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-sm border-t-2 border-dashed" style={{ borderColor: c.median }} /> Median · P50
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: c.band, opacity: 0.4 }} /> P25–P75
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: c.band, opacity: 0.18 }} /> P10–P90
        </span>
      </div>

      {/* Model diagnostics */}
      <div>
        <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest">
          Model diagnostics
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Diag label="Ann. drift" value={formatPercent(stats.annualDrift)} />
          <Diag label="Ann. volatility" value={formatPercent(stats.annualVol)} />
          <Diag label="Trend fit R²" value={stats.r2.toFixed(2)} />
          <Diag
            label="Backtest error"
            value={stats.backtestMape != null ? `${stats.backtestMape.toFixed(1)}%` : "—"}
            hint="1-mo walk-forward MAPE"
          />
          <Diag label="History used" value={`${stats.sampleDays}d`} />
          <Diag label="Last price" value={formatNaira(stats.lastPrice)} />
        </div>
        <p className="mt-2 font-sans text-[10px] leading-relaxed text-ink/45">
          Drift is a damped blend of the mean log-return and a log-linear trend
          fit; paths evolve as geometric Brownian motion with the historical
          volatility. Higher backtest error and lower R² mean wider real-world
          uncertainty than the bands imply.
        </p>
      </div>

      <ForecastDisclaimer compact />
    </div>
  );
}

function ScenarioCard({
  label,
  price,
  ret,
  tone,
}: {
  label: string;
  price: number;
  ret: number;
  tone: "up" | "down" | "base";
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        tone === "up"
          ? "border-fresh/50 bg-fresh/10"
          : tone === "down"
          ? "border-loss/30 bg-loss/5"
          : "border-stone bg-sand/70"
      }`}
    >
      <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">{label}</p>
      <p className="mt-0.5 font-serif text-xl font-bold text-forest tabular-nums">
        {formatNaira(price)}
      </p>
      <Delta value={ret} showArrow={false} className="text-[12px]" />
    </div>
  );
}

// Rich tooltip: a plain price for a historical point, or the full P10→P90
// percentile ladder for a forecast point.
function ForecastTooltip({
  active,
  payload,
  dark,
}: {
  active?: boolean;
  payload?: Array<{ payload: ForecastRow }>;
  dark?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const isForecast = row.median != null && Array.isArray(row.band90);

  const box: React.CSSProperties = {
    background: dark ? "rgb(20 32 27)" : "#FFFFFF",
    border: `1px solid ${dark ? "rgb(42 56 49)" : "#E8E6E0"}`,
    color: dark ? "rgb(223 230 223)" : "#1A1A1A",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 11,
    lineHeight: 1.5,
    boxShadow: "0 6px 20px rgba(0,0,0,0.14)",
  };
  const muted = dark ? "rgba(223,230,223,0.55)" : "rgba(26,26,26,0.5)";

  if (!isForecast) {
    return (
      <div style={box}>
        <div style={{ color: muted, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 9 }}>
          {row.date} · Historical
        </div>
        <div style={{ fontWeight: 700, marginTop: 2 }}>
          {row.actual != null ? formatNaira(row.actual) : "—"}
        </div>
      </div>
    );
  }

  const [p10, p90] = row.band90 as [number, number];
  const [p25, p75] = row.band50 as [number, number];
  const rows: Array<[string, number, boolean]> = [
    ["Bull · P90", p90, false],
    ["P75", p75, false],
    ["Median · P50", row.median as number, true],
    ["P25", p25, false],
    ["Bear · P10", p10, false],
  ];
  return (
    <div style={box}>
      <div style={{ color: muted, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 9, marginBottom: 4 }}>
        {row.date} · Forecast
      </div>
      {rows.map(([label, val, bold]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontWeight: bold ? 700 : 400 }}>
          <span style={{ color: bold ? undefined : muted }}>{label}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatNaira(val)}</span>
        </div>
      ))}
    </div>
  );
}

function Diag({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-stone bg-surface px-3.5 py-3 shadow-card" title={hint}>
      <p className="font-sans text-[9.5px] font-semibold uppercase tracking-eyebrow text-ink/40">{label}</p>
      <p className="mt-0.5 font-serif text-base font-semibold text-forest tabular-nums">{value}</p>
    </div>
  );
}
