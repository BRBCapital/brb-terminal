import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { createPriceAlert, listPriceAlerts } from "@/lib/db/price-alerts";
import { getWatchlist } from "@/lib/db/watchlists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const alerts = await listPriceAlerts(auth.user.email);
  return NextResponse.json({ ok: true, alerts });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  let body: {
    symbol?: string;
    company_name?: string;
    watchlist_id?: string | null;
    buy_price?: number | null;
    sell_price?: number | null;
    note?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.symbol?.trim()) {
    return NextResponse.json({ ok: false, error: "A ticker is required." }, { status: 422 });
  }
  const buy = body.buy_price != null && body.buy_price > 0 ? body.buy_price : null;
  const sell = body.sell_price != null && body.sell_price > 0 ? body.sell_price : null;
  if (buy == null && sell == null) {
    return NextResponse.json(
      { ok: false, error: "Set at least a buy or a sell price level." },
      { status: 422 }
    );
  }
  if (buy != null && sell != null && sell <= buy) {
    return NextResponse.json(
      { ok: false, error: "Sell target should be above the buy target." },
      { status: 422 }
    );
  }

  // Only attach a watchlist the caller actually owns (drop a foreign reference).
  let watchlistId = body.watchlist_id ?? null;
  if (watchlistId) {
    const wl = await getWatchlist(watchlistId);
    if (!wl || (wl.created_by !== auth.user.email && auth.user.role !== "admin")) watchlistId = null;
  }

  const alert = await createPriceAlert({
    created_by: auth.user.email,
    watchlist_id: watchlistId,
    symbol: body.symbol.trim(),
    company_name: body.company_name?.trim() ?? "",
    buy_price: buy,
    sell_price: sell,
    note: body.note?.trim() ?? "",
  });
  return NextResponse.json({ ok: true, alert }, { status: 201 });
}
