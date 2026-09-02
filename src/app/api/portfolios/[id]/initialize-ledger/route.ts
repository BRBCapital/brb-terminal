import { NextRequest, NextResponse } from "next/server";
import { requirePortfolioAccess } from "@/lib/auth/guard";
import { seedLedgerFromModel } from "@/lib/db/transactions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST — seed the live-management ledger from the portfolio's model holdings.
// Idempotent: books opening buys exactly once (guarded by ledger_seeded_at), so
// it's safe for the Manage view to call on every first open. An optional
// { totalNgn } sets the capital used to translate %-weights into share counts.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;

  let totalNgn: number | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.totalNgn === "number" && body.totalNgn > 0) {
      totalNgn = body.totalNgn;
    }
  } catch {
    // Empty/absent body is fine — fall back to the default notional.
  }

  const result = await seedLedgerFromModel(auth.user.email, params.id, { totalNgn });
  return NextResponse.json({ ok: true, ...result });
}
