import { NextRequest, NextResponse } from "next/server";
import { requirePortfolioAccess } from "@/lib/auth/guard";
import {
  createProposal,
  listProposalsForPortfolio,
  type ProposalTrade,
} from "@/lib/db/proposals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;
  const proposals = await listProposalsForPortfolio(params.id);
  return NextResponse.json({ ok: true, proposals });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;

  let body: { trades?: ProposalTrade[]; turnover?: number; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (!Array.isArray(body.trades) || body.trades.length === 0) {
    return NextResponse.json({ ok: false, error: "No trades to submit." }, { status: 422 });
  }

  const proposal = await createProposal(auth.user.email, {
    portfolioId: params.id,
    portfolioName: auth.portfolio?.name ?? "",
    trades: body.trades,
    turnover: Number(body.turnover) || 0,
    note: body.note ?? "",
  });
  return NextResponse.json({ ok: true, proposal }, { status: 201 });
}
