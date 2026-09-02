import { describe, it, expect } from "vitest";
import { sectorDefensiveness, scoreDefensive, selectDefensiveSleeve } from "./defensive";
import type { CompanyListRow } from "@/lib/ngx/types";
import type { StrategySettings } from "@/lib/db/strategy";

function row(over: Partial<CompanyListRow>): CompanyListRow {
  return {
    id: 0, symbol: "X", name: "X Co", logo_url: "", sector: "", sub_sector: null,
    market_classification: null, shares_outstanding: null, website: null,
    price: 100, prev_close: 100, day_high: null, day_low: null, volume: 2000,
    market_cap: null, price_change: null, price_change_percent: null,
    change_7d_percent: null, change_52w_percent: null, change_1m_percent: 0,
    change_ytd_percent: null, high_52wk: 120, low_52wk: 90, last_updated: null,
    ...over,
  } as CompanyListRow;
}

const settings = { stop_loss_pct: 8, max_position_pct: 15 } as unknown as StrategySettings;

const universe: CompanyListRow[] = [
  row({ symbol: "STAPLE", sector: "CONSUMER GOODS", price: 100, high_52wk: 105, low_52wk: 95, change_1m_percent: 1, volume: 6000 }), // defensive, low-vol
  row({ symbol: "TELCO", sector: "ICT / TELECOMMUNICATIONS", price: 200, high_52wk: 215, low_52wk: 185, change_1m_percent: 2, volume: 8000 }), // defensive
  row({ symbol: "OILCO", sector: "OIL AND GAS", price: 50, high_52wk: 120, low_52wk: 20, change_1m_percent: 9, volume: 6000 }), // cyclical, high-vol
  row({ symbol: "KNIFE", sector: "CONSUMER GOODS", price: 30, high_52wk: 90, low_52wk: 25, change_1m_percent: -22, volume: 6000 }), // falling knife → excluded
  row({ symbol: "ILLIQ", sector: "HEALTHCARE", price: 10, volume: 0 }), // illiquid → excluded
];

describe("sectorDefensiveness", () => {
  it("scores staples/telecom/health high and cyclicals low", () => {
    expect(sectorDefensiveness("CONSUMER GOODS")).toBe(1);
    expect(sectorDefensiveness("HEALTHCARE")).toBe(1);
    expect(sectorDefensiveness("OIL AND GAS")).toBe(0.2);
    expect(sectorDefensiveness("FINANCIAL SERVICES")).toBe(0.2);
  });
});

describe("scoreDefensive", () => {
  const scored = scoreDefensive(universe);
  it("excludes falling knives and illiquid names", () => {
    const syms = scored.map((s) => s.row.symbol);
    expect(syms).not.toContain("KNIFE");
    expect(syms).not.toContain("ILLIQ");
  });
  it("ranks a low-vol defensive name above a high-vol cyclical", () => {
    const syms = scored.map((s) => s.row.symbol);
    expect(syms.indexOf("STAPLE")).toBeLessThan(syms.indexOf("OILCO"));
  });
});

describe("selectDefensiveSleeve", () => {
  const { positions } = selectDefensiveSleeve({ universe, bucketNgn: 1_000_000, settings });
  it("returns positions within the bucket with valid stops/targets", () => {
    expect(positions.length).toBeGreaterThan(0);
    const total = positions.reduce((s, p) => s + p.amount_ngn, 0);
    expect(total).toBeLessThanOrEqual(1_000_000);
    for (const p of positions) {
      expect(p.units).toBeGreaterThan(0);
      expect(p.stop_loss!).toBeLessThan(p.entry_price);
      expect(p.target_price!).toBeGreaterThan(p.entry_price);
    }
  });
});
