// Portfolio risk analytics. Pure + framework-free (tested in risk.test.ts).
// Inputs are aligned daily *level* series (e.g. rebased-to-100 portfolio and
// benchmark); we derive returns internally.

const TRADING_DAYS = 252;

export function dailyReturns(levels: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < levels.length; i++) {
    if (levels[i - 1] > 0) out.push(levels[i] / levels[i - 1] - 1);
  }
  return out;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
}
function std(xs: number[]): number {
  return Math.sqrt(variance(xs));
}
function covariance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let s = 0;
  for (let i = 0; i < n; i++) s += (a[i] - ma) * (b[i] - mb);
  return s / (n - 1);
}
export function correlation(a: number[], b: number[]): number {
  const sa = std(a);
  const sb = std(b);
  if (sa === 0 || sb === 0) return 0;
  return covariance(a, b) / (sa * sb);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export interface RiskMetrics {
  annReturn: number; // portfolio annualized return %
  annVol: number; // portfolio annualized volatility %
  benchAnnReturn: number;
  benchAnnVol: number;
  beta: number;
  alpha: number; // Jensen's alpha, annualized %
  correlation: number;
  rSquared: number;
  trackingError: number; // annualized %
  informationRatio: number;
  sharpe: number;
  sortino: number;
  var95: number; // 1-day 95% historical VaR, % (positive = loss)
  cvar95: number; // expected shortfall beyond VaR, %
  maxDrawdown: number; // %
  observations: number;
}

export function maxDrawdown(levels: number[]): number {
  let peak = -Infinity;
  let mdd = 0;
  for (const v of levels) {
    if (v > peak) peak = v;
    if (peak > 0) mdd = Math.min(mdd, (v - peak) / peak);
  }
  return mdd * 100;
}

export function riskMetrics(
  portfolioLevels: number[],
  benchmarkLevels: number[],
  riskFreeAnnualPct = 0
): RiskMetrics | null {
  const rp = dailyReturns(portfolioLevels);
  const rb = dailyReturns(benchmarkLevels);
  const n = Math.min(rp.length, rb.length);
  if (n < 5) return null;
  const p = rp.slice(rp.length - n);
  const b = rb.slice(rb.length - n);

  const rfDaily = riskFreeAnnualPct / 100 / TRADING_DAYS;
  const meanP = mean(p);
  const meanB = mean(b);
  const volPDaily = std(p);
  const volBDaily = std(b);

  const varB = variance(b);
  const beta = varB === 0 ? 0 : covariance(p, b) / varB;
  const corr = correlation(p, b);

  // Jensen's alpha (annualized): actual − CAPM-expected excess return.
  const alphaDaily = meanP - (rfDaily + beta * (meanB - rfDaily));

  const active = p.map((v, i) => v - b[i]);
  const teDaily = std(active);

  // Downside deviation vs the risk-free target.
  const downside = p.filter((v) => v < rfDaily).map((v) => v - rfDaily);
  const downsideDev = downside.length
    ? Math.sqrt(downside.reduce((a, v) => a + v * v, 0) / downside.length)
    : 0;

  const annReturn = (Math.exp(meanP * TRADING_DAYS) - 1) * 100;
  const benchAnnReturn = (Math.exp(meanB * TRADING_DAYS) - 1) * 100;
  const annVol = volPDaily * Math.sqrt(TRADING_DAYS) * 100;
  const benchAnnVol = volBDaily * Math.sqrt(TRADING_DAYS) * 100;
  const annExcess = (meanP - rfDaily) * TRADING_DAYS * 100;

  const sortedLoss = [...p].sort((a, c) => a - c);
  const var95 = -percentile(sortedLoss, 5) * 100;
  const tail = sortedLoss.filter((v) => v <= percentile(sortedLoss, 5));
  const cvar95 = tail.length ? -mean(tail) * 100 : var95;

  return {
    annReturn,
    annVol,
    benchAnnReturn,
    benchAnnVol,
    beta,
    alpha: alphaDaily * TRADING_DAYS * 100,
    correlation: corr,
    rSquared: corr * corr,
    trackingError: teDaily * Math.sqrt(TRADING_DAYS) * 100,
    informationRatio:
      teDaily === 0 ? 0 : (mean(active) / teDaily) * Math.sqrt(TRADING_DAYS),
    sharpe: annVol === 0 ? 0 : annExcess / annVol,
    sortino:
      downsideDev === 0
        ? 0
        : annExcess / (downsideDev * Math.sqrt(TRADING_DAYS) * 100),
    var95,
    cvar95,
    maxDrawdown: maxDrawdown(portfolioLevels),
    observations: n,
  };
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][]; // symmetric, diagonal 1
}

// Pairwise return correlations across holdings. `seriesBySymbol` holds aligned
// daily *level* series (same calendar).
export function correlationMatrix(
  seriesBySymbol: Record<string, number[]>
): CorrelationMatrix {
  const symbols = Object.keys(seriesBySymbol);
  const returns = symbols.map((s) => dailyReturns(seriesBySymbol[s]));
  const matrix = symbols.map((_, i) =>
    symbols.map((__, j) => {
      if (i === j) return 1;
      return Number(correlation(returns[i], returns[j]).toFixed(4));
    })
  );
  return { symbols, matrix };
}
