import { NextResponse } from "next/server";
import { getSettings, listAllTrades } from "@/lib/db/strategy";
import { buildOverview } from "@/lib/engine/overview";
import { ngxFetch } from "@/lib/ngx/client";
import type { CompanyDetail } from "@/lib/ngx/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUBLIC endpoint — the high-level, SIMULATED performance summary rendered on the
// /strategies marketing landing. Deliberately exposes only aggregate return
// figures (return %, net P&L, win rate, drawdown, equity curve, monthly/yearly
// P&L). No individual positions, holdings, or symbols are returned. Not guarded:
// the figures are illustrative and clearly labelled as such on the page.
export async function GET() {
  const [settings, trades] = await Promise.all([getSettings(), listAllTrades()]);

  // Mark open positions to live prices (one fetch per distinct open symbol) so the
  // headline return figure is real-time, exactly like the internal dashboard.
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

  const o = buildOverview({ settings, trades, priceBySymbol, runs: [] });
  const capital = o.totals.capital;

  // Roll monthly realized P&L up to a per-year summary (newest first).
  const yearMap = new Map<string, number>();
  for (const m of o.monthly_pnl) {
    const y = m.month.slice(0, 4);
    yearMap.set(y, (yearMap.get(y) ?? 0) + m.total);
  }
  const yearly = [...yearMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([year, pnl]) => ({ year, pnl, return_pct: capital > 0 ? (pnl / capital) * 100 : 0 }));

  const monthly = o.monthly_pnl.slice(-12).map((m) => ({
    month: m.month,
    pnl: m.total,
    return_pct: capital > 0 ? (m.total / capital) * 100 : 0,
  }));

  return NextResponse.json(
    {
      ok: true,
      as_of: new Date().toISOString(),
      enabled: settings.enabled,
      has_data: trades.length > 0,
      totals: {
        capital,
        total_pnl: o.totals.total_pnl,
        return_pct: o.totals.return_pct,
        realized: o.totals.realized,
        unrealized: o.totals.unrealized,
        win_rate: o.totals.win_rate,
        max_drawdown: o.max_drawdown,
        sharpe: o.sharpe,
        open_count: o.totals.open_count,
        closed_count: o.totals.closed_count,
      },
      equity_curve: o.equity_curve,
      monthly,
      yearly,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
