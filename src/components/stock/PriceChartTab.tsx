"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
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
import { formatNumber, formatCompactNumber, formatPercent } from "@/lib/format";
import {
  sma,
  rsi,
  drawdown,
  maxDrawdown,
  annualizedVolatility,
  RANGE_DAYS,
  type Range,
} from "@/lib/indicators";
import { PngExportButton } from "@/components/ui/ExportButtons";
import type { CompanyChart, ChartPoint } from "@/lib/ngx/types";

const RANGES: Range[] = ["1M", "3M", "6M", "1Y", "5Y", "MAX"];
const GREEN = "#8AC873";
const RED = "#C0392B";
const FOREST = "#052A22";

interface Row extends ChartPoint {
  hl: [number, number] | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi: number | null;
  dd: number | null;
}

// Custom candlestick: bound to the [low, high] range bar, we get the pixel box
// for the wick and linearly map open/close inside it for the body.
function Candle(props: any) {
  const { x, y, width, height, payload } = props;
  const { open, high, low, close } = payload as ChartPoint;
  if (open == null || high == null || low == null || close == null || high < low)
    return null;
  const span = high - low || 1;
  const px = (price: number) => y + ((high - price) / span) * height;
  const cx = x + width / 2;
  const up = close >= open;
  const color = up ? GREEN : RED;
  const yOpen = px(open);
  const yClose = px(close);
  const bodyTop = Math.min(yOpen, yClose);
  const bodyH = Math.max(1, Math.abs(yClose - yOpen));
  const bw = Math.max(1, Math.min(width * 0.7, 8));
  return (
    <g>
      <line x1={cx} x2={cx} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={cx - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={color} />
    </g>
  );
}

export function PriceChartTab({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<Range>("1Y");
  const [showSma, setShowSma] = useState(true);
  const query = useNgx<CompanyChart>(`companies/${symbol}/chart`);

  return (
    <Panel
      title="Price & volume"
      subtitle="OHLC candlesticks · SMA overlays · client-computed"
      right={
        <label className="flex cursor-pointer items-center gap-1 font-sans text-[11px] text-ink/55">
          <input
            type="checkbox"
            checked={showSma}
            onChange={(e) => setShowSma(e.target.checked)}
          />
          SMA 20/50/200
        </label>
      }
    >
      <TileBody query={query} isEmpty={(d) => !d?.data?.length}>
        {(chart) => (
          <ChartBody
            chart={chart}
            range={range}
            setRange={setRange}
            showSma={showSma}
          />
        )}
      </TileBody>
    </Panel>
  );
}

function ChartBody({
  chart,
  range,
  setRange,
  showSma,
}: {
  chart: CompanyChart;
  range: Range;
  setRange: (r: Range) => void;
  showSma: boolean;
}) {
  const rows = useMemo<Row[]>(() => {
    // Compute indicators on the FULL history so lookback windows (SMA200,
    // RSI/drawdown warm-up) are correct, then slice to the visible range —
    // otherwise a 6M view has no SMA200 and drawdown resets at the window edge.
    const src = chart.data;
    const closes = src.map((p) => p.close ?? p.price);
    const s20 = sma(closes, 20);
    const s50 = sma(closes, 50);
    const s200 = sma(closes, 200);
    const rsiArr = rsi(closes, 14);
    const ddArr = drawdown(closes);
    const full: Row[] = src.map((p, i) => ({
      ...p,
      hl: p.low != null && p.high != null ? [p.low, p.high] : null,
      sma20: s20[i],
      sma50: s50[i],
      sma200: s200[i],
      rsi: rsiArr[i],
      dd: ddArr[i],
    }));
    const days = RANGE_DAYS[range];
    return days == null ? full : full.slice(Math.max(0, full.length - days));
  }, [chart.data, range]);

  const closes = rows.map((r) => r.close ?? r.price);
  const first = closes.find((c) => c != null) ?? null;
  const last = [...closes].reverse().find((c) => c != null) ?? null;
  const periodReturn =
    first != null && last != null && first !== 0
      ? ((last - first) / first) * 100
      : null;
  const mdd = maxDrawdown(closes);
  const vol = annualizedVolatility(closes);
  const hasVwap = rows.some((r) => r.vwap != null);
  const chartRef = useRef<HTMLDivElement>(null);
  const isDark = useIsDark();
  // Series that were near-black (FOREST / teal) are invisible on the dark
  // surface — pick readable variants per theme.
  const sma20Color = isDark ? "#79C7B4" : "#1A4D40";
  const vwapColor = isDark ? "#E4EDE4" : FOREST;
  const rsiColor = isDark ? "#9FE08A" : FOREST;
  const volColor = isDark ? "rgba(138,200,115,0.45)" : "#1A4D4066";

  return (
    <div className="space-y-3">
      {/* Range selector + stats */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex overflow-hidden rounded-md border border-stone text-[11px] font-semibold">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={
                r === range
                  ? "bg-forest px-2.5 py-1 text-[#F5F2EC]"
                  : "bg-surface px-2.5 py-1 text-ink/50 hover:bg-sand"
              }
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 font-sans text-[11px] text-ink/55">
          <span>
            Return{" "}
            <Delta value={periodReturn} showArrow={false} className="text-[11px]" />
          </span>
          <span>Max DD {formatPercent(mdd)}</span>
          {vol != null && <span>Ann. vol {formatPercent(vol)}</span>}
          <PngExportButton targetRef={chartRef} filename="price-chart" label="PNG" />
        </div>
      </div>

      {/* Price + candlesticks */}
      <div ref={chartRef} className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "#1A1A1A80" }}
              minTickGap={40}
              tickLine={false}
              axisLine={{ stroke: "#E8E6E0" }}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 9, fill: "#1A1A1A80" }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v: number) => formatNumber(v, 0)}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E8E6E0" }}
              labelFormatter={(l) => `Date: ${l}`}
              formatter={(value: any, name: string) => {
                if (name === "hl" || value == null) return [undefined, undefined];
                return [formatNumber(Number(value), 2), name];
              }}
            />
            <Bar dataKey="hl" shape={<Candle />} isAnimationActive={false} legendType="none" />
            {showSma && (
              <>
                <Line dataKey="sma20" stroke={sma20Color} dot={false} strokeWidth={1} name="SMA20" isAnimationActive={false} connectNulls />
                <Line dataKey="sma50" stroke="#8AC873" dot={false} strokeWidth={1} name="SMA50" isAnimationActive={false} connectNulls />
                <Line dataKey="sma200" stroke="#C0392B" dot={false} strokeWidth={1.2} name="SMA200" isAnimationActive={false} connectNulls />
              </>
            )}
            {hasVwap && (
              <Line dataKey="vwap" stroke={vwapColor} strokeDasharray="3 3" dot={false} strokeWidth={1} name="VWAP" isAnimationActive={false} connectNulls />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Volume */}
      <div className="h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 0, right: 4, bottom: 0, left: -12 }}>
            <XAxis dataKey="date" hide />
            <YAxis
              tick={{ fontSize: 8, fill: "#1A1A1A80" }}
              width={48}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatCompactNumber(v)}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E8E6E0" }}
              formatter={(v: any) => [formatCompactNumber(Number(v)), "Volume"]}
            />
            <Bar dataKey="volume" fill={volColor} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* RSI */}
      <div>
        <p className="mb-1 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
          RSI (14)
        </p>
        <div className="h-20 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 0, right: 4, bottom: 0, left: -12 }}>
              <XAxis dataKey="date" hide />
              <YAxis domain={[0, 100]} ticks={[30, 70]} tick={{ fontSize: 8, fill: "#1A1A1A80" }} width={48} tickLine={false} axisLine={false} />
              <ReferenceLine y={70} stroke="#C0392B55" strokeDasharray="2 2" />
              <ReferenceLine y={30} stroke="#8AC87399" strokeDasharray="2 2" />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E8E6E0" }} formatter={(v: any) => [v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toFixed(1), "RSI"]} />
              <Line dataKey="rsi" stroke={rsiColor} dot={false} strokeWidth={1} isAnimationActive={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Drawdown */}
      <div>
        <p className="mb-1 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
          Drawdown from peak
        </p>
        <div className="h-20 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 0, right: 4, bottom: 0, left: -12 }}>
              <XAxis dataKey="date" hide />
              <YAxis tick={{ fontSize: 8, fill: "#1A1A1A80" }} width={48} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E8E6E0" }} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "Drawdown"]} />
              <Line dataKey="dd" stroke={RED} dot={false} strokeWidth={1} isAnimationActive={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="font-sans text-[10px] text-ink/40">
        Indicators (SMA, RSI, drawdown, volatility) computed client-side from
        end-of-day closes. Past performance does not indicate future results.
      </p>
    </div>
  );
}
