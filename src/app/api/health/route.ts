import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Unauthenticated liveness/readiness probe for the load balancer / target group.
// Returns 200 only when the embedded database answers, else 503 — so a booting
// or wedged instance is pulled out of rotation. Leaks no data.
export async function GET() {
  try {
    await query("SELECT 1");
    return NextResponse.json(
      { ok: true, status: "healthy", time: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, status: "db_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
