import { describe, it, expect } from "vitest";
import { runBacktest } from "./backtest";
import type { ChartPoint, IndexChartPoint } from "@/lib/ngx/types";

const bench = (date: string, index_value: number): IndexChartPoint => ({
  date,
  timestamp: 0,
  index_value,
  normalized_value: 0,
  daily_change: 0,
  daily_change_percent: 0,
});

const point = (date: string, close: number): ChartPoint => ({
  timestamp: 0,
  date,
  price: close,
  open: null,
  high: null,
  low: null,
  close,
  volume: null,
  value_traded: null,
  vwap: null,
  trade_count: null,
  change: null,
  change_percent: null,
});

describe("runBacktest", () => {
  const benchmark = [bench("2026-01-01", 100), bench("2026-01-02", 110), bench("2026-01-03", 120)];

  it("rebases both series to 100 at the start", () => {
    const r = runBacktest(
      {
        weights: [{ symbol: "A", weight: 1 }],
        histories: { A: [point("2026-01-01", 50), point("2026-01-02", 55), point("2026-01-03", 60)] },
        benchmark,
      },
      null
    );
    expect(r.series).toHaveLength(3);
    expect(r.series[0].portfolio).toBeCloseTo(100, 6);
    expect(r.series[0].benchmark).toBeCloseTo(100, 6);
    expect(r.series[2].portfolio).toBeCloseTo(120, 6); // 60/50 * 100
    expect(r.series[2].benchmark).toBeCloseTo(120, 6);
    expect(r.portfolioReturn).toBeCloseTo(20, 6);
    expect(r.benchmarkReturn).toBeCloseTo(20, 6);
  });

  it("blends holdings by weight", () => {
    // A doubles, B flat, 50/50 → portfolio ends at 150.
    const r = runBacktest(
      {
        weights: [
          { symbol: "A", weight: 0.5 },
          { symbol: "B", weight: 0.5 },
        ],
        histories: {
          A: [point("2026-01-01", 100), point("2026-01-03", 200)],
          B: [point("2026-01-01", 100), point("2026-01-03", 100)],
        },
        benchmark,
      },
      null
    );
    expect(r.series[2].portfolio).toBeCloseTo(150, 6);
    expect(r.portfolioReturn).toBeCloseTo(50, 6);
  });

  it("forward-fills a holding that is missing an interior date", () => {
    // B has no 2026-01-02 point; forward-fill holds its last known price.
    const r = runBacktest(
      {
        weights: [{ symbol: "B", weight: 1 }],
        histories: { B: [point("2026-01-01", 100), point("2026-01-03", 100)] },
        benchmark,
      },
      null
    );
    expect(r.series[1].portfolio).toBeCloseTo(100, 6); // filled, not null
  });

  it("returns an empty result when the benchmark is empty", () => {
    const r = runBacktest({ weights: [], histories: {}, benchmark: [] }, null);
    expect(r.series).toHaveLength(0);
    expect(r.portfolioReturn).toBeNull();
  });
});
