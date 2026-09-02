import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { getSettings, listAllTrades, listRuns } from "@/lib/db/strategy";
import { buildOverview } from "@/lib/engine/overview";
import { ngxFetch } from "@/lib/ngx/client";
import type { CompanyDetail } from "@/lib/ngx/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — the full quant dashboard payload: settings, aggregates, per-cadence
// stats, equity curve, monthly P&L, sector allocation, open positions with live
// mark-to-market, and the recent run log. Admin-only.
export async function GET() {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;

  const [settings, trades, runs] = await Promise.all([getSettings(), listAllTrades(), listRuns(40)]);

  // One live-price fetch per distinct open symbol for mark-to-market.
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

  const data = buildOverview({ settings, trades, priceBySymbol, runs });
  return NextResponse.json({ ok: true, settings, runs, ...data });
}
