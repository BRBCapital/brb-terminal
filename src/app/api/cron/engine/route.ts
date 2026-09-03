import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { tick } from "@/lib/engine/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Opening a cadence runs a full model build, which can take minutes.
// NOTE: 300s is the Vercel *Pro* ceiling; the Hobby plan caps functions at 60s.
// While the engine is paused (its shipped default) tick() returns immediately,
// so Hobby is fine until the engine is deliberately enabled.
export const maxDuration = 300;

// Replaces the former in-process strategy worker (src/lib/strategy-worker.ts,
// 60s setInterval). Same tick, now driven by an external scheduler.
//
// Safe to over-invoke: tick() is a no-op unless the engine is enabled, cadence
// windows are hours wide (09:30–16:00 open, >=16:00 close), and each job is
// claimed atomically via strategy_runs UNIQUE(kind, run_key) — so duplicate or
// overlapping invocations cannot double-fire a cadence.
export async function POST(req: Request) {
  const denied = authorizeCron(req);
  if (denied) return denied;

  const started = Date.now();
  try {
    await tick();
    return NextResponse.json(
      { ok: true, ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[engine] scheduler tick failed", err);
    return NextResponse.json(
      { ok: false, error: "Engine tick failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

// Vercel Cron issues GET. Accept both so either scheduler works.
export const GET = POST;
