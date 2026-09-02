import { describe, it, expect } from "vitest";
import { curveStats, runBacktest } from "./backtest";

describe("curveStats", () => {
  it("handles empty input", () => {
    const s = curveStats([]);
    expect(s.totalReturn).toBe(0);
    expect(s.maxDrawdown).toBe(0);
    expect(s.sharpe).toBe(0);
  });
  it("compounds returns and reports zero drawdown when monotonic up", () => {
    const s = curveStats([0.1, 0.1]);
    expect(s.totalReturn).toBeCloseTo(0.21, 5);
    expect(s.maxDrawdown).toBe(0);
  });
  it("measures drawdown", () => {
    const s = curveStats([0.5, -0.5]); // 1 → 1.5 → 0.75
    expect(s.totalReturn).toBeCloseTo(-0.25, 5);
    expect(s.maxDrawdown).toBeCloseTo(0.5, 5);
  });
});

// Build a synthetic index: long calm uptrend, then a sharp crash after warmup.
function syntheticSeries() {
  const dates: string[] = [];
  const value: number[] = [];
  const dailyPct: number[] = [];
  let px = 1000;
  const push = (d: string, pct: number) => {
    const prev = px;
    px = px * (1 + pct / 100);
    dates.push(d);
    value.push(px);
    dailyPct.push(((px - prev) / prev) * 100);
  };
  // 160 calm-up days
  for (let i = 0; i < 160; i++) push(`2015-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`, 0.15);
  // 45-day crash at -3%/day
  for (let i = 0; i < 45; i++) push(`2016-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`, -3);
  return { dates, value, dailyPct };
}

describe("runBacktest", () => {
  const res = runBacktest(syntheticSeries(), {}, 2);

  it("overlay drawdown never exceeds baseline (exposure ∈ [0,1])", () => {
    expect(res.overlay.maxDrawdown).toBeLessThanOrEqual(res.baseline.maxDrawdown + 1e-9);
  });
  it("de-risks during the crash (reduces the worst drawdown)", () => {
    expect(res.ddReductionPct).toBeGreaterThan(0);
    expect(res.pctDeRisked).toBeGreaterThan(0);
  });
  it("produces a chartable equity series", () => {
    expect(res.equity.length).toBeGreaterThan(0);
    for (const p of res.equity) {
      expect(p.exposure).toBeGreaterThanOrEqual(0);
      expect(p.exposure).toBeLessThanOrEqual(1);
    }
  });
});
