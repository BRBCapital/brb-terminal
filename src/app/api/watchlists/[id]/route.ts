import { NextRequest, NextResponse } from "next/server";
import { requireWatchlistAccess } from "@/lib/auth/guard";
import { deleteWatchlist } from "@/lib/db/watchlists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireWatchlistAccess(params.id);
  if ("response" in auth) return auth.response;
  return NextResponse.json({ ok: true, watchlist: auth.watchlist });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireWatchlistAccess(params.id);
  if ("response" in auth) return auth.response;
  await deleteWatchlist(auth.user.email, params.id);
  return NextResponse.json({ ok: true });
}
