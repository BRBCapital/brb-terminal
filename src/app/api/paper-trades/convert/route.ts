import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { listPaperTrades } from "@/lib/db/paper-trades";
import { createPortfolio } from "@/lib/db/portfolios";
import type { HoldingInput } from "@/lib/db/portfolios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Convert the analyst's OPEN paper trades into a new units-mode portfolio.
// Share/entry math is done server-side (never trust client-sent holdings), and
// duplicate symbols are merged: summed units + share-weighted average entry.
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  let body: { name?: string; benchmark_symbol?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const open = (await listPaperTrades(auth.user.email)).filter((t) => t.status === "open");
  if (open.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No open paper trades to convert." },
      { status: 422 }
    );
  }

  // Merge by symbol: total units and share-weighted average entry price.
  const bySymbol = new Map<
    string,
    { symbol: string; company_name: string; sector: string; units: number; cost: number }
  >();
  for (const t of open) {
    if (!(t.shares > 0) || !(t.entry_price > 0)) continue;
    const key = t.symbol.toUpperCase();
    const agg = bySymbol.get(key) ?? {
      symbol: key,
      company_name: t.company_name,
      sector: t.sector,
      units: 0,
      cost: 0,
    };
    agg.units += t.shares;
    agg.cost += t.shares * t.entry_price;
    if (!agg.company_name && t.company_name) agg.company_name = t.company_name;
    if (!agg.sector && t.sector) agg.sector = t.sector;
    bySymbol.set(key, agg);
  }

  const holdings: HoldingInput[] = [...bySymbol.values()].map((a) => ({
    symbol: a.symbol,
    company_name: a.company_name,
    sector: a.sector,
    mode: "units",
    units: a.units,
    entry_price: a.units > 0 ? a.cost / a.units : 0,
  }));

  if (holdings.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Open trades had no valid units to convert." },
      { status: 422 }
    );
  }

  // Base currency: honour it only if every open trade agrees, else default NGN.
  const currencies = new Set(open.map((t) => t.currency || "NGN"));
  const base_currency = currencies.size === 1 ? [...currencies][0] : "NGN";

  const name = body.name?.trim() || "Paper Book";
  const portfolio = await createPortfolio(auth.user.email, {
    name,
    mandate_notes: "Created from paper trading positions.",
    benchmark_symbol: body.benchmark_symbol?.trim() || "ASI",
    base_currency,
    holdings,
  });

  return NextResponse.json({ ok: true, portfolio }, { status: 201 });
}
