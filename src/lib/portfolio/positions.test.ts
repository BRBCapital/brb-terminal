import { describe, it, expect } from "vitest";
import { computePositions, valuePositions, type LedgerTx } from "./positions";

const tx = (o: Partial<LedgerTx> & Pick<LedgerTx, "symbol" | "kind" | "trade_date">): LedgerTx => ({
  units: 0,
  price: 0,
  fees: 0,
  amount: 0,
  ...o,
});

describe("computePositions — average cost", () => {
  it("blends two buys into a weighted average cost", () => {
    const [p] = computePositions([
      tx({ symbol: "DANGCEM", kind: "buy", trade_date: "2025-07-11", units: 4775, price: 900 }),
      tx({ symbol: "DANGCEM", kind: "buy", trade_date: "2026-01-15", units: 500, price: 1000 }),
    ]);
    expect(p.units).toBe(5275);
    expect(p.costBasis).toBeCloseTo(4_797_500, 2); // 4775*900 + 500*1000
    expect(p.avgCost).toBeCloseTo(909.4787, 3);
    expect(p.realisedPnl).toBe(0);
  });

  it("realises P&L on a partial sell against the running average", () => {
    const [p] = computePositions([
      tx({ symbol: "ZENITHBANK", kind: "buy", trade_date: "2025-07-11", units: 45126, price: 48 }),
      tx({ symbol: "ZENITHBANK", kind: "sell", trade_date: "2026-03-01", units: 5000, price: 95 }),
    ]);
    expect(p.units).toBe(40126);
    expect(p.realisedPnl).toBeCloseTo(235_000, 2); // 5000 * (95 - 48)
    expect(p.costBasis).toBeCloseTo(40126 * 48, 2); // remaining at avg cost
    expect(p.avgCost).toBeCloseTo(48, 6);
  });

  it("includes fees in cost basis", () => {
    const [p] = computePositions([
      tx({ symbol: "X", kind: "buy", trade_date: "2026-01-01", units: 100, price: 10, fees: 50 }),
    ]);
    expect(p.costBasis).toBe(1050); // 100*10 + 50
    expect(p.avgCost).toBeCloseTo(10.5, 6);
  });

  it("accumulates dividends without touching cost basis or units", () => {
    const [p] = computePositions([
      tx({ symbol: "D", kind: "buy", trade_date: "2026-01-01", units: 100, price: 10 }),
      tx({ symbol: "D", kind: "dividend", trade_date: "2026-06-01", amount: 250 }),
    ]);
    expect(p.units).toBe(100);
    expect(p.costBasis).toBe(1000);
    expect(p.dividends).toBe(250);
  });

  it("zeroes out a fully closed position", () => {
    const [p] = computePositions([
      tx({ symbol: "F", kind: "buy", trade_date: "2026-01-01", units: 100, price: 10 }),
      tx({ symbol: "F", kind: "sell", trade_date: "2026-02-01", units: 100, price: 12 }),
    ]);
    expect(p.units).toBe(0);
    expect(p.costBasis).toBe(0);
    expect(p.realisedPnl).toBeCloseTo(200, 6);
  });

  it("orders chronologically regardless of input order", () => {
    const [p] = computePositions([
      tx({ symbol: "O", kind: "sell", trade_date: "2026-02-01", units: 50, price: 20 }),
      tx({ symbol: "O", kind: "buy", trade_date: "2026-01-01", units: 100, price: 10 }),
    ]);
    // Buy processed first (Jan), then sell (Feb): realised = 50*(20-10)=500
    expect(p.units).toBe(50);
    expect(p.realisedPnl).toBeCloseTo(500, 6);
  });
});

describe("valuePositions — totals reconcile", () => {
  it("computes market value, unrealised P&L and portfolio totals", () => {
    const positions = computePositions([
      tx({ symbol: "DANGCEM", kind: "buy", trade_date: "2025-07-11", units: 4775, price: 900 }),
      tx({ symbol: "DANGCEM", kind: "buy", trade_date: "2026-01-15", units: 500, price: 1000 }),
      tx({ symbol: "ZENITHBANK", kind: "buy", trade_date: "2025-07-11", units: 45126, price: 48 }),
      tx({ symbol: "ZENITHBANK", kind: "sell", trade_date: "2026-03-01", units: 5000, price: 95 }),
      tx({ symbol: "DANGCEM", kind: "dividend", trade_date: "2026-06-18", amount: 214875 }),
    ]);
    const { valued, totals } = valuePositions(positions, {
      DANGCEM: { price: 1047, prevClose: 1047, sector: "INDUSTRIAL GOODS", name: "Dangote" },
      ZENITHBANK: { price: 110.8, prevClose: 110, sector: "FINANCIAL SERVICES", name: "Zenith" },
    });

    const dang = valued.find((v) => v.symbol === "DANGCEM")!;
    expect(dang.marketValue).toBeCloseTo(5_522_925, 2); // 5275 * 1047
    expect(dang.unrealisedPnl).toBeCloseTo(725_425, 2); // 5,522,925 - 4,797,500

    expect(totals.marketValue).toBeCloseTo(5_522_925 + 40126 * 110.8, 2);
    expect(totals.realisedPnl).toBeCloseTo(235_000, 2);
    expect(totals.dividends).toBeCloseTo(214_875, 2);
    expect(totals.unrealisedPnl).toBeCloseTo(totals.marketValue - totals.costBasis, 2);
  });

  it("leaves value null when a quote is missing", () => {
    const positions = computePositions([
      tx({ symbol: "NOQUOTE", kind: "buy", trade_date: "2026-01-01", units: 10, price: 5 }),
    ]);
    const { valued } = valuePositions(positions, {});
    expect(valued[0].marketValue).toBeNull();
    expect(valued[0].unrealisedPnl).toBeNull();
  });

  it("does not fabricate a phantom loss from an unpriced holding's cost", () => {
    // A (priced, up): cost 80, MV 100 → +20. B (no quote): cost 50, MV null.
    const positions = computePositions([
      tx({ symbol: "A", kind: "buy", trade_date: "2026-01-01", units: 10, price: 8 }), // cost 80
      tx({ symbol: "B", kind: "buy", trade_date: "2026-01-01", units: 10, price: 5 }), // cost 50
    ]);
    const { totals } = valuePositions(positions, {
      A: { price: 10, prevClose: 10, sector: "X", name: "A" },
      // B intentionally absent → marketValue null
    });
    expect(totals.marketValue).toBeCloseTo(100, 6);
    expect(totals.costBasis).toBeCloseTo(130, 6); // full book cost still reported
    // Unrealised must reflect ONLY the priced position (+20), not 100-130 = -30.
    expect(totals.unrealisedPnl).toBeCloseTo(20, 6);
    expect(totals.unrealisedPct).toBeCloseTo(25, 6); // 20 / 80 priced cost
  });
});
