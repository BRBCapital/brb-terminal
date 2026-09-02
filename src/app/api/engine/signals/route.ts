import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { ngxFetch } from "@/lib/ngx/client";
import type { CompanyListRow, Paginated } from "@/lib/ngx/types";
import { computeFactorSignals } from "@/lib/engine/signals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — the computed factor-signal leaderboard (momentum / liquidity /
// volatility / range-value), ranked by composite. Admin-only.
export async function GET() {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;

  const res = await ngxFetch<Paginated<CompanyListRow>>({ path: "companies", query: "limit=300" });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "NGX universe unavailable.", signals: [] });
  }
  const signals = computeFactorSignals(res.data.data ?? [], 40);
  return NextResponse.json({ ok: true, signals });
}
