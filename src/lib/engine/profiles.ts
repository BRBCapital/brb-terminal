// Monthly trading-profile summaries — one entry per YYYY-MM the engine has
// booked trades in (by opening month). The per-month performance statement itself
// reuses buildOverview() over the month's trades.

import type { StrategyTrade, Cadence } from "@/lib/db/strategy";

export interface MonthlyProfileSummary {
  period: string; // YYYY-MM
  trade_count: number;
  open_count: number;
  closed_count: number;
  realized: number;
  cadences: Cadence[];
}

export function listMonthlyProfiles(trades: StrategyTrade[]): MonthlyProfileSummary[] {
  const map = new Map<string, MonthlyProfileSummary>();
  for (const t of trades) {
    const row =
      map.get(t.period) ??
      { period: t.period, trade_count: 0, open_count: 0, closed_count: 0, realized: 0, cadences: [] };
    row.trade_count++;
    if (t.status === "open") {
      row.open_count++;
    } else {
      row.closed_count++;
      row.realized += t.realized_pnl ?? 0;
    }
    if (!row.cadences.includes(t.cadence)) row.cadences.push(t.cadence);
    map.set(t.period, row);
  }
  // Newest month first.
  return [...map.values()].sort((a, b) => (a.period < b.period ? 1 : -1));
}
