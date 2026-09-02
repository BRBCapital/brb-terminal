import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import {
  createPaperPortfolio,
  listPaperPortfolios,
  type PaperPortfolioPositionInput,
} from "@/lib/db/paper-portfolios";
import { logAudit } from "@/lib/db/audit";
import type { Horizon } from "@/lib/db/paper-trades";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HORIZONS = ["intraday", "weekly", "monthly", "yearly"];

// GET — all of the analyst's paper trading portfolios (with positions).
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return NextResponse.json({ ok: true, portfolios: await listPaperPortfolios(auth.user.email) });
}

// POST — save an AI-built book as a paper trading portfolio (recorded separately).
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  let b: {
    name?: string;
    horizon?: string;
    currency?: string;
    amountInput?: number;
    budgetNgn?: number;
    marketContext?: string;
    riskNote?: string;
    model?: string;
    positions?: Array<{
      symbol?: string;
      companyName?: string;
      sector?: string;
      entryPrice?: number;
      shares?: number;
      amountNgn?: number;
      rationale?: string;
    }>;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  if (!HORIZONS.includes(b.horizon ?? "")) {
    return NextResponse.json({ ok: false, error: "Invalid horizon." }, { status: 422 });
  }
  const positions: PaperPortfolioPositionInput[] = (b.positions ?? [])
    .map((p) => ({
      symbol: (p.symbol ?? "").trim(),
      company_name: p.companyName ?? "",
      sector: p.sector ?? "",
      entry_price: Number(p.entryPrice),
      shares: Number(p.shares),
      amount_ngn: Number(p.amountNgn) || Number(p.entryPrice) * Number(p.shares),
      rationale: p.rationale ?? "",
    }))
    .filter((p) => p.symbol && p.entry_price > 0 && p.shares > 0);

  if (!positions.length) {
    return NextResponse.json({ ok: false, error: "No valid positions to save." }, { status: 422 });
  }

  const portfolio = await createPaperPortfolio({
    actor: auth.user.email,
    name: b.name?.trim() || "AI Paper Book",
    horizon: b.horizon as Horizon,
    currency: b.currency === "USD" ? "USD" : "NGN",
    amount_input: Number(b.amountInput) || 0,
    budget_ngn: Number(b.budgetNgn) || 0,
    market_context: b.marketContext ?? "",
    risk_note: b.riskNote ?? "",
    model: b.model ?? "",
    positions,
  });
  await logAudit({
    actor: auth.user.email,
    action: "paper_portfolio.create",
    detail: `${portfolio.name} · ${positions.length} positions`,
  });
  return NextResponse.json({ ok: true, portfolio }, { status: 201 });
}
