"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel } from "@/components/ui/Tile";
import { Delta } from "@/components/ui/Delta";
import { fetchProxy } from "@/lib/ngx/browser";
import { formatNumber, formatPercent } from "@/lib/format";
import { runBacktest } from "@/lib/portfolio/backtest";
import type { ChartPoint, CompanyChart, IndexChart } from "@/lib/ngx/types";
import type { ManageData } from "./useManageData";

type Period = "1M" | "3M" | "YTD" | "1Y";
const PERIODS: Period[] = ["1M", "3M", "YTD", "1Y"];
// Windows are applied to the benchmark's TRADING-day calendar (~252/yr), so use
// trading-day counts, not calendar days, or every window is overstated.
const DAYS: Record<Exclude<Period, "YTD">, number> = { "1M": 21, "3M": 63, "1Y": 252 };

export function PerformanceTab({ data }: { data: ManageData }) {
  const { valued, totals, portfolio } = data;
  const [period, setPeriod] = useState<Period>("YTD");
  const [histories, setHistories] = useState<Record<string, ChartPoint[]>>({});
  const [benchmark, setBenchmark] = useState<IndexChart["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const benchSymbol = portfolio?.benchmark_symbol ?? "ASI";

  // Current market-value weights (fractions).
  const weights = useMemo(
    () =>
      valued
        .filter((v) => v.marketValue != null && totals.marketValue > 0)
        .map((v) => ({
          symbol: v.symbol,
          weight: (v.marketValue as number) / totals.marketValue,
          sector: v.sector,
        })),
    [valued, totals.marketValue]
  );

  useEffect(() => {
    if (!weights.length) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [benchRes, ...res] = await Promise.all([
        fetchProxy<IndexChart>(`indices/${benchSymbol}/chart`, { period: "MAX" }),
        ...weights.map((w) => fetchProxy<CompanyChart>(`companies/${w.symbol}/chart`)),
      ]);
      if (cancelled) return;
      if (!benchRes.ok) {
        setError("Benchmark history unavailable.");
        setLoading(false);
        return;
      }
      setBenchmark(benchRes.data.data);
      const hmap: Record<string, ChartPoint[]> = {};
      res.forEach((r, i) => {
        if (r.ok) hmap[weights[i].symbol] = r.data.data;
      });
      setHistories(hmap);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [weights, benchSymbol]);

  const lookbackDays = useMemo(() => {
    if (period !== "YTD") return DAYS[period];
    if (!benchmark || !benchmark.length) return 250;
    const year = benchmark.at(-1)?.date.slice(0, 4) ?? "2026";
    return benchmark.filter((b) => b.date >= `${year}-01-01`).length;
  }, [period, benchmark]);

  const result = useMemo(() => {
    if (!benchmark || !benchmark.length) return null;
    return runBacktest(
      { weights: weights.map((w) => ({ symbol: w.symbol, weight: w.weight })), histories, benchmark },
      lookbackDays
    );
  }, [benchmark, histories, weights, lookbackDays]);

  // Per-holding + per-sector contribution over the period.
  const contributions = useMemo(() => {
    if (!benchmark) return { holdings: [], sectors: [] as Array<{ key: string; value: number }> };
    const startIdx = Math.max(0, benchmark.length - lookbackDays);
    const startDate = benchmark[startIdx]?.date ?? benchmark[0].date;
    const holdings = weights.map((w) => {
      const hist = histories[w.symbol] ?? [];
      const inRange = hist.filter((p) => p.date >= startDate);
      const startP = inRange[0]?.close ?? inRange[0]?.price ?? null;
      const endP = inRange.at(-1)?.close ?? inRange.at(-1)?.price ?? null;
      const ret = startP && endP && startP > 0 ? (endP / startP - 1) * 100 : 0;
      return { symbol: w.symbol, sector: w.sector, contribution: w.weight * ret };
    });
    const sectorMap = new Map<string, number>();
    for (const h of holdings) {
      sectorMap.set(h.sector || "Unclassified", (sectorMap.get(h.sector || "Unclassified") ?? 0) + h.contribution);
    }
    return {
      holdings: [...holdings].sort((a, b) => b.contribution - a.contribution),
      sectors: [...sectorMap.entries()]
        .map(([key, value]) => ({ key, value }))
        .sort((a, b) => b.value - a.value),
    };
  }, [benchmark, histories, weights, lookbackDays]);

  if (!weights.length) {
    return (
      <Panel title="Performance" subtitle="Time-weighted return vs benchmark">
        <p className="py-6 text-center font-sans text-[13px] text-ink/55">
          Add positions to see performance.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Performance vs benchmark"
        subtitle={`Current holdings held constant · benchmark ${benchSymbol}`}
        right={
          <div className="flex overflow-hidden rounded-md border border-stone text-[11px] font-semibold">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={
                  p === period
                    ? "bg-forest px-2 py-1 text-[#F5F2EC]"
                    : "bg-surface px-2 py-1 text-ink/50 hover:bg-sand"
                }
              >
                {p}
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <div className="h-56 animate-pulse rounded bg-stone" />
        ) : error ? (
          <p className="py-6 text-center font-sans text-[13px] text-ink/55">{error}</p>
        ) : result && result.series.length ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 font-sans text-[12px]">
              <span className="text-ink/55">
                Portfolio <Delta value={result.portfolioReturn} showArrow={false} className="text-[12px]" />
              </span>
              <span className="text-ink/55">
                Benchmark <Delta value={result.benchmarkReturn} showArrow={false} className="text-[12px]" />
              </span>
              <span className="text-ink/55">
                Excess{" "}
                <Delta
                  value={
                    result.portfolioReturn != null && result.benchmarkReturn != null
                      ? result.portfolioReturn - result.benchmarkReturn
                      : null
                  }
                  showArrow={false}
                  className="text-[12px]"
                />
              </span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.series} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#1A1A1A80" }} minTickGap={44} tickLine={false} axisLine={{ stroke: "#E8E6E0" }} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "#1A1A1A80" }} width={40} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatNumber(v, 0)} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E8E6E0" }} formatter={(v: any, n: string) => [v == null ? "—" : formatNumber(Number(v), 1), n === "portfolio" ? "Portfolio" : "Benchmark"]} />
                  {/* Portfolio = bright brand-green line; benchmark = muted grey
                      dashed reference — both visible on light & dark. */}
                  <Line dataKey="portfolio" stroke="#8AC873" strokeWidth={2.1} dot={false} isAnimationActive={false} connectNulls />
                  <Line dataKey="benchmark" stroke="#9AA5B1" strokeWidth={1.4} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
              <span className="flex items-center gap-1">
                <span className="h-1 w-4 rounded-sm bg-fresh" /> Portfolio
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1 w-4 rounded-sm" style={{ backgroundColor: "#9AA5B1" }} /> Benchmark
              </span>
            </div>
          </div>
        ) : (
          <p className="py-6 text-center font-sans text-[13px] text-ink/55">Not enough history.</p>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Contribution by holding" subtitle={`${period} return × weight`}>
          <ContribList items={contributions.holdings.map((h) => ({ key: h.symbol, value: h.contribution }))} />
        </Panel>
        <Panel title="Contribution by sector" subtitle={`${period}`}>
          <ContribList items={contributions.sectors} />
        </Panel>
      </div>
    </div>
  );
}

function ContribList({ items }: { items: Array<{ key: string; value: number }> }) {
  if (!items.length) {
    return <p className="py-4 text-center font-sans text-[12px] text-ink/40">—</p>;
  }
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 0.01);
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-2 text-[12px]">
          <span className="w-24 shrink-0 truncate font-sans text-ink/70">{i.key}</span>
          <span className="relative flex h-4 flex-1 items-center">
            <span
              className={`absolute h-3 rounded-sm ${i.value >= 0 ? "bg-fresh" : "bg-loss/60"}`}
              style={{ width: `${(Math.abs(i.value) / max) * 100}%` }}
            />
          </span>
          <span className={`w-14 text-right font-semibold tabular-nums ${i.value >= 0 ? "text-forest-soft" : "text-loss"}`}>
            {i.value >= 0 ? "+" : ""}
            {i.value.toFixed(2)}%
          </span>
        </li>
      ))}
    </ul>
  );
}
