import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { createWatchlist, listWatchlists } from "@/lib/db/watchlists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const watchlists = await listWatchlists(auth.user.email);
  return NextResponse.json({ ok: true, watchlists });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  let body: { name?: string; symbols?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ ok: false, error: "Watchlist needs a name." }, { status: 422 });
  }
  const watchlist = await createWatchlist(
    auth.user.email,
    body.name.trim(),
    Array.isArray(body.symbols) ? body.symbols : []
  );
  return NextResponse.json({ ok: true, watchlist }, { status: 201 });
}
