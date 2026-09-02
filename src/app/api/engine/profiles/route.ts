import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { listAllTrades } from "@/lib/db/strategy";
import { listMonthlyProfiles } from "@/lib/engine/profiles";
import { listPeriods } from "@/lib/engine/period";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — monthly profile summaries + the distinct months/years on record (for the
// month & year selectors). Admin-only.
export async function GET() {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;
  const trades = await listAllTrades();
  const profiles = listMonthlyProfiles(trades);
  const { months, years } = listPeriods(profiles.map((p) => p.period));
  return NextResponse.json({ ok: true, profiles, months, years });
}
