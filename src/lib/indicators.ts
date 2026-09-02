// Client-side technical indicators computed from OHLCV closes. Kept dependency-
// free and pure so they're easy to test and reason about. All operate on an
// array of numbers (closes) aligned to the chart's date axis.

export type Range = "1M" | "3M" | "6M" | "1Y" | "5Y" | "MAX";

// Counts are in TRADING days (~252/yr), since they slice trading-day arrays and
// drive backtest windows — calendar-day counts overstated every window by ~40%.
export const RANGE_DAYS: Record<Range, number | null> = {
  "1M": 21,
  "3M": 63,
  "6M": 126,
  "1Y": 252,
  "5Y": 1260,
  MAX: null,
};

// Simple Moving Average. Returns an array aligned to `values`, with `null` for
// the leading window where there isn't enough data.
export function sma(values: Array<number | null>, period: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null);
  let sum = 0;
  let count = 0;
  const window: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || Number.isNaN(v)) {
      // Reset gracefully on gaps rather than smearing a stale average.
      window.length = 0;
      sum = 0;
      count = 0;
      out[i] = null;
      continue;
    }
    window.push(v);
    sum += v;
    count++;
    if (window.length > period) {
      sum -= window.shift() as number;
      count--;
    }
    out[i] = window.length === period ? sum / period : null;
  }
  return out;
}

// Wilder's RSI over `period` (default 14). Aligned to `values`.
export function rsi(values: Array<number | null>, period = 14): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null);
  const closes = values.map((v) => (v == null ? NaN : v));
  let avgGain = 0;
  let avgLoss = 0;
  let seeded = false;
  let seedCount = 0;
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (Number.isNaN(change)) continue;
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);
    if (!seeded) {
      avgGain += gain;
      avgLoss += loss;
      seedCount++;
      if (seedCount === period) {
        avgGain /= period;
        avgLoss /= period;
        seeded = true;
        const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
        out[i] = 100 - 100 / (1 + rs);
      }
      continue;
    }
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

// Running drawdown from the peak-to-date, as a negative percentage series.
export function drawdown(values: Array<number | null>): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null);
  let peak = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || Number.isNaN(v)) {
      out[i] = null;
      continue;
    }
    if (v > peak) peak = v;
    out[i] = peak > 0 ? ((v - peak) / peak) * 100 : 0;
  }
  return out;
}

export function maxDrawdown(values: Array<number | null>): number {
  const dd = drawdown(values);
  return dd.reduce<number>((min, v) => (v != null && v < min ? v : min), 0);
}

// Annualized volatility from daily closes (std dev of daily returns × √252).
export function annualizedVolatility(values: Array<number | null>): number | null {
  const closes = values.filter((v): v is number => v != null && !Number.isNaN(v));
  if (closes.length < 3) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push(closes[i] / closes[i - 1] - 1);
  }
  if (rets.length < 2) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance =
    rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}
