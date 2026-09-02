// Pure aggregation of the engine's trade ledger into the quant-dashboard shape.
// Live prices for open positions are fetched by the route and passed in here.

import type { Cadence, StrategyRun, StrategySettings, StrategyTrade } from "@/lib/db/strategy";
import { CADENCES } from "@/lib/db/strategy";
import { resolveAllocation } from "./risk";

export interface OverviewPosition {
  id: string;
  cadence: Cadence;
  symbol: string;
  company_name: string;
  sector: string;
  entry_price: number;
  shares: number;
  amount_ngn: number;
  current_price: number | null;
  unrealized: number;
  unrealized_pct: number;
  opened_on: string;
  target_price: number | null;
  stop_loss: number | null;
}

export interface CadenceStat {
  cadence: Cadence;
  capital: number;
  deployed: number;
  open_count: number;
  closed_count: number;
  realized: number;
  unrealized: number;
  win_rate: number | null;
  avg_return_pct: number | null;
}

export interface OverviewData {
  allocation: Record<Cadence, number>;
  totals: {
    capital: number;
    deployed: number;
    cash_idle: number;
    realized: number;
    unrealized: number;
    total_pnl: number;
    return_pct: number;
    open_count: number;
    closed_count: number;
    win_rate: number | null;
  };
  per_cadence: CadenceStat[];
  equity_curve: { date: string; cum: number }[];
  monthly_pnl: { month: string; intraday: number; weekly: number; monthly: number; total: number }[];
  sector_allocation: { sector: string; amount: number; pct: number }[];
  positions: OverviewPosition[];
  closed: OverviewPosition[];
  max_drawdown: number;
  sharpe: number | null;
  pending_count: number;
}

export function buildOverview(input: {
  settings: StrategySettings;
  trades: StrategyTrade[];
  priceBySymbol: Record<string, number | null>;
  runs: StrategyRun[];
}): OverviewData {
  const { settings, trades, priceBySymbol } = input;
  const allocation = resolveAllocation(settings);
  const capital =
    settings.allocation_mode === "manual"
      ? settings.intraday_capital + settings.weekly_capital + settings.monthly_capital
      : settings.total_capital_ngn;

  const open = trades.filter((t) => t.status === "open");
  const closed = trades.filter((t) => t.status === "closed");

  const toPosition = (t: StrategyTrade): OverviewPosition => {
    const px = t.status === "closed" ? t.close_price : priceBySymbol[t.symbol.toUpperCase()] ?? null;
    const mark = px ?? t.entry_price;
    const unrealized = t.status === "closed" ? t.realized_pnl ?? 0 : (mark - t.entry_price) * t.shares;
    return {
      id: t.id,
      cadence: t.cadence,
      symbol: t.symbol,
      company_name: t.company_name,
      sector: t.sector,
      entry_price: t.entry_price,
      shares: t.shares,
      amount_ngn: t.amount_ngn,
      current_price: px,
      unrealized,
      unrealized_pct: t.amount_ngn > 0 ? (unrealized / t.amount_ngn) * 100 : 0,
      opened_on: t.opened_on,
      target_price: t.target_price,
      stop_loss: t.stop_loss,
    };
  };

  const positions = open.map(toPosition);
  const deployed = positions.reduce((s, p) => s + p.amount_ngn, 0);
  const unrealizedTotal = positions.reduce((s, p) => s + p.unrealized, 0);
  const realizedTotal = closed.reduce((s, t) => s + (t.realized_pnl ?? 0), 0);
  const totalPnl = realizedTotal + unrealizedTotal;

  const closedWins = closed.filter((t) => (t.realized_pnl ?? 0) > 0).length;

  const perCadence: CadenceStat[] = CADENCES.map((c) => {
    const co = open.filter((t) => t.cadence === c);
    const cc = closed.filter((t) => t.cadence === c);
    const realized = cc.reduce((s, t) => s + (t.realized_pnl ?? 0), 0);
    const unreal = positions.filter((p) => p.cadence === c).reduce((s, p) => s + p.unrealized, 0);
    const wins = cc.filter((t) => (t.realized_pnl ?? 0) > 0).length;
    const avgRet =
      cc.length > 0
        ? cc.reduce((s, t) => s + (t.amount_ngn > 0 ? ((t.realized_pnl ?? 0) / t.amount_ngn) * 100 : 0), 0) /
          cc.length
        : null;
    return {
      cadence: c,
      capital: allocation[c],
      deployed: co.reduce((s, t) => s + t.amount_ngn, 0),
      open_count: co.length,
      closed_count: cc.length,
      realized,
      unrealized: unreal,
      win_rate: cc.length ? (wins / cc.length) * 100 : null,
      avg_return_pct: avgRet,
    };
  });

  // Equity curve: cumulative realized P&L over closed trades by close date.
  const closedSorted = [...closed]
    .filter((t) => t.closed_at)
    .sort((a, b) => (a.closed_at! < b.closed_at! ? -1 : 1));
  const curveMap = new Map<string, number>();
  let cum = 0;
  for (const t of closedSorted) {
    cum += t.realized_pnl ?? 0;
    curveMap.set(t.closed_at!.slice(0, 10), cum);
  }
  const equity_curve = [...curveMap.entries()].map(([date, c]) => ({ date, cum: c }));

  // Monthly P&L by close month, split by cadence.
  const monthMap = new Map<string, { intraday: number; weekly: number; monthly: number }>();
  for (const t of closedSorted) {
    const m = t.closed_at!.slice(0, 7);
    const row = monthMap.get(m) ?? { intraday: 0, weekly: 0, monthly: 0 };
    row[t.cadence] += t.realized_pnl ?? 0;
    monthMap.set(m, row);
  }
  const monthly_pnl = [...monthMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, r]) => ({ month, ...r, total: r.intraday + r.weekly + r.monthly }));

  // Sector allocation of the live book.
  const secMap = new Map<string, number>();
  for (const p of positions) secMap.set(p.sector || "Unclassified", (secMap.get(p.sector || "Unclassified") ?? 0) + p.amount_ngn);
  const sector_allocation = [...secMap.entries()]
    .map(([sector, amount]) => ({ sector, amount, pct: deployed > 0 ? (amount / deployed) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // Max drawdown (₦) over the realized equity curve.
  let peak = 0;
  let maxDd = 0;
  for (const pt of equity_curve) {
    peak = Math.max(peak, pt.cum);
    maxDd = Math.max(maxDd, peak - pt.cum);
  }

  // Sharpe-ish from monthly total returns (annualised), if enough months.
  let sharpe: number | null = null;
  if (monthly_pnl.length >= 2 && capital > 0) {
    const rets = monthly_pnl.map((m) => m.total / capital);
    const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
    const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length;
    const sd = Math.sqrt(variance);
    sharpe = sd > 0 ? (mean / sd) * Math.sqrt(12) : null;
  }

  return {
    allocation,
    totals: {
      capital,
      deployed,
      cash_idle: capital - deployed,
      realized: realizedTotal,
      unrealized: unrealizedTotal,
      total_pnl: totalPnl,
      return_pct: capital > 0 ? (totalPnl / capital) * 100 : 0,
      open_count: open.length,
      closed_count: closed.length,
      win_rate: closed.length ? (closedWins / closed.length) * 100 : null,
    },
    per_cadence: perCadence,
    equity_curve,
    monthly_pnl,
    sector_allocation,
    positions,
    closed: closedSorted.slice(-40).reverse().map(toPosition),
    max_drawdown: maxDd,
    sharpe,
    pending_count: trades.filter((t) => t.status === "pending").length,
  };
}
