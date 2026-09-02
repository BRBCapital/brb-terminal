import "server-only";
import { getSettings, listAllTrades } from "@/lib/db/strategy";
import type { StrategySettings } from "@/lib/db/strategy";
import { getBrokerById, upsertBrokerTransaction, type BrokerMode } from "@/lib/db/brokers";

// Total capital the engine's model book is sized against.
export function modelCapital(s: StrategySettings): number {
  return s.allocation_mode === "manual"
    ? s.intraday_capital + s.weekly_capital + s.monthly_capital
    : s.total_capital_ngn;
}

// How a broker's AUM is split across cadences — shown on the portal so the
// broker sees exactly how their capital will be deployed.
export function allocationPlan(aum: number, s: StrategySettings) {
  if (s.allocation_mode === "manual") {
    const tot = modelCapital(s) || 1;
    return {
      intraday: aum * (s.intraday_capital / tot),
      weekly: aum * (s.weekly_capital / tot),
      monthly: aum * (s.monthly_capital / tot),
    };
  }
  return {
    intraday: (aum * s.intraday_pct) / 100,
    weekly: (aum * s.weekly_pct) / 100,
    monthly: (aum * s.monthly_pct) / 100,
  };
}

// Scale the engine's executed model book (open + closed model trades) to a
// broker's AUM and upsert the resulting transactions for the given key/mode.
// Idempotent — safe to call on every portal / API read. Risk caps are already
// baked into the model (they are percentages), so a single AUM ratio preserves
// single-name limits, cadence split and the FX overlay.
export async function syncBrokerBook(brokerId: string, mode: BrokerMode): Promise<{ synced: number }> {
  const broker = await getBrokerById(brokerId);
  if (!broker || broker.aum_ngn <= 0) return { synced: 0 };

  const settings = await getSettings();
  const capital = modelCapital(settings);
  if (capital <= 0) return { synced: 0 };
  const ratio = broker.aum_ngn / capital;

  const trades = (await listAllTrades()).filter((t) => t.status === "open" || t.status === "closed");
  let synced = 0;
  for (const t of trades) {
    if (!(t.entry_price > 0)) continue;
    const shares = Math.floor((t.amount_ngn * ratio) / t.entry_price);
    if (shares <= 0) continue;
    const amount = shares * t.entry_price;
    const realized = t.status === "closed" && t.close_price != null ? (t.close_price - t.entry_price) * shares : null;
    await upsertBrokerTransaction({
      brokerId,
      mode,
      sourceTradeId: t.id,
      cadence: t.cadence,
      symbol: t.symbol,
      company_name: t.company_name,
      entry_price: t.entry_price,
      shares,
      amount_ngn: amount,
      weight_pct: capital > 0 ? (t.amount_ngn / capital) * 100 : 0,
      signal: t.signal,
      status: t.status as "open" | "closed",
      close_price: t.status === "closed" ? t.close_price : null,
      realized_pnl: realized,
      closed_at: t.status === "closed" ? t.closed_at : null,
    });
    synced++;
  }
  return { synced };
}
