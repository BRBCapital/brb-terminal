import "server-only";
import { getSettings, listAllTrades, listPortfolios } from "@/lib/db/strategy";
import type { StrategyPortfolio } from "@/lib/db/strategy";
import { buildOverview, type OverviewData } from "./overview";
import { ngxFetch } from "@/lib/ngx/client";
import type { CompanyDetail } from "@/lib/ngx/types";

// A period is either a month "YYYY-MM" or a year "YYYY".
export function periodScope(period: string): "month" | "year" {
  return period.length === 4 ? "year" : "month";
}
function matches(tradePeriod: string, period: string): boolean {
  return period.length === 4 ? tradePeriod.slice(0, 4) === period : tradePeriod === period;
}

export interface PeriodOverview {
  period: string;
  scope: "month" | "year";
  overview: OverviewData;
  portfolios: StrategyPortfolio[];
  trade_count: number;
}

// Filter the ledger to a month or year, mark open positions to live prices, and
// run the shared buildOverview aggregation. Reused by the profile detail route
// and the AI performance report.
export async function getPeriodOverview(period: string): Promise<PeriodOverview> {
  const [settings, all, portfolios] = await Promise.all([
    getSettings(),
    listAllTrades(),
    listPortfolios(),
  ]);
  const trades = all.filter((t) => matches(t.period, period));

  const openSyms = [
    ...new Set(trades.filter((t) => t.status === "open").map((t) => t.symbol.toUpperCase())),
  ];
  const priceBySymbol: Record<string, number | null> = {};
  await Promise.all(
    openSyms.map(async (sym) => {
      const res = await ngxFetch<CompanyDetail>({ path: `companies/${sym}` });
      priceBySymbol[sym] = res.ok ? res.data.current_price ?? res.data.prev_close ?? null : null;
    })
  );

  return {
    period,
    scope: periodScope(period),
    overview: buildOverview({ settings, trades, priceBySymbol, runs: [] }),
    portfolios: portfolios.filter((p) => matches(p.period, period)),
    trade_count: trades.length,
  };
}

// Distinct months and years on record (newest first).
export function listPeriods(months: string[]): { months: string[]; years: string[] } {
  const m = [...new Set(months)].sort((a, b) => (a < b ? 1 : -1));
  const y = [...new Set(months.map((p) => p.slice(0, 4)))].sort((a, b) => (a < b ? 1 : -1));
  return { months: m, years: y };
}
