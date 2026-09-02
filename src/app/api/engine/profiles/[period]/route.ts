import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { getPeriodOverview } from "@/lib/engine/period";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — one period's performance statement (month "YYYY-MM" or year "YYYY"):
// trades marked to market, per-cadence stats, totals, profile metadata. Admin-only.
export async function GET(_req: NextRequest, { params }: { params: { period: string } }) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;
  const result = await getPeriodOverview(params.period);
  return NextResponse.json({ ok: true, ...result });
}
