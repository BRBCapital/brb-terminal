import { describe, it, expect } from "vitest";
import {
  resolveAllocation,
  applyRiskOverlay,
  isDrawdownBreached,
  type EnginePosition,
} from "./risk";
import type { StrategySettings } from "@/lib/db/strategy";

function settings(over: Partial<StrategySettings> = {}): StrategySettings {
  return {
    id: "default",
    enabled: true,
    execution_mode: "auto",
    allocation_mode: "auto",
    total_capital_ngn: 100_000_000,
    intraday_pct: 20,
    weekly_pct: 30,
    monthly_pct: 50,
    intraday_capital: 0,
    weekly_capital: 0,
    monthly_capital: 0,
    max_position_pct: 15,
    max_adv_pct: 10,
    stop_loss_pct: 8,
    fx_overlay: true,
    drawdown_halt_pct: 20,
    regime_enabled: false,
    regime_dwell_days: 2,
    updated_at: "",
    updated_by: "",
    ...over,
  };
}

function pos(over: Partial<EnginePosition> = {}): EnginePosition {
  return {
    ticker: "TESTCO",
    company_name: "Test Co",
    sector: "FINANCIAL SERVICES",
    entry_price: 100,
    units: 100_000, // ₦10m default
    amount_ngn: 10_000_000,
    target_price: null,
    stop_loss: null,
    rationale: "",
    ...over,
  };
}

// Big liquidity + zero vol so those overlays don't interfere unless tested.
const LIQUID = { TESTCO: 1e12 };
const CALM = { TESTCO: 0 };

describe("resolveAllocation", () => {
  it("auto split by percent", () => {
    expect(resolveAllocation(settings())).toEqual({
      intraday: 20_000_000,
      weekly: 30_000_000,
      monthly: 50_000_000,
    });
  });
  it("manual uses explicit amounts", () => {
    const s = settings({ allocation_mode: "manual", intraday_capital: 5e6, weekly_capital: 7e6, monthly_capital: 9e6 });
    expect(resolveAllocation(s)).toEqual({ intraday: 5e6, weekly: 7e6, monthly: 9e6 });
  });
});

describe("applyRiskOverlay", () => {
  it("enforces the single-name cap", () => {
    const r = applyRiskOverlay({
      positions: [pos({ units: 300_000 })], // ₦30m
      bucketNgn: 100_000_000, // cap = 15% = ₦15m
      settings: settings(),
      volumeBySymbol: LIQUID,
      rangePctBySymbol: CALM,
      fxDailyChangePct: 0,
    });
    expect(r.positions[0].amount_ngn).toBe(15_000_000);
    expect(r.positions[0].units).toBe(150_000);
    expect(r.adjustments.some((a) => a.includes("Trimmed"))).toBe(true);
  });

  it("enforces the ADV liquidity cap", () => {
    const r = applyRiskOverlay({
      positions: [pos({ units: 300_000 })], // wants ₦30m
      bucketNgn: 100_000_000,
      settings: settings(),
      volumeBySymbol: { TESTCO: 10_000 }, // ADV value = 10k*100 = ₦1m; 10% cap = ₦100k
      rangePctBySymbol: CALM,
      fxDailyChangePct: 0,
    });
    expect(r.positions[0].amount_ngn).toBe(100_000);
    expect(r.positions[0].units).toBe(1_000);
  });

  it("applies the FX overlay to import-sensitive sectors on NGN depreciation", () => {
    const r = applyRiskOverlay({
      positions: [pos({ sector: "CONSUMER GOODS", units: 100_000 })], // ₦10m, under cap
      bucketNgn: 100_000_000,
      settings: settings(),
      volumeBySymbol: LIQUID,
      rangePctBySymbol: CALM,
      fxDailyChangePct: 1.0, // NGN depreciated 1% > 0.5% band
    });
    expect(r.positions[0].amount_ngn).toBe(8_000_000); // 10m * 0.8
    expect(r.adjustments.some((a) => a.includes("FX overlay"))).toBe(true);
  });

  it("does not FX-haircut when disabled or move is small", () => {
    const r = applyRiskOverlay({
      positions: [pos({ sector: "CONSUMER GOODS" })],
      bucketNgn: 100_000_000,
      settings: settings({ fx_overlay: false }),
      volumeBySymbol: LIQUID,
      rangePctBySymbol: CALM,
      fxDailyChangePct: 3.0,
    });
    expect(r.positions[0].amount_ngn).toBe(10_000_000);
  });

  it("drops a position that falls below one share after caps", () => {
    const r = applyRiskOverlay({
      positions: [pos({ entry_price: 1000, units: 100 })],
      bucketNgn: 100_000_000,
      settings: settings(),
      volumeBySymbol: { TESTCO: 50 }, // ADV value = 50*1000 = ₦50k; 10% cap = ₦5k < 1 share (₦1000)... 5 shares
      rangePctBySymbol: CALM,
      fxDailyChangePct: 0,
    });
    // ADV cap ₦5,000 → floor(5000/1000)=5 shares, still ≥1, so kept at 5.
    expect(r.positions[0]?.units).toBe(5);
    // Now make the cap sub-share:
    const r2 = applyRiskOverlay({
      positions: [pos({ entry_price: 1000, units: 100 })],
      bucketNgn: 100_000_000,
      settings: settings(),
      volumeBySymbol: { TESTCO: 5 }, // ADV value ₦5k; 10% = ₦500 < ₦1000 → 0 shares
      rangePctBySymbol: CALM,
      fxDailyChangePct: 0,
    });
    expect(r2.positions.length).toBe(0);
    expect(r2.adjustments.some((a) => a.includes("Dropped"))).toBe(true);
  });
});

describe("isDrawdownBreached", () => {
  it("trips at/below the halt threshold", () => {
    expect(isDrawdownBreached(-25_000_000, 100_000_000, 20)).toBe(true);
    expect(isDrawdownBreached(-20_000_000, 100_000_000, 20)).toBe(true);
    expect(isDrawdownBreached(-10_000_000, 100_000_000, 20)).toBe(false);
    expect(isDrawdownBreached(5_000_000, 100_000_000, 20)).toBe(false);
  });
});
