import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import {
  listPaperTrades,
  openPaperTrade,
  clearClosedPaperTrades,
  type Horizon,
} from "@/lib/db/paper-trades";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HORIZONS = ["intraday", "weekly", "monthly", "yearly"];

// GET — all paper trades (open + closed) for the current analyst.
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return NextResponse.json({ ok: true, trades: await listPaperTrades(auth.user.email) });
}

// POST — open a paper trade from a built position.
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  let b: {
    symbol?: string;
    companyName?: string;
    sector?: string;
    horizon?: string;
    currency?: string;
    entryPrice?: number;
    shares?: number;
    amountNgn?: number;
    rationale?: string;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const entryPrice = Number(b.entryPrice);
  const shares = Number(b.shares);
  if (!b.symbol || !HORIZONS.includes(b.horizon ?? "") || !(entryPrice > 0) || !(shares > 0)) {
    return NextResponse.json({ ok: false, error: "Invalid paper-trade payload." }, { status: 422 });
  }
  const trade = await openPaperTrade({
    actor: auth.user.email,
    symbol: b.symbol,
    companyName: b.companyName ?? "",
    sector: b.sector ?? "",
    horizon: b.horizon as Horizon,
    currency: b.currency === "USD" ? "USD" : "NGN",
    entryPrice,
    shares,
    amountNgn: Number(b.amountNgn) || entryPrice * shares,
    rationale: b.rationale ?? "",
  });
  await logAudit({ actor: auth.user.email, action: "paper_trade.open", detail: `${trade.symbol} ${shares}@₦${entryPrice}` });
  return NextResponse.json({ ok: true, trade });
}

// DELETE — clear the analyst's entire closed-positions history (open trades are
// untouched). Irreversible; the UI confirms first.
export async function DELETE() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const removed = await clearClosedPaperTrades(auth.user.email);
  if (removed > 0) {
    await logAudit({ actor: auth.user.email, action: "paper_trade.clear_closed", detail: `${removed} closed` });
  }
  return NextResponse.json({ ok: true, removed });
}
