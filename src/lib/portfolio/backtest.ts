// Blend a set of weighted holdings into a single normalized portfolio series and
// compare it to a benchmark index. Both series are rebased to 100 at the first
// common date. Uses forward-fill so holdings with sparse history still align to
// the benchmark's trading calendar.

import type { ChartPoint, IndexChartPoint } from "@/lib/ngx/types";

export interface BacktestInput {
  // effective weights (fractions summing to ~1) keyed by symbol
  weights: Array<{ symbol: string; weight: number }>;
  // per-symbol price history (date asc), close or price
  histories: Record<string, ChartPoint[]>;
  benchmark: IndexChartPoint[];
}

export interface BacktestPoint {
  date: string;
  portfolio: number | null;
  benchmark: number | null;
}

export interface BacktestResult {
  series: BacktestPoint[];
  portfolioReturn: number | null;
  benchmarkReturn: number | null;
  portfolioVol: number | null; // annualized %
  portfolioMaxDrawdown: number | null; // %
}

function closeOf(p: ChartPoint): number | null {
  return p.close ?? p.price ?? null;
}

// Map of date -> value, plus a sorted date array for forward-fill lookups.
function toMap(points: Array<{ date: string; value: number | null }>) {
  const map = new Map<string, number>();
  for (const p of points) {
    if (p.value != null && !Number.isNaN(p.value)) map.set(p.date, p.value);
  }
  return map;
}

// Forward-filled lookup: last known value on or before `date`.
function makeForwardFill(dates: string[], map: Map<string, number>) {
  return (date: string): number | null => {
    if (map.has(date)) return map.get(date)!;
    // binary search the largest date <= target among known dates
    let lo = 0;
    let hi = dates.length - 1;
    let best: string | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (dates[mid] <= date) {
        best = dates[mid];
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best ? map.get(best) ?? null : null;
  };
}

export function runBacktest(
  input: BacktestInput,
  lookbackDays: number | null
): BacktestResult {
  const bench = input.benchmark;
  if (!bench.length) {
    return {
      series: [],
      portfolioReturn: null,
      benchmarkReturn: null,
      portfolioVol: null,
      portfolioMaxDrawdown: null,
    };
  }

  // Benchmark defines the trading calendar; slice to the lookback window.
  const benchSorted = [...bench].sort((a, b) => a.date.localeCompare(b.date));
  const windowed =
    lookbackDays == null
      ? benchSorted
      : benchSorted.slice(Math.max(0, benchSorted.length - lookbackDays));
  const calendar = windowed.map((b) => b.date);
  const startDate = calendar[0];

  // Per-holding forward-fill lookups + base price. Base at the window start when
  // available, else at the holding's first in-window price — otherwise a name
  // that only starts trading mid-window (IPO/new listing) would be dropped for
  // the WHOLE backtest, silently inflating the surviving holdings' weights.
  const fills = input.weights.map((w) => {
    const hist = (input.histories[w.symbol] ?? [])
      .map((p) => ({ date: p.date, value: closeOf(p) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const dates = hist.map((h) => h.date);
    const map = toMap(hist);
    const fill = makeForwardFill(dates, map);
    let base = fill(startDate);
    if (base == null || base <= 0) {
      for (const d of calendar) {
        const v = fill(d);
        if (v != null && v > 0) {
          base = v;
          break;
        }
      }
    }
    return { symbol: w.symbol, weight: w.weight, fill, base };
  });

  // Only holdings with a valid base price contribute; renormalize their weights.
  const usable = fills.filter((f) => f.base != null && f.base > 0);
  const wSum = usable.reduce((s, f) => s + f.weight, 0);

  const benchBase = windowed[0].index_value;
  const series: BacktestPoint[] = windowed.map((b) => {
    let port: number | null = null;
    if (wSum > 0) {
      let acc = 0;
      let contributed = 0;
      for (const f of usable) {
        const px = f.fill(b.date);
        if (px == null) continue;
        acc += (f.weight / wSum) * (px / (f.base as number));
        contributed += f.weight / wSum;
      }
      port = contributed > 0 ? (acc / contributed) * 100 : null;
    }
    const benchVal = benchBase > 0 ? (b.index_value / benchBase) * 100 : null;
    return { date: b.date, portfolio: port, benchmark: benchVal };
  });

  const portVals = series.map((s) => s.portfolio).filter((v): v is number => v != null);
  const benchVals = series.map((s) => s.benchmark).filter((v): v is number => v != null);
  const portfolioReturn = portVals.length ? portVals[portVals.length - 1] - 100 : null;
  const benchmarkReturn = benchVals.length ? benchVals[benchVals.length - 1] - 100 : null;

  // Volatility + max drawdown from the portfolio series.
  let portfolioVol: number | null = null;
  if (portVals.length > 2) {
    const rets: number[] = [];
    for (let i = 1; i < portVals.length; i++) {
      if (portVals[i - 1] > 0) rets.push(portVals[i] / portVals[i - 1] - 1);
    }
    if (rets.length > 1) {
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const varc = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
      portfolioVol = Math.sqrt(varc) * Math.sqrt(252) * 100;
    }
  }
  let peak = -Infinity;
  let mdd = 0;
  for (const v of portVals) {
    if (v > peak) peak = v;
    if (peak > 0) mdd = Math.min(mdd, ((v - peak) / peak) * 100);
  }

  return {
    series,
    portfolioReturn,
    benchmarkReturn,
    portfolioVol,
    portfolioMaxDrawdown: portVals.length ? mdd : null,
  };
}
