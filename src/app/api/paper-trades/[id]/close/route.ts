import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getPaperTrade, closePaperTrade } from "@/lib/db/paper-trades";
import { ngxFetch } from "@/lib/ngx/client";
import { logAudit } from "@/lib/db/audit";
import type { CompanyDetail } from "@/lib/ngx/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST — close an open paper trade at the current market price (fetched
// server-side for integrity), realising the P&L.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const existing = await getPaperTrade(params.id, auth.user.email);
  if (!existing) return NextResponse.json({ ok: false, error: "Trade not found." }, { status: 404 });
  if (existing.status === "closed") {
    return NextResponse.json({ ok: true, trade: existing });
  }

  const quote = await ngxFetch<CompanyDetail>({ path: `companies/${existing.symbol}`, skipCache: true });
  const price = quote.ok ? quote.data.current_price : null;
  if (price == null || price <= 0) {
    return NextResponse.json(
      { ok: false, error: `Could not fetch a current price for ${existing.symbol}.` },
      { status: 502 }
    );
  }

  const trade = await closePaperTrade(params.id, auth.user.email, price);
  const pnl = (price - existing.entry_price) * existing.shares;
  await logAudit({
    actor: auth.user.email,
    action: "paper_trade.close",
    detail: `${existing.symbol} @₦${price} · P&L ₦${pnl.toFixed(0)}`,
  });
  return NextResponse.json({ ok: true, trade });
}
