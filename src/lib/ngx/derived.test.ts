import { describe, it, expect } from "vitest";
import { deriveSectors, deriveBreadth, deriveYtd } from "./derived";
import type { CompanyListRow } from "./types";

const row = (o: Partial<CompanyListRow> & Pick<CompanyListRow, "symbol">): CompanyListRow => ({
  id: 1,
  name: o.symbol,
  logo_url: "",
  sector: "BANKING",
  sub_sector: null,
  market_classification: null,
  shares_outstanding: null,
  website: null,
  price: 100,
  prev_close: null,
  day_high: null,
  day_low: null,
  volume: null,
  market_cap: 1000,
  price_change: null,
  price_change_percent: 0,
  change_7d_percent: 0,
  change_52w_percent: 0,
  change_1m_percent: null,
  change_ytd_percent: 0,
  high_52wk: null,
  low_52wk: null,
  last_updated: null,
  ...o,
});

describe("deriveSectors", () => {
  it("computes equal-weighted sector means, breadth, and cap sums", () => {
    const sectors = deriveSectors([
      row({ symbol: "A", sector: "BANKING", price_change_percent: 2, change_7d_percent: 4, market_cap: 100 }),
      row({ symbol: "B", sector: "BANKING", price_change_percent: -1, change_7d_percent: 2, market_cap: 200 }),
      row({ symbol: "C", sector: "OIL", price_change_percent: 5, change_7d_percent: 10, market_cap: 50 }),
    ]);
    expect(sectors[0].sector).toBe("OIL"); // sorted by 1d change desc
    const banking = sectors.find((s) => s.sector === "BANKING")!;
    expect(banking.change_1d).toBeCloseTo(0.5, 6); // mean(2, -1)
    expect(banking.change_7d).toBeCloseTo(3, 6);
    expect(banking.total_market_cap).toBe(300);
    expect(banking.breadth).toEqual({ advancers: 1, decliners: 1, unchanged: 0 });
  });

  it("ignores null fields rather than treating them as zero", () => {
    const [s] = deriveSectors([
      row({ symbol: "A", price_change_percent: 4 }),
      row({ symbol: "B", price_change_percent: null }),
    ]);
    expect(s.change_1d).toBeCloseTo(4, 6); // only A counted
  });
});

describe("deriveBreadth", () => {
  it("counts advancers/decliners/unchanged, skipping nulls", () => {
    const b = deriveBreadth([
      row({ symbol: "A", price_change_percent: 1 }),
      row({ symbol: "B", price_change_percent: -2 }),
      row({ symbol: "C", price_change_percent: 0 }),
      row({ symbol: "D", price_change_percent: null }),
    ]);
    expect(b).toEqual({ advancers: 1, decliners: 1, unchanged: 1, total: 3 });
  });
});

describe("deriveYtd", () => {
  const rows = [
    row({ symbol: "A", change_ytd_percent: 50 }),
    row({ symbol: "B", change_ytd_percent: -20 }),
    row({ symbol: "C", change_ytd_percent: 120 }),
    row({ symbol: "D", change_ytd_percent: null }),
  ];
  it("ranks best and worst and drops nulls", () => {
    expect(deriveYtd(rows, "best", 2).map((r) => r.symbol)).toEqual(["C", "A"]);
    expect(deriveYtd(rows, "worst", 1).map((r) => r.symbol)).toEqual(["B"]);
  });
});
