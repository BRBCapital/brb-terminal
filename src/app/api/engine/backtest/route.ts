import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { gatherBacktest } from "@/lib/engine/backtest";
import { getSettings } from "@/lib/db/strategy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/engine/backtest?years=10&dwell=2 — walk-forward regime backtest over
// the real NGX index history. Read-only; admin-only.
export async function GET(req: NextRequest) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;

  const q = req.nextUrl.searchParams;
  const years = Math.min(20, Math.max(1, Number(q.get("years") ?? 10)));
  const settings = await getSettings();
  const dwell = q.get("dwell") != null ? Math.max(0, Number(q.get("dwell"))) : settings.regime_dwell_days;

  try {
    const result = await gatherBacktest(years, dwell);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message ?? "Backtest failed." }, { status: 502 });
  }
}
