import { describe, it, expect } from "vitest";
import {
  projectFundamental,
  sensitivityGrid,
  forecastDividends,
  type FundamentalAssumptions,
} from "./fundamental";

const base: FundamentalAssumptions = {
  ttmEps: 50,
  currentPrice: 1000,
  revenueGrowthPct: 12,
  marginDeltaPct: 0,
  exitPe: 20,
  years: 3,
  payoutRatioPct: 40,
};

describe("projectFundamental", () => {
  it("compounds EPS and applies the exit multiple", () => {
    const r = projectFundamental(base);
    expect(r.projectedEps).toBeCloseTo(50 * 1.12 ** 3, 6); // 70.2464
    expect(r.impliedPrice).toBeCloseTo(50 * 1.12 ** 3 * 20, 4); // 1404.928
    expect(r.priceReturnPct).toBeCloseTo(40.49, 1);
    expect(r.priceCagrPct).toBeCloseTo(12, 1);
    expect(r.projectedDps).toBeCloseTo(r.projectedEps * 0.4, 6);
  });

  it("adds the margin kicker to earnings growth", () => {
    const withMargin = projectFundamental({ ...base, marginDeltaPct: 3 });
    expect(withMargin.projectedEps).toBeCloseTo(50 * 1.15 ** 3, 6);
  });
});

describe("sensitivityGrid", () => {
  it("has one row per P/E and one column per growth value", () => {
    const g = sensitivityGrid(base, [2, 7, 12], [16, 20, 24]);
    expect(g.cells).toHaveLength(3); // P/E rows
    expect(g.cells[0]).toHaveLength(3); // growth cols
    // Higher P/E and higher growth → strictly larger implied price.
    expect(g.cells[2][2]).toBeGreaterThan(g.cells[0][0]);
  });
});

describe("forecastDividends", () => {
  it("de-duplicates identical same-year payouts (Annual + 12M)", () => {
    const fc = forecastDividends(
      [
        { ex_dividend_date: "2026-06-18", dividend: 45 },
        { ex_dividend_date: "2026-06-17", dividend: 45 }, // duplicate of the FY payout
        { ex_dividend_date: "2025-06-09", dividend: 36 },
        { ex_dividend_date: "2024-05-15", dividend: 30 },
        { ex_dividend_date: "2023-04-20", dividend: 24 },
      ],
      1000,
      5
    );
    expect(fc.recentAnnualDps).toBe(45); // not 90
    expect(fc.estimatedGrowthPct).toBeGreaterThan(0);
    expect(fc.projections).toHaveLength(5);
    expect(fc.projections[0].dps).toBeCloseTo(45 * (1 + fc.estimatedGrowthPct / 100), 4);
  });

  it("clamps runaway growth to a sane band", () => {
    const fc = forecastDividends(
      [
        { ex_dividend_date: "2024-01-01", dividend: 1 },
        { ex_dividend_date: "2025-01-01", dividend: 50 },
        { ex_dividend_date: "2026-01-01", dividend: 500 },
      ],
      1000
    );
    expect(fc.estimatedGrowthPct).toBeLessThanOrEqual(25.0001);
  });
});
