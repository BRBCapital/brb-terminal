import { NextRequest, NextResponse } from "next/server";
import { requireWatchlistAccess } from "@/lib/auth/guard";
import { addItem, removeItem, getWatchlist } from "@/lib/db/watchlists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireWatchlistAccess(params.id);
  if ("response" in auth) return auth.response;
  let body: { symbol?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.symbol) {
    return NextResponse.json({ ok: false, error: "symbol is required." }, { status: 422 });
  }
  await addItem(auth.user.email, params.id, body.symbol);
  const watchlist = await getWatchlist(params.id);
  return NextResponse.json({ ok: true, watchlist });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireWatchlistAccess(params.id);
  if ("response" in auth) return auth.response;
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ ok: false, error: "symbol query param required." }, { status: 422 });
  }
  await removeItem(params.id, symbol);
  const watchlist = await getWatchlist(params.id);
  return NextResponse.json({ ok: true, watchlist });
}
