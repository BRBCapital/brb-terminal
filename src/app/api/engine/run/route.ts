import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { CADENCES, type Cadence } from "@/lib/db/strategy";
import { openCadence, closeCadence } from "@/lib/engine/run";
import { watClock } from "@/lib/engine/clock";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // opening a cadence runs a Fable build (minutes)

// POST — manually fire a cadence job ("Run now"). Works even while the engine is
// paused, for testing / governance. Uses a unique run_key so it never collides
// with the scheduled dedup key; open is idempotent per trading day, and manual
// close force-closes the whole open book for the cadence.
export async function POST(req: NextRequest) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;

  let body: { action?: string; cadence?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const action = body.action;
  const cadence = body.cadence as Cadence;
  if (action !== "open" && action !== "close") {
    return NextResponse.json({ ok: false, error: "action must be 'open' or 'close'." }, { status: 422 });
  }
  if (!CADENCES.includes(cadence)) {
    return NextResponse.json({ ok: false, error: "cadence must be intraday, weekly or monthly." }, { status: 422 });
  }

  const dateStr = watClock().dateStr;
  const runKey = `manual:${action}:${cadence}:${Date.now()}`;

  const outcome =
    action === "open"
      ? await openCadence(cadence, { runKey, trigger: "manual", dateStr })
      : await closeCadence(cadence, { runKey, trigger: "manual", dateStr, mode: "manual" });

  await logAudit({
    actor: auth.user.email,
    action: `engine.run.${action}_${cadence}`,
    detail: `${outcome.status}: ${outcome.detail}`,
  });

  return NextResponse.json({ ok: true, outcome });
}
