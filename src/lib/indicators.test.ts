import { describe, it, expect } from "vitest";
import { sma, rsi, drawdown, maxDrawdown, annualizedVolatility } from "./indicators";

describe("sma", () => {
  it("returns nulls for the leading window then the moving average", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
  it("resets across gaps rather than smearing", () => {
    const out = sma([1, 2, null, 4, 5, 6], 3);
    expect(out[2]).toBeNull();
    expect(out[5]).toBe(5); // (4+5+6)/3
  });
});

describe("rsi", () => {
  it("stays within 0..100 and is 100 for a monotonic rise", () => {
    const up = Array.from({ length: 30 }, (_, i) => 100 + i);
    const out = rsi(up, 14).filter((v): v is number => v != null);
    expect(out.length).toBeGreaterThan(0);
    out.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
    expect(out.at(-1)).toBeCloseTo(100, 6); // no down moves
  });
});

describe("drawdown", () => {
  it("measures decline from the running peak", () => {
    expect(drawdown([100, 80, 120])).toEqual([0, -20, 0]);
    expect(maxDrawdown([100, 80, 120, 60])).toBeCloseTo(-50, 6); // 60 vs peak 120
  });
});

describe("annualizedVolatility", () => {
  it("is zero for a flat series and null for too few points", () => {
    expect(annualizedVolatility([100, 100, 100, 100])).toBeCloseTo(0, 9);
    expect(annualizedVolatility([100])).toBeNull();
  });
  it("is positive and finite for a varying series", () => {
    const v = annualizedVolatility([100, 102, 99, 103, 98, 105]);
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(0);
    expect(Number.isFinite(v!)).toBe(true);
  });
});
