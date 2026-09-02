import { describe, it, expect } from "vitest";
import { computeRegime, exposureMultFor, resolveEffectiveState, type RegimeInputs } from "./regime";

const base: RegimeInputs = {
  asiTodayPct: 0, asi7dPct: 0, asiYtdPct: 0, advancers: 50, decliners: 50,
  pctPositive1m: 0.5, pctUpperRange: 0.5, avgAbsDailyPct: 1.2, dispersionPct: 1.8, fxDailyPct: 0,
};

describe("computeRegime", () => {
  it("strong bull → RISK_ON with high score & near-full exposure", () => {
    const r = computeRegime({ ...base, asiYtdPct: 25, asi7dPct: 4, asiTodayPct: 1.2, advancers: 70, decliners: 20, pctPositive1m: 0.72, pctUpperRange: 0.68, avgAbsDailyPct: 1.0, fxDailyPct: -0.1 });
    expect(r.state).toBe("RISK_ON");
    expect(r.score).toBeGreaterThan(0.6);
    expect(r.exposure_mult).toBeGreaterThan(0.85);
  });

  it("breadth breakdown → RISK_OFF with reduced exposure", () => {
    const r = computeRegime({ ...base, asiYtdPct: -12, asi7dPct: -4, asiTodayPct: -1.5, advancers: 15, decliners: 75, pctPositive1m: 0.25, pctUpperRange: 0.28, avgAbsDailyPct: 2.4, fxDailyPct: 0.4 });
    expect(["RISK_OFF", "CRISIS"]).toContain(r.state);
    expect(r.score).toBeLessThan(0.4);
    expect(r.exposure_mult).toBeLessThanOrEqual(0.5);
  });

  it("FX shock forces CRISIS regardless of a positive trend", () => {
    const r = computeRegime({ ...base, asiYtdPct: 10, advancers: 60, decliners: 30, pctPositive1m: 0.6, fxDailyPct: 4.5 });
    expect(r.state).toBe("CRISIS");
    expect(r.exposure_mult).toBe(0.1);
  });

  it("volatility blowout forces CRISIS", () => {
    const r = computeRegime({ ...base, asiYtdPct: 8, avgAbsDailyPct: 4.6 });
    expect(r.state).toBe("CRISIS");
  });

  it("risk-on score is monotonic in trend", () => {
    const lo = computeRegime({ ...base, asiYtdPct: -5 }).score;
    const hi = computeRegime({ ...base, asiYtdPct: 20 }).score;
    expect(hi).toBeGreaterThan(lo);
  });

  it("components and exposure stay within [0,1]", () => {
    const r = computeRegime({ ...base, asiYtdPct: 40, fxDailyPct: -3 });
    for (const v of [r.score, r.exposure_mult, r.components.trend, r.components.breadth, r.components.volatility, r.components.fx]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("exposureMultFor", () => {
  it("floors CRISIS and rises monotonically across states", () => {
    expect(exposureMultFor("CRISIS", 0.1)).toBe(0.1);
    expect(exposureMultFor("RISK_OFF", 0.3)).toBeLessThan(exposureMultFor("NEUTRAL", 0.5));
    expect(exposureMultFor("NEUTRAL", 0.5)).toBeLessThan(exposureMultFor("RISK_ON", 0.85));
    expect(exposureMultFor("RISK_ON", 0.95)).toBeLessThanOrEqual(1);
  });
});

describe("resolveEffectiveState (hysteresis: fast de-risk, slow re-risk)", () => {
  it("de-risks immediately regardless of history", () => {
    expect(resolveEffectiveState("CRISIS", ["RISK_ON", "RISK_ON"], 2)).toBe("CRISIS");
    expect(resolveEffectiveState("RISK_OFF", ["RISK_ON"], 2)).toBe("RISK_OFF");
  });
  it("holds defensive until the dwell window is all clear", () => {
    expect(resolveEffectiveState("RISK_ON", ["RISK_OFF", "RISK_ON"], 2)).toBe("RISK_OFF");
    expect(resolveEffectiveState("RISK_ON", ["RISK_ON", "RISK_ON"], 2)).toBe("RISK_ON");
  });
  it("dwell 0 re-risks immediately (no hysteresis)", () => {
    expect(resolveEffectiveState("RISK_ON", ["RISK_OFF"], 0)).toBe("RISK_ON");
  });
});
