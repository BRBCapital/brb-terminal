import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { evaluateAlerts } from "@/lib/db/notifications";
import { evaluatePriceAlerts } from "@/lib/db/price-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Alert evaluation is a handful of indexed queries — fast, and comfortably
// inside even the Hobby-plan 60s function ceiling.
export const maxDuration = 60;

// Replaces the former in-process alert worker (src/lib/alert-worker.ts, 3-min
// setInterval). Same evaluation, now driven by an external scheduler.
//
// Idempotent by design: evaluateAlerts/evaluatePriceAlerts only create
// notifications for newly-triggered alerts, so a duplicate or retried
// invocation is harmless.
export async function POST(req: Request) {
  const denied = authorizeCron(req);
  if (denied) return denied;

  const started = Date.now();
  try {
    const [portfolioN, priceN] = await Promise.all([
      evaluateAlerts(),
      evaluatePriceAlerts(),
    ]);
    const created = portfolioN + priceN;
    if (created > 0) console.log(`[alerts] created ${created} notification(s)`);
    return NextResponse.json(
      { ok: true, created, ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[alerts] evaluation failed", err);
    return NextResponse.json(
      { ok: false, error: "Alert evaluation failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

// Vercel Cron issues GET. Accept both so either scheduler works.
export const GET = POST;
