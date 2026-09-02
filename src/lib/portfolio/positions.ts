// Cost-basis + P&L engine. Pure and framework-free so it runs on server and
// client. Uses the average-cost method: a sell realises P&L against the running
// average cost and reduces the remaining cost basis proportionally.

export interface LedgerTx {
  symbol: string;
  kind: "buy" | "sell" | "dividend";
  trade_date: string;
  units: number;
  price: number;
  fees: number;
  amount: number;
}

export interface Position {
  symbol: string;
  units: number; // shares currently held
  costBasis: number; // remaining book cost (naira, incl. fees)
  avgCost: number; // costBasis / units
  realisedPnl: number; // naira realised on sells so far
  dividends: number; // naira dividends received
  firstDate: string | null;
}

export function computePositions(txs: LedgerTx[]): Position[] {
  const bySymbol = new Map<string, LedgerTx[]>();
  for (const t of txs) {
    const arr = bySymbol.get(t.symbol) ?? [];
    arr.push(t);
    bySymbol.set(t.symbol, arr);
  }

  const out: Position[] = [];
  for (const [symbol, list] of bySymbol) {
    // Process chronologically for correct running average cost.
    const ordered = [...list].sort((a, b) =>
      a.trade_date.localeCompare(b.trade_date)
    );
    let units = 0;
    let costBasis = 0;
    let realised = 0;
    let dividends = 0;
    let firstDate: string | null = null;

    for (const t of ordered) {
      if (t.kind === "buy") {
        if (firstDate == null) firstDate = t.trade_date;
        units += t.units;
        costBasis += t.units * t.price + t.fees;
      } else if (t.kind === "sell") {
        if (firstDate == null) firstDate = t.trade_date;
        // Nothing to match (no held units or a zero-unit row) — don't leak fees
        // into realised P&L against a zero cost basis.
        if (!(units > 0) || !(t.units > 0)) continue;
        const avg = costBasis / units;
        const sellUnits = Math.min(t.units, units);
        // On an oversell, only charge the fee proportional to the matched units.
        const feeShare = t.fees * (sellUnits / t.units);
        const proceeds = sellUnits * t.price - feeShare;
        realised += proceeds - avg * sellUnits;
        costBasis -= avg * sellUnits;
        units -= sellUnits;
        if (units < 1e-9) {
          units = 0;
          costBasis = 0;
        }
      } else if (t.kind === "dividend") {
        dividends += t.amount;
      }
    }

    out.push({
      symbol,
      units,
      costBasis,
      avgCost: units > 0 ? costBasis / units : 0,
      realisedPnl: realised,
      dividends,
      firstDate,
    });
  }

  return out.sort((a, b) => b.costBasis - a.costBasis);
}

export interface ValuedPosition extends Position {
  currentPrice: number | null;
  prevClose: number | null;
  sector: string;
  companyName: string;
  marketValue: number | null;
  unrealisedPnl: number | null;
  unrealisedPct: number | null;
  dayChangePct: number | null;
  dayChangeValue: number | null;
}

export interface PortfolioTotals {
  marketValue: number;
  costBasis: number;
  unrealisedPnl: number;
  unrealisedPct: number | null;
  realisedPnl: number;
  dividends: number;
  dayChangeValue: number;
}

export function valuePositions(
  positions: Position[],
  quotes: Record<
    string,
    { price: number | null; prevClose: number | null; sector: string; name: string }
  >
): { valued: ValuedPosition[]; totals: PortfolioTotals } {
  const valued: ValuedPosition[] = positions.map((p) => {
    const q = quotes[p.symbol];
    const price = q?.price ?? null;
    const prev = q?.prevClose ?? null;
    const marketValue = price != null ? p.units * price : null;
    const unrealisedPnl =
      marketValue != null ? marketValue - p.costBasis : null;
    const unrealisedPct =
      unrealisedPnl != null && p.costBasis > 0
        ? (unrealisedPnl / p.costBasis) * 100
        : null;
    const dayChangePct =
      price != null && prev != null && prev > 0
        ? ((price - prev) / prev) * 100
        : null;
    const dayChangeValue =
      price != null && prev != null ? p.units * (price - prev) : null;
    return {
      ...p,
      currentPrice: price,
      prevClose: prev,
      sector: q?.sector ?? "",
      companyName: q?.name ?? p.symbol,
      marketValue,
      unrealisedPnl,
      unrealisedPct,
      dayChangePct,
      dayChangeValue,
    };
  });

  // Unrealised P&L must only compare like-for-like: a holding whose live quote
  // failed (marketValue null) has no market value to net against its cost, so
  // including its cost would fabricate a phantom loss. Track the cost of PRICED
  // positions separately for the unrealised calculation, while `costBasis`
  // remains the full book cost of every holding.
  let pricedCostBasis = 0;
  const totals: PortfolioTotals = valued.reduce(
    (acc, p) => {
      acc.marketValue += p.marketValue ?? 0;
      acc.costBasis += p.costBasis;
      acc.realisedPnl += p.realisedPnl;
      acc.dividends += p.dividends;
      acc.dayChangeValue += p.dayChangeValue ?? 0;
      if (p.marketValue != null) pricedCostBasis += p.costBasis;
      return acc;
    },
    {
      marketValue: 0,
      costBasis: 0,
      unrealisedPnl: 0,
      unrealisedPct: null as number | null,
      realisedPnl: 0,
      dividends: 0,
      dayChangeValue: 0,
    }
  );
  totals.unrealisedPnl = totals.marketValue - pricedCostBasis;
  totals.unrealisedPct =
    pricedCostBasis > 0 ? (totals.unrealisedPnl / pricedCostBasis) * 100 : null;

  return { valued, totals };
}
