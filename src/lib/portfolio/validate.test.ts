import { describe, it, expect } from "vitest";
import { validatePortfolio, effectiveWeights, DEFAULT_THRESHOLDS } from "./validate";
import type { HoldingInput, PortfolioInput } from "@/lib/db/portfolios";

const h = (o: Partial<HoldingInput> & Pick<HoldingInput, "symbol">): HoldingInput => ({
  mode: "weight",
  entry_price: 100,
  ...o,
});

const pf = (holdings: HoldingInput[], name = "Test"): PortfolioInput => ({
  name,
  holdings,
});

function errors(input: PortfolioInput) {
  return validatePortfolio(input).filter((i) => i.level === "error").map((i) => i.message);
}
function warnings(input: PortfolioInput) {
  return validatePortfolio(input).filter((i) => i.level === "warning");
}

describe("validatePortfolio — errors", () => {
  it("requires a name", () => {
    expect(errors(pf([h({ symbol: "A", weight: 100 })], ""))).toContain("Portfolio needs a name.");
  });

  it("requires at least one holding", () => {
    expect(errors(pf([]))).toContain("Add at least one holding.");
  });

  it("flags weights that do not sum to 100 (weight mode)", () => {
    const msgs = errors(pf([h({ symbol: "A", weight: 60 }), h({ symbol: "B", weight: 30 })]));
    expect(msgs.some((m) => m.includes("must total 100%"))).toBe(true);
  });

  it("accepts weights summing to exactly 100", () => {
    const msgs = errors(pf([h({ symbol: "A", weight: 60 }), h({ symbol: "B", weight: 40 })]));
    expect(msgs.some((m) => m.includes("must total 100%"))).toBe(false);
  });

  it("rejects non-positive entry price and weight", () => {
    expect(errors(pf([h({ symbol: "A", weight: 100, entry_price: 0 })]))).toContain(
      "A: entry price must be greater than zero."
    );
    expect(errors(pf([h({ symbol: "A", weight: 0 })]))).toContain(
      "A: weight must be greater than zero."
    );
  });

  it("flags duplicate symbols", () => {
    const msgs = errors(pf([h({ symbol: "A", weight: 50 }), h({ symbol: "A", weight: 50 })]));
    expect(msgs.some((m) => m.includes("Duplicate holding"))).toBe(true);
  });
});

describe("validatePortfolio — concentration warnings", () => {
  it("warns on a single stock above 10%", () => {
    const w = warnings(pf([h({ symbol: "A", weight: 60 }), h({ symbol: "B", weight: 40 })]));
    expect(w.some((x) => x.message.includes("A is 60.0%"))).toBe(true);
  });

  it("warns on a sector above 30%", () => {
    const input = pf([
      h({ symbol: "A", sector: "Banking", weight: 20 }),
      h({ symbol: "B", sector: "Banking", weight: 20 }),
      h({ symbol: "C", sector: "Oil", weight: 60 }),
    ]);
    const w = warnings(input);
    expect(w.some((x) => x.message.includes("Banking is 40.0%"))).toBe(true);
  });

  it("respects custom thresholds", () => {
    const input = pf([h({ symbol: "A", weight: 50 }), h({ symbol: "B", weight: 50 })]);
    const relaxed = validatePortfolio(input, { singleStockMaxPct: 60, sectorMaxPct: 100 });
    expect(relaxed.filter((i) => i.level === "warning")).toHaveLength(0);
    expect(DEFAULT_THRESHOLDS.singleStockMaxPct).toBe(10);
  });
});

describe("effectiveWeights", () => {
  it("returns stated weights in weight mode", () => {
    const w = effectiveWeights([h({ symbol: "A", weight: 70 }), h({ symbol: "B", weight: 30 })]);
    expect(w.map((x) => x.pct)).toEqual([70, 30]);
  });

  it("derives market-value weights in units mode", () => {
    const w = effectiveWeights([
      h({ symbol: "A", mode: "units", units: 10, entry_price: 100, weight: null }), // value 1000
      h({ symbol: "B", mode: "units", units: 10, entry_price: 300, weight: null }), // value 3000
    ]);
    expect(w[0].pct).toBeCloseTo(25, 6);
    expect(w[1].pct).toBeCloseTo(75, 6);
  });
});
