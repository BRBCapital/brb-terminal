import { describe, it, expect } from "vitest";
import {
  dailyReturns,
  correlation,
  riskMetrics,
  maxDrawdown,
  correlationMatrix,
} from "./risk";

function levelsFromReturns(rets: number[], start = 100): number[] {
  const out = [start];
  for (const r of rets) out.push(out[out.length - 1] * (1 + r));
  return out;
}

describe("dailyReturns", () => {
  it("computes simple returns", () => {
    expect(dailyReturns([100, 110, 121])).toEqual([expect.closeTo(0.1, 6), expect.closeTo(0.1, 6)]);
  });
});

describe("correlation", () => {
  it("is +1 for a positive scaling and -1 for a negation", () => {
    const a = [0.01, -0.02, 0.03, -0.01, 0.02];
    expect(correlation(a, a.map((x) => 2 * x))).toBeCloseTo(1, 6);
    expect(correlation(a, a.map((x) => -x))).toBeCloseTo(-1, 6);
  });
});

describe("maxDrawdown", () => {
  it("measures the largest peak-to-trough decline", () => {
    expect(maxDrawdown([100, 120, 90, 130])).toBeCloseTo(-25, 6); // 90 vs peak 120
  });
});

describe("riskMetrics", () => {
  const benchRets = [0.01, -0.02, 0.03, 0.01, -0.01, 0.02, -0.015, 0.005];

  it("gives beta 1, correlation 1, zero tracking error when portfolio == benchmark", () => {
    const levels = levelsFromReturns(benchRets);
    const m = riskMetrics(levels, levels, 0)!;
    expect(m.beta).toBeCloseTo(1, 6);
    expect(m.correlation).toBeCloseTo(1, 6);
    expect(m.rSquared).toBeCloseTo(1, 6);
    expect(m.trackingError).toBeCloseTo(0, 6);
    expect(m.alpha).toBeCloseTo(0, 6);
    expect(m.annVol).toBeCloseTo(m.benchAnnVol, 6);
  });

  it("recovers beta ≈ 2 when portfolio returns are twice the benchmark", () => {
    const bench = levelsFromReturns(benchRets);
    const port = levelsFromReturns(benchRets.map((r) => 2 * r));
    const m = riskMetrics(port, bench, 0)!;
    expect(m.beta).toBeCloseTo(2, 4);
    expect(m.correlation).toBeCloseTo(1, 4);
  });

  it("returns null with too few observations", () => {
    expect(riskMetrics([100, 101], [100, 101], 0)).toBeNull();
  });

  it("reports a positive VaR for a volatile series", () => {
    const port = levelsFromReturns([0.02, -0.05, 0.03, -0.04, 0.01, -0.06, 0.02, -0.03]);
    const bench = levelsFromReturns(benchRets);
    const m = riskMetrics(port, bench, 0)!;
    expect(m.var95).toBeGreaterThan(0);
    expect(m.cvar95).toBeGreaterThanOrEqual(m.var95 - 1e-9);
  });
});

describe("correlationMatrix", () => {
  it("has a unit diagonal and is symmetric", () => {
    const { symbols, matrix } = correlationMatrix({
      A: [100, 101, 102, 101, 103],
      B: [50, 49, 48, 49, 47],
    });
    expect(symbols).toEqual(["A", "B"]);
    expect(matrix[0][0]).toBe(1);
    expect(matrix[1][1]).toBe(1);
    expect(matrix[0][1]).toBeCloseTo(matrix[1][0], 6);
  });
});
