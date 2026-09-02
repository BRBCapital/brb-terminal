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
import { formatPercent, formatNumber } from "@/lib/format";
import { RANGE_DAYS, type Range } from "@/lib/indicators";
import { runBacktest, type BacktestResult } from "@/lib/portfolio/backtest";
import { effectiveWeights } from "@/lib/portfolio/validate";
import type {
  ChartPoint,
  CompanyChart,
  IndexChart,
} from "@/lib/ngx/types";
import type { Holding } from "@/lib/db/portfolios";

const RANGES: Range[] = ["3M", "6M", "1Y", "5Y", "MAX"];

export function PortfolioBacktest({
  holdings,
  benchmarkSymbol,
}: {
  holdings: Holding[];
  benchmarkSymbol: string;
}) {
  const [range, setRange] = useState<Range>("1Y");
  const [histories, setHistories] = useState<Record<string, ChartPoint[]>>({});
  const [benchmark, setBenchmark] = useState<IndexChart["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weights = useMemo(
    () =>
      effectiveWeights(
        holdings.map((h) => ({
          symbol: h.symbol,
          sector: h.sector,
          mode: h.mode,
          weight: h.weight,
          units: h.units,
          entry_price: h.entry_price,
        }))
      ).map((w) => ({ symbol: w.symbol, weight: w.pct / 100 })),
    [holdings]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const [benchRes, ...holdingRes] = await Promise.all([
        fetchProxy<IndexChart>(`indices/${benchmarkSymbol}/chart`, {
          period: "MAX",
        }),
        ...holdings.map((h) =>
          fetchProxy<CompanyChart>(`companies/${h.symbol}/chart`)
        ),
      ]);
      if (cancelled) return;
      if (!benchRes.ok) {
        setError(
          benchRes.error.code === "PLAN_REQUIRED"
            ? "Benchmark history needs a higher plan tier."
            : "Couldn't load benchmark history."
        );
        setLoading(false);
        return;
      }
      setBenchmark(benchRes.data.data);
      const hmap: Record<string, ChartPoint[]> = {};
      holdingRes.forEach((r, i) => {
        if (r.ok) hmap[holdings[i].symbol] = r.data.data;
      });
      setHistories(hmap);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [holdings, benchmarkSymbol]);

  const result: BacktestResult | null = useMemo(() => {
    if (!benchmark) return null;
    return runBacktest({ weights, histories, benchmark }, RANGE_DAYS[range]);
  }, [benchmark, histories, weights, range]);

  return (
    <Panel
      title="Backtest vs benchmark"
      subtitle={`Blended portfolio rebased to 100 · benchmark ${benchmarkSymbol}`}
      right={
        <div className="flex overflow-hidden rounded-md border border-stone text-[11px] font-semibold">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={
                r === range
                  ? "bg-forest px-2 py-1 text-[#F5F2EC]"
                  : "bg-surface px-2 py-1 text-ink/50 hover:bg-sand"
              }
            >
              {r}
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <div className="h-64 animate-pulse rounded bg-stone" />
      ) : error ? (
        <div className="rounded-lg border border-dashed border-stone bg-sand/60 px-4 py-8 text-center">
          <p className="font-sans text-sm text-ink/60">{error}</p>
        </div>
      ) : result && result.series.length ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 font-sans text-[12px]">
            <span className="text-ink/55">
              Portfolio{" "}
              <Delta value={result.portfolioReturn} showArrow={false} className="text-[12px]" />
            </span>
            <span className="text-ink/55">
              Benchmark{" "}
              <Delta value={result.benchmarkReturn} showArrow={false} className="text-[12px]" />
            </span>
            {result.portfolioVol != null && (
              <span className="text-ink/55">
                Ann. vol{" "}
                <span className="font-semibold text-forest">
                  {formatPercent(result.portfolioVol)}
                </span>
              </span>
            )}
            {result.portfolioMaxDrawdown != null && (
              <span className="text-ink/55">
                Max DD{" "}
                <span className="font-semibold text-loss">
                  {formatPercent(result.portfolioMaxDrawdown)}
                </span>
              </span>
            )}
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.series} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "#1A1A1A80" }}
                  minTickGap={44}
                  tickLine={false}
                  axisLine={{ stroke: "#E8E6E0" }}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 9, fill: "#1A1A1A80" }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickFormatter={(v: number) => formatNumber(v, 0)}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E8E6E0" }}
                  formatter={(v: any, n: string) => [
                    v == null ? "—" : formatNumber(Number(v), 1),
                    n === "portfolio" ? "Portfolio" : "Benchmark",
                  ]}
                />
                {/* Portfolio = bright brand-green hero line; benchmark = muted
                    grey dashed reference. Both read on light AND dark themes
                    (the old #052A22 portfolio line was invisible on dark). */}
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
          <p className="font-sans text-[10px] text-ink/40">
            Illustrative backtest using current weights held constant over the
            period (no rebalancing, dividends, or costs). Past performance does not
            indicate future results.
          </p>
        </div>
      ) : (
        <p className="py-8 text-center font-sans text-[12px] text-ink/40">
          Not enough history to backtest.
        </p>
      )}
    </Panel>
  );
}
