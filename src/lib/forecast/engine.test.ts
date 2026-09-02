import { describe, it, expect } from "vitest";
import { makeRng, seedFromString, fitLogLinear, logReturns, forecast } from "./engine";

describe("makeRng", () => {
  it("is deterministic for a given seed", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    seqA.forEach((x) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    });
  });

  it("differs across seeds", () => {
    expect(makeRng(1)()).not.toEqual(makeRng(2)());
    expect(seedFromString("DANGCEM")).not.toEqual(seedFromString("GTCO"));
  });
});

describe("fitLogLinear", () => {
  it("recovers the growth rate of a clean exponential (R² ≈ 1)", () => {
    const closes = [100, 110, 121, 133.1, 146.41]; // ×1.1 each step
    const { b, r2 } = fitLogLinear(closes);
    expect(b).toBeCloseTo(Math.log(1.1), 4); // daily drift = ln(1.1)
    expect(r2).toBeCloseTo(1, 5);
  });
});

describe("logReturns", () => {
  it("computes log returns and skips non-positive prices", () => {
    const r = logReturns([100, 110]);
    expect(r).toHaveLength(1);
    expect(r[0]).toBeCloseTo(Math.log(1.1), 6);
  });
});

describe("forecast", () => {
  it("is reproducible for a fixed seed", () => {
    const closes = Array.from({ length: 300 }, (_, i) => 100 * Math.exp(0.0005 * i));
    const a = forecast(closes, { seed: 7, paths: 400 });
    const b = forecast(closes, { seed: 7, paths: 400 });
    expect(a.horizons).toEqual(b.horizons);
  });

  it("keeps bands ordered p10 ≤ p50 ≤ p90 at every step", () => {
    const closes = Array.from({ length: 300 }, (_, i) => 100 + Math.sin(i / 5) * 5 + i * 0.1);
    const { bands } = forecast(closes, { seed: 3, paths: 800 });
    for (const p of bands) {
      expect(p.p10).toBeLessThanOrEqual(p.p50 + 1e-9);
      expect(p.p50).toBeLessThanOrEqual(p.p90 + 1e-9);
    }
  });

  it("collapses to a flat forecast when history has zero volatility", () => {
    const flat = Array.from({ length: 200 }, () => 100);
    const { stats, horizons } = forecast(flat, { seed: 1, paths: 200 });
    expect(stats.dailyVol).toBeCloseTo(0, 9);
    expect(stats.lastPrice).toBe(100);
    // No drift, no vol → every simulated path stays at 100.
    expect(horizons[0].base).toBeCloseTo(100, 6);
    expect(horizons[0].bull).toBeCloseTo(100, 6);
    expect(horizons[0].bear).toBeCloseTo(100, 6);
  });
});
