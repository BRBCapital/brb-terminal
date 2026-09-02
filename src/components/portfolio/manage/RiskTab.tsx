"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/ui/Tile";
import { Delta } from "@/components/ui/Delta";
import { ComplianceNote } from "@/components/ui/ComplianceNote";
import { fetchProxy } from "@/lib/ngx/browser";
import { formatPercent } from "@/lib/format";
import { runBacktest } from "@/lib/portfolio/backtest";
import { riskMetrics, correlationMatrix } from "@/lib/portfolio/risk";
import type { ChartPoint, CompanyChart, IndexChart } from "@/lib/ngx/types";
import type { ManageData } from "./useManageData";

const WINDOW = 252; // ~1 year of trading days

// Forward-filled level series for each symbol aligned to `dates`.
function alignSeries(dates: string[], histories: Record<string, ChartPoint[]>) {
  const out: Record<string, number[]> = {};
  for (const [sym, hist] of Object.entries(histories)) {
    const map = new Map<string, number>();
    for (const p of hist) {
      const v = p.close ?? p.price;
      if (v != null && v > 0) map.set(p.date, v);
    }
    const sortedDates = [...map.keys()].sort();
    let ptr = 0;
    let last: number | null = null;
    const series: (number | null)[] = [];
    for (const d of dates) {
      while (ptr < sortedDates.length && sortedDates[ptr] <= d) {
        last = map.get(sortedDates[ptr])!;
        ptr++;
      }
      // Push for EVERY date (null before the symbol's first data) so every
      // series is the same length and index-aligned to `dates` — otherwise
      // symbols with different start dates get paired across mismatched
      // calendar days in the correlation matrix.
      series.push(last);
    }
    const firstVal = series.find((v) => v != null);
    if (firstVal == null) continue; // no usable history
    // Back-fill the leading gap with the first known level so returns stay aligned.
    const filled = series.map((v) => v ?? firstVal);
    if (filled.length > 5) out[sym] = filled;
  }
  return out;
}

export function RiskTab({ data }: { data: ManageData }) {
  const { valued, totals, portfolio } = data;
  const [rf, setRf] = useState(18); // Nigerian T-bill proxy, editable
  const [histories, setHistories] = useState<Record<string, ChartPoint[]>>({});
  const [benchmark, setBenchmark] = useState<IndexChart["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const benchSymbol = portfolio?.benchmark_symbol ?? "ASI";
  const weights = useMemo(
    () =>
      valued
        .filter((v) => v.marketValue != null && totals.marketValue > 0)
        .map((v) => ({ symbol: v.symbol, weight: (v.marketValue as number) / totals.marketValue })),
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

  const { metrics, corr } = useMemo(() => {
    if (!benchmark) return { metrics: null, corr: null };
    const bt = runBacktest(
      { weights, histories, benchmark },
      WINDOW
    );
    const portLevels = bt.series.map((s) => s.portfolio).filter((v): v is number => v != null);
    const benchLevels = bt.series.map((s) => s.benchmark).filter((v): v is number => v != null);
    const m = riskMetrics(portLevels, benchLevels, rf);
    const dates = bt.series.map((s) => s.date);
    const aligned = alignSeries(dates, histories);
    const c = Object.keys(aligned).length >= 2 ? correlationMatrix(aligned) : null;
    return { metrics: m, corr: c };
  }, [benchmark, histories, weights, rf]);

  if (!weights.length) {
    return (
      <Panel title="Risk analytics" subtitle="Needs live positions">
        <p className="py-6 text-center font-sans text-[13px] text-ink/55">
          Add positions to compute portfolio risk.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Risk analytics"
        subtitle={`vs ${benchSymbol} · trailing ~1y daily returns`}
        right={
          <label className="flex items-center gap-1 font-sans text-[11px] text-ink/55">
            Risk-free
            <input
              type="number"
              value={rf}
              onChange={(e) => setRf(Number(e.target.value))}
              className="w-16 rounded border border-stone px-2 py-1 text-right tabular-nums outline-none focus:border-fresh"
            />
            %
          </label>
        }
      >
        {loading ? (
          <div className="h-40 animate-pulse rounded bg-stone" />
        ) : error || !metrics ? (
          <p className="py-6 text-center font-sans text-[13px] text-ink/55">
            {error ?? "Not enough history to compute risk."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <Metric label="Ann. return" value={<Delta value={metrics.annReturn} showArrow={false} />} />
            <Metric label="Ann. volatility" value={formatPercent(metrics.annVol)} />
            <Metric label="Beta" value={metrics.beta.toFixed(2)} />
            <Metric label="Alpha (Jensen)" value={<Delta value={metrics.alpha} showArrow={false} />} />
            <Metric label="Sharpe" value={metrics.sharpe.toFixed(2)} />
            <Metric label="Sortino" value={metrics.sortino.toFixed(2)} />
            <Metric label="Tracking error" value={formatPercent(metrics.trackingError)} />
            <Metric label="Information ratio" value={metrics.informationRatio.toFixed(2)} />
            <Metric label="Correlation" value={metrics.correlation.toFixed(2)} />
            <Metric label="R²" value={metrics.rSquared.toFixed(2)} />
            <Metric label="VaR 95% (1d)" value={formatPercent(-metrics.var95)} />
            <Metric label="CVaR 95%" value={formatPercent(-metrics.cvar95)} />
            <Metric label="Max drawdown" value={formatPercent(metrics.maxDrawdown)} />
            <Metric label="Observations" value={String(metrics.observations)} />
          </div>
        )}
      </Panel>

      {corr && (
        <Panel title="Correlation matrix" subtitle="Pairwise daily-return correlation of holdings">
          <div className="overflow-x-auto">
            <table className="text-center font-sans text-[11px]">
              <thead>
                <tr>
                  <th className="p-1"></th>
                  {corr.symbols.map((s) => (
                    <th key={s} className="p-1 font-sans text-[10px] font-semibold text-forest">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {corr.matrix.map((row, i) => (
                  <tr key={corr.symbols[i]}>
                    <td className="p-1 text-left font-semibold text-forest">{corr.symbols[i]}</td>
                    {row.map((v, j) => (
                      <td
                        key={j}
                        style={{ backgroundColor: corrTone(v) }}
                        className="p-1.5 tabular-nums text-ink"
                        title={`${corr.symbols[i]} / ${corr.symbols[j]}`}
                      >
                        {v.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 font-sans text-[10px] text-ink/45">
            High positive correlation (green) means holdings move together —
            less diversification benefit. Negative (red) offsets risk.
          </p>
        </Panel>
      )}

      <ComplianceNote>
        Risk metrics are estimated from trailing daily returns and depend on the
        chosen risk-free rate ({rf}%). Past volatility does not predict future
        risk. For internal analysis only — not investment advice.
      </ComplianceNote>
    </div>
  );
}

// Green for high positive correlation, red for negative, neutral near zero.
function corrTone(v: number): string {
  if (v >= 0) return `rgba(138,200,115,${Math.min(0.85, Math.abs(v) * 0.85)})`;
  return `rgba(192,57,43,${Math.min(0.85, Math.abs(v) * 0.85)})`;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone bg-surface px-3.5 py-3 shadow-card">
      <p className="font-sans text-[9.5px] font-semibold uppercase tracking-eyebrow text-ink/40">{label}</p>
      <p className="mt-1.5 font-serif text-base font-semibold text-forest tabular-nums">{value}</p>
    </div>
  );
}
