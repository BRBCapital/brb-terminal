// Rules-based risk & allocation overlay applied on top of the AI-selected
// positions. Everything here is deterministic and unit-tested: capital
// allocation across cadences, single-name caps, liquidity (ADV) caps,
// volatility-scaled sizing, an FX-aware sector overlay, and a drawdown halt.

import type { Cadence, StrategySettings } from "@/lib/db/strategy";

export interface EnginePosition {
  ticker: string;
  company_name: string;
  sector: string;
  entry_price: number;
  units: number;
  amount_ngn: number;
  target_price: number | null;
  stop_loss: number | null;
  rationale: string;
}

// Sectors whose earnings are import-cost sensitive — haircut on NGN depreciation.
const IMPORT_SENSITIVE = new Set([
  "CONSUMER GOODS",
  "HEALTHCARE",
  "ICT",
  "INDUSTRIAL GOODS",
]);
const FX_DEPRECIATION_BAND = 0.5; // % daily NGN move that trips the overlay
const FX_HAIRCUT = 0.8; // size multiplier for import-sensitive names when it trips
const HIGH_VOL_RANGE = 0.6; // 52w range width > 60% of price = "hot"
const HIGH_VOL_HAIRCUT = 0.75;

// Split the total book across the three cadences (auto % or manual amounts).
export function resolveAllocation(s: StrategySettings): Record<Cadence, number> {
  if (s.allocation_mode === "manual") {
    return {
      intraday: Math.max(0, s.intraday_capital),
      weekly: Math.max(0, s.weekly_capital),
      monthly: Math.max(0, s.monthly_capital),
    };
  }
  const total = Math.max(0, s.total_capital_ngn);
  return {
    intraday: (total * s.intraday_pct) / 100,
    weekly: (total * s.weekly_pct) / 100,
    monthly: (total * s.monthly_pct) / 100,
  };
}

export interface RiskOverlayInput {
  positions: EnginePosition[];
  bucketNgn: number;
  settings: StrategySettings;
  volumeBySymbol: Record<string, number>; // shares traded / day
  rangePctBySymbol: Record<string, number>; // (52w high - low) / price
  fxDailyChangePct: number; // + = NGN depreciation vs USD
}

export interface RiskOverlayResult {
  positions: EnginePosition[];
  adjustments: string[];
}

// Trim/scale each position to respect the risk limits; drop anything that falls
// below one whole share after the caps. Returns adjusted positions + a log.
export function applyRiskOverlay(input: RiskOverlayInput): RiskOverlayResult {
  const { settings: s, bucketNgn } = input;
  const adjustments: string[] = [];
  const out: EnginePosition[] = [];

  const nameCap = (bucketNgn * s.max_position_pct) / 100;
  const fxTrips = s.fx_overlay && input.fxDailyChangePct > FX_DEPRECIATION_BAND;

  for (const p of input.positions) {
    const sym = p.ticker.toUpperCase();
    if (!(p.entry_price > 0)) continue;
    let target = p.units * p.entry_price;
    const original = target;
    const reasons: string[] = [];

    // 1. Single-name cap.
    if (target > nameCap) {
      target = nameCap;
      reasons.push(`≤${s.max_position_pct}% cap`);
    }

    // 2. Liquidity cap: ≤ max_adv_pct % of daily traded value.
    const vol = input.volumeBySymbol[sym] ?? 0;
    if (vol > 0) {
      const advValue = vol * p.entry_price;
      const advCap = (advValue * s.max_adv_pct) / 100;
      if (target > advCap) {
        target = advCap;
        reasons.push(`ADV liquidity cap`);
      }
    }

    // 3. Volatility scaling: shrink very wide-range names.
    const rp = input.rangePctBySymbol[sym] ?? 0;
    if (rp > HIGH_VOL_RANGE) {
      target *= HIGH_VOL_HAIRCUT;
      reasons.push(`vol haircut`);
    }

    // 4. FX overlay: haircut import-sensitive sectors on NGN depreciation.
    if (fxTrips && IMPORT_SENSITIVE.has((p.sector || "").toUpperCase())) {
      target *= FX_HAIRCUT;
      reasons.push(`FX overlay`);
    }

    const units = Math.floor(target / p.entry_price);
    if (units <= 0) {
      adjustments.push(`Dropped ${sym}: below one share after risk caps`);
      continue;
    }
    const amount = units * p.entry_price;
    if (Math.abs(amount - original) > 1) {
      adjustments.push(`Trimmed ${sym} (${reasons.join(", ")})`);
    }
    out.push({ ...p, ticker: sym, units, amount_ngn: amount });
  }

  return { positions: out, adjustments };
}

// Halt a cadence if its cumulative realized loss breaches the drawdown limit.
export function isDrawdownBreached(
  realizedPnl: number,
  capital: number,
  haltPct: number
): boolean {
  if (!(capital > 0) || !(haltPct > 0)) return false;
  return realizedPnl <= -(capital * haltPct) / 100;
}
