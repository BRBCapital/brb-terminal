// Fundamental scenario + dividend projection math. Pure and framework-free.
// All outputs are implied by the analyst's stated assumptions — illustrative
// scenarios, never predictions.

export interface FundamentalAssumptions {
  ttmEps: number; // current trailing EPS (naira/share)
  currentPrice: number;
  revenueGrowthPct: number; // annual, %
  marginDeltaPct: number; // annual change in net margin, percentage points added to earnings growth
  exitPe: number; // terminal P/E
  years: number; // projection horizon
  payoutRatioPct: number; // % of earnings paid as dividends
}

export interface FundamentalResult {
  projectedEps: number;
  impliedPrice: number;
  priceReturnPct: number;
  priceCagrPct: number;
  impliedForwardPe: number; // currentPrice / projectedEps
  projectedDps: number; // dividend/share in the terminal year
}

// Earnings compound at revenue growth plus a margin-expansion kicker.
export function projectFundamental(a: FundamentalAssumptions): FundamentalResult {
  const earningsGrowth = a.revenueGrowthPct / 100 + a.marginDeltaPct / 100;
  const projectedEps = a.ttmEps * Math.pow(1 + earningsGrowth, a.years);
  const impliedPrice = projectedEps * a.exitPe;
  const priceReturnPct =
    a.currentPrice > 0 ? ((impliedPrice - a.currentPrice) / a.currentPrice) * 100 : 0;
  const priceCagrPct =
    a.currentPrice > 0 && a.years > 0
      ? (Math.pow(impliedPrice / a.currentPrice, 1 / a.years) - 1) * 100
      : 0;
  return {
    projectedEps,
    impliedPrice,
    priceReturnPct,
    priceCagrPct,
    impliedForwardPe: projectedEps > 0 ? a.currentPrice / projectedEps : 0,
    projectedDps: projectedEps * (a.payoutRatioPct / 100),
  };
}

// Sensitivity grid: implied price across exit-P/E × growth combinations.
export interface SensitivityGrid {
  growthAxis: number[]; // % growth values
  peAxis: number[]; // exit P/E values
  cells: number[][]; // [peIndex][growthIndex] = implied price
}

export function sensitivityGrid(
  a: FundamentalAssumptions,
  growthAxis: number[],
  peAxis: number[]
): SensitivityGrid {
  const cells = peAxis.map((pe) =>
    growthAxis.map((g) => {
      const eps = a.ttmEps * Math.pow(1 + (g / 100 + a.marginDeltaPct / 100), a.years);
      return eps * pe;
    })
  );
  return { growthAxis, peAxis, cells };
}

// ---- Dividend forecast ---------------------------------------------------

export interface DividendHistoryPoint {
  ex_dividend_date: string;
  dividend: number;
}

export interface DividendForecast {
  recentAnnualDps: number; // trailing 12m dividend per share
  estimatedGrowthPct: number; // inferred from history (CAGR of annual DPS)
  projections: Array<{ year: number; dps: number; yieldOnCostPct: number }>;
}

// Aggregate a payout history into annual DPS, infer growth, project forward.
export function forecastDividends(
  history: DividendHistoryPoint[],
  currentPrice: number,
  years = 5,
  fallbackGrowthPct = 0
): DividendForecast {
  // Sum dividends by calendar year, de-duplicating identical same-year payouts.
  // The feed sometimes lists one FY dividend twice (e.g. "Annual" + "12M" of the
  // same amount days apart); summing those would double-count the yield.
  const byYear = new Map<number, number>();
  // A feed sometimes lists the SAME FY payout twice a day or two apart (e.g.
  // "Annual" + "12M" of equal amount) — collapse those. But two legitimately
  // different equal payouts in one year (interim + final, months apart) must
  // both count. Distinguish by date proximity: merge equal amounts within a
  // short window, keep equal amounts far apart.
  const MERGE_WINDOW_MS = 20 * 24 * 60 * 60 * 1000;
  const kept: Array<{ t: number; amt: string }> = [];
  const sorted = [...history].sort((a, b) => a.ex_dividend_date.localeCompare(b.ex_dividend_date));
  for (const d of sorted) {
    const amt = (d.dividend ?? 0).toFixed(4);
    const t = new Date(d.ex_dividend_date).getTime();
    const isDuplicate = kept.some((k) => k.amt === amt && Math.abs(k.t - t) <= MERGE_WINDOW_MS);
    if (isDuplicate) continue;
    kept.push({ t, amt });
    const y = new Date(d.ex_dividend_date).getFullYear();
    byYear.set(y, (byYear.get(y) ?? 0) + (d.dividend ?? 0));
  }
  const years_sorted = [...byYear.entries()].sort((a, b) => a[0] - b[0]);
  const annualSeries = years_sorted.map(([, v]) => v).filter((v) => v > 0);

  // Trailing-12-month DPS ending at the most recent ex-date — the last calendar
  // year understates the run-rate whenever the current year is still partial
  // (e.g. interim paid, final pending). Fall back to the last full year.
  const lastT = kept.length ? Math.max(...kept.map((k) => k.t)) : 0;
  const oneYearMs = 365.25 * 24 * 60 * 60 * 1000;
  const ttmDps = kept
    .filter((k) => k.t > lastT - oneYearMs)
    .reduce((s, k) => s + Number(k.amt), 0);
  const recentAnnualDps = ttmDps > 0 ? ttmDps : annualSeries.at(-1) ?? 0;

  // CAGR across available annual DPS (guard against noise / single point).
  let growth = fallbackGrowthPct / 100;
  if (annualSeries.length >= 3) {
    const first = annualSeries[0];
    const last = annualSeries[annualSeries.length - 1];
    const n = annualSeries.length - 1;
    if (first > 0 && last > 0) {
      growth = Math.pow(last / first, 1 / n) - 1;
      // Clamp to a sane band so a one-off spike doesn't explode the projection.
      growth = Math.max(-0.15, Math.min(0.25, growth));
    }
  }

  const projections = Array.from({ length: years }, (_, i) => {
    const year = i + 1;
    const dps = recentAnnualDps * Math.pow(1 + growth, year);
    return {
      year,
      dps,
      yieldOnCostPct: currentPrice > 0 ? (dps / currentPrice) * 100 : 0,
    };
  });

  return {
    recentAnnualDps,
    estimatedGrowthPct: growth * 100,
    projections,
  };
}
