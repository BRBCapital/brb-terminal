// Quantitative price-path forecasting engine.
//
// This is a MODEL, not an oracle. It fits drift + volatility from historical
// end-of-day closes and runs a Monte Carlo ensemble to produce a *distribution*
// of possible future paths — expressed as probability bands (base / bull /
// bear). Every consumer must present the output as an illustrative scenario,
// never a prediction or guarantee (compliance guardrail).
//
// Pure + deterministic: a seeded PRNG makes the simulation reproducible across
// renders so an analyst sees a stable picture.

// ---- deterministic RNG (mulberry32) --------------------------------------
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Box–Muller standard normal from a uniform RNG.
function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const TRADING_DAYS = 252;

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) out.push(Math.log(closes[i] / closes[i - 1]));
  }
  return out;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

// Fit log(price) = a + b·t. Returns daily drift b and R².
export function fitLogLinear(closes: number[]): { a: number; b: number; r2: number } {
  const ys = closes.map((c) => Math.log(c));
  const n = ys.length;
  if (n < 2) return { a: ys[0] ?? 0, b: 0, r2: 0 };
  const xs = ys.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  const a = my - b * mx;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = a + b * xs[i];
    ssRes += (ys[i] - pred) ** 2;
    ssTot += (ys[i] - my) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { a, b, r2 };
}

export interface ForecastStats {
  lastPrice: number;
  histDailyDrift: number; // mean log return
  regDailyDrift: number; // slope of log-linear fit
  blendedDailyDrift: number; // drift used by the model
  dailyVol: number; // std of log returns
  annualVol: number; // %
  annualDrift: number; // %
  r2: number;
  backtestMape: number | null; // % walk-forward error
  sampleDays: number;
}

export interface BandPoint {
  step: number; // trading days ahead (0 = today)
  date?: string;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
}

export interface HorizonSummary {
  months: number;
  days: number;
  base: number; // P50
  bull: number; // P90
  bear: number; // P10
  baseReturnPct: number;
  bullReturnPct: number;
  bearReturnPct: number;
}

export interface ForecastResult {
  stats: ForecastStats;
  bands: BandPoint[];
  horizons: HorizonSummary[];
}

const PCTS = [5, 10, 25, 50, 75, 90, 95] as const;

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// Walk-forward accuracy: fit on all but the last H days, project the median H
// days forward with the same GBM drift, compare to actual. Reported as MAPE.
function walkForwardMape(closes: number[], horizon = 21): number | null {
  if (closes.length < horizon + 60) return null;
  const train = closes.slice(0, closes.length - horizon);
  const rets = logReturns(train);
  const drift = mean(rets);
  const last = train[train.length - 1];
  const projected = last * Math.exp(drift * horizon);
  const actual = closes[closes.length - 1];
  if (actual <= 0) return null;
  return Math.abs((projected - actual) / actual) * 100;
}

export interface ForecastOptions {
  paths?: number;
  horizonDays?: number;
  seed?: number;
  // Dampen the extrapolated drift toward zero to avoid explosive long-horizon
  // projections (0 = ignore trend, 1 = full trend). Default 0.5.
  driftDamping?: number;
  futureDates?: string[]; // optional labels per step
}

export function forecast(closes: number[], opts: ForecastOptions = {}): ForecastResult {
  const {
    paths = 2000,
    horizonDays = 252,
    seed = 12345,
    driftDamping = 0.5,
    futureDates,
  } = opts;

  const clean = closes.filter((c) => c != null && c > 0 && !Number.isNaN(c));
  const lastPrice = clean[clean.length - 1] ?? 0;
  const rets = logReturns(clean);
  const histDrift = mean(rets);
  const dailyVol = std(rets);
  const { b: regDrift, r2 } = fitLogLinear(clean.slice(-Math.min(clean.length, 504)));

  // Ensemble drift: blend historical mean return with the regression slope,
  // then damp so long horizons stay plausible.
  const blended = (0.5 * histDrift + 0.5 * regDrift) * driftDamping;

  const rng = makeRng(seed);
  // paths × steps simulation, collecting the price at each step for percentiles.
  const stepPrices: number[][] = Array.from({ length: horizonDays + 1 }, () => []);
  for (let p = 0; p < paths; p++) {
    let price = lastPrice;
    stepPrices[0].push(price);
    for (let t = 1; t <= horizonDays; t++) {
      // `blended` is already a mean LOG-return (log-space drift), so each step's
      // log-return is drawn as Normal(blended, dailyVol) directly. Do NOT also
      // subtract ½σ² — the Itô correction only applies when the drift is the
      // arithmetic mean return, and adding it here biased the median low by
      // ½σ²/day (≈8% at 12M for a 40%-vol name).
      const shock = gaussian(rng);
      price = price * Math.exp(blended + dailyVol * shock);
      stepPrices[t].push(price);
    }
  }

  const bands: BandPoint[] = stepPrices.map((prices, step) => {
    const sorted = [...prices].sort((a, b) => a - b);
    const q = (p: number) => percentile(sorted, p);
    return {
      step,
      date: futureDates?.[step],
      p5: q(5),
      p10: q(10),
      p25: q(25),
      p50: q(50),
      p75: q(75),
      p90: q(90),
      p95: q(95),
    };
  });

  const horizonMonths = [3, 6, 12];
  const horizons: HorizonSummary[] = horizonMonths.map((m) => {
    const days = Math.min(horizonDays, Math.round((m / 12) * TRADING_DAYS));
    const bp = bands[days] ?? bands[bands.length - 1];
    const ret = (v: number) => (lastPrice > 0 ? ((v - lastPrice) / lastPrice) * 100 : 0);
    return {
      months: m,
      days,
      base: bp.p50,
      bull: bp.p90,
      bear: bp.p10,
      baseReturnPct: ret(bp.p50),
      bullReturnPct: ret(bp.p90),
      bearReturnPct: ret(bp.p10),
    };
  });

  return {
    stats: {
      lastPrice,
      histDailyDrift: histDrift,
      regDailyDrift: regDrift,
      blendedDailyDrift: blended,
      dailyVol,
      annualVol: dailyVol * Math.sqrt(TRADING_DAYS) * 100,
      annualDrift: (Math.exp(blended * TRADING_DAYS) - 1) * 100,
      r2,
      backtestMape: walkForwardMape(clean),
      sampleDays: clean.length,
    },
    bands,
    horizons,
  };
}
