import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { evaluateRegime, resolveEffectiveState, exposureMultFor } from "@/lib/engine/regime";
import { watClock } from "@/lib/engine/clock";
import { upsertRegimeSnapshot, listRegime } from "@/lib/db/regime";
import { getSettings } from "@/lib/db/strategy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — evaluate the current market regime from live NGX data, persist today's
// snapshot, and return it with recent history + the dwell-adjusted effective
// state. `live` = the regime is scaling allocation (Phase 2 on); otherwise it's
// observing only (shadow). Admin-only.
export async function GET() {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;

  const [settings, snapshot] = await Promise.all([getSettings(), evaluateRegime()]);
  const dateStr = watClock().dateStr;
  await upsertRegimeSnapshot(dateStr, snapshot);
  const history = await listRegime(60);

  const recent = history.filter((r) => r.date < dateStr).map((r) => r.state);
  const effState = resolveEffectiveState(snapshot.state, recent, settings.regime_dwell_days);

  return NextResponse.json({
    ok: true,
    live: settings.regime_enabled,
    shadow: !settings.regime_enabled,
    dwell: settings.regime_dwell_days,
    date: dateStr,
    current: snapshot,
    effective: { state: effState, exposure_mult: exposureMultFor(effState, snapshot.score) },
    history,
  });
}
