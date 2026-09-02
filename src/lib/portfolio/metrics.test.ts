import { describe, it, expect } from "vitest";
import { computeMetrics, type EnrichedHolding } from "./metrics";

const eh = (o: Partial<EnrichedHolding> & Pick<EnrichedHolding, "symbol">): EnrichedHolding => ({
  company_name: o.symbol!,
  sector: "",
  mode: "weight",
  entry_price: 100,
  ...o,
});

describe("computeMetrics", () => {
  it("computes the weighted dividend yield", () => {
    const m = computeMetrics([
      eh({ symbol: "A", weight: 50, dividend_yield: 4 }),
      eh({ symbol: "B", weight: 50, dividend_yield: 6 }),
    ]);
    expect(m.weightedDividendYield).toBeCloseTo(5, 6);
  });

  it("computes the weighted P/E from current price and EPS", () => {
    const m = computeMetrics([
      eh({ symbol: "A", weight: 50, current_price: 100, ttm_eps: 10 }), // PE 10
      eh({ symbol: "B", weight: 50, current_price: 200, ttm_eps: 10 }), // PE 20
    ]);
    expect(m.weightedPE).toBeCloseTo(15, 6);
  });

  it("aggregates sector allocation and sorts descending", () => {
    const m = computeMetrics([
      eh({ symbol: "A", sector: "Banking", weight: 20 }),
      eh({ symbol: "B", sector: "Banking", weight: 20 }),
      eh({ symbol: "C", sector: "Oil", weight: 60 }),
    ]);
    expect(m.sectorAllocation[0]).toEqual({ sector: "Oil", pct: 60 });
    expect(m.sectorAllocation.find((s) => s.sector === "Banking")?.pct).toBeCloseTo(40, 6);
  });

  it("reports weight sum and unit-mode invested value", () => {
    const weightMode = computeMetrics([eh({ symbol: "A", weight: 60 }), eh({ symbol: "B", weight: 40 })]);
    expect(weightMode.weightSum).toBeCloseTo(100, 6);
    expect(weightMode.isUnitsMode).toBe(false);

    const unitsMode = computeMetrics([
      eh({ symbol: "A", mode: "units", units: 10, entry_price: 100, weight: null }),
      eh({ symbol: "B", mode: "units", units: 5, entry_price: 200, weight: null }),
    ]);
    expect(unitsMode.isUnitsMode).toBe(true);
    expect(unitsMode.investedValue).toBeCloseTo(2000, 6); // 10*100 + 5*200
  });

  it("ignores holdings missing a metric when averaging", () => {
    const m = computeMetrics([
      eh({ symbol: "A", weight: 50, dividend_yield: 4 }),
      eh({ symbol: "B", weight: 50, dividend_yield: null }),
    ]);
    // Only A contributes → weighted over the 0.5 weight that had data.
    expect(m.weightedDividendYield).toBeCloseTo(4, 6);
  });
});
