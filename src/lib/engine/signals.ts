// Computed factor signals over the NGX universe — the "research" layer of the
// engine. These are transparent, rules-based factor scores (momentum / liquidity
// / volatility / range-value), percentile-ranked across the priced universe.
// Illustrative only; fundamentals-based value factors are a Phase-2 enrichment.

import type { CompanyListRow } from "@/lib/ngx/types";

export interface FactorSignal {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  momentum: number; // 0–100 (higher = stronger recent uptrend)
  liquidity: number; // 0–100 (higher = more liquid / larger)
  volatility: number; // 0–100 (higher = wider 52w range)
  value: number; // 0–100 (higher = nearer 52w low → cheaper on range)
  composite: number; // blended ranking score
  chg_1d: number | null;
  chg_1m: number | null;
  chg_ytd: number | null;
  market_cap: number | null;
  volume: number | null;
}

// Percentile rank (0–100) of each value within the sample; nulls → 0.
function percentiles(values: (number | null)[]): number[] {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  const sorted = [...present].sort((a, b) => a - b);
  const n = sorted.length;
  return values.map((v) => {
    if (v == null || !Number.isFinite(v) || n === 0) return 0;
    // fraction of the sample strictly below v
    let lo = 0;
    while (lo < n && sorted[lo] < v) lo++;
    return Math.round((lo / n) * 100);
  });
}

export function computeFactorSignals(rows: CompanyListRow[], limit = 40): FactorSignal[] {
  const universe = rows.filter((r) => r.symbol && r.price != null && r.price > 0);
  if (!universe.length) return [];

  // Raw factor inputs.
  const momentumRaw = universe.map((r) => {
    const m1 = r.change_1m_percent ?? 0;
    const ytd = r.change_ytd_percent ?? 0;
    const d1 = r.price_change_percent ?? 0;
    return 0.5 * m1 + 0.3 * ytd + 0.2 * d1;
  });
  const liquidityRaw = universe.map((r) => Math.log10(Math.max(1, r.market_cap ?? 0) + 1));
  const volatilityRaw = universe.map((r) => {
    const hi = r.high_52wk ?? null;
    const lo = r.low_52wk ?? null;
    const px = r.price ?? null;
    if (hi == null || lo == null || !px) return null;
    return ((hi - lo) / px) * 100; // range width as % of price
  });
  // Value: position within 52w range — nearer the low scores higher (cheaper).
  const valueRaw = universe.map((r) => {
    const hi = r.high_52wk ?? null;
    const lo = r.low_52wk ?? null;
    const px = r.price ?? null;
    if (hi == null || lo == null || !px || hi <= lo) return null;
    const pos = (px - lo) / (hi - lo); // 0 at low, 1 at high
    return (1 - pos) * 100; // invert: cheap = high
  });

  const mom = percentiles(momentumRaw);
  const liq = percentiles(liquidityRaw);
  const vol = percentiles(volatilityRaw);
  const val = percentiles(valueRaw);

  const signals: FactorSignal[] = universe.map((r, i) => {
    const composite =
      0.45 * mom[i] + 0.25 * liq[i] + 0.15 * val[i] + 0.15 * (100 - vol[i]);
    return {
      symbol: r.symbol.toUpperCase(),
      name: r.name,
      sector: r.sector,
      price: r.price!,
      momentum: mom[i],
      liquidity: liq[i],
      volatility: vol[i],
      value: val[i],
      composite: Math.round(composite),
      chg_1d: r.price_change_percent,
      chg_1m: r.change_1m_percent,
      chg_ytd: r.change_ytd_percent,
      market_cap: r.market_cap,
      volume: r.volume,
    };
  });

  return signals.sort((a, b) => b.composite - a.composite).slice(0, limit);
}
