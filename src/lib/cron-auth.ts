import "server-only";
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

// Shared guard for the /api/cron/* endpoints.
//
// These routes replace the former in-process setInterval workers: on serverless
// there is no long-lived process to hold a timer, so the cadences arrive as
// HTTP requests instead. That makes them publicly reachable URLs, so they must
// prove the caller is our own scheduler — hence a shared secret.
//
// Callers send:  Authorization: Bearer <CRON_SECRET>
// Vercel Cron sends exactly this header automatically. Any external scheduler
// (GitHub Actions, an EC2 crontab) sends it explicitly.
export function authorizeCron(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed. Refusing to run is correct: an unguarded cadence endpoint
    // would let anyone trigger alert evaluation or an engine cadence.
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured; refusing to run." },
      { status: 503 }
    );
  }

  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";

  // Constant-time compare, length-guarded (timingSafeEqual throws on length
  // mismatch), so the secret can't be recovered by timing the response.
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  const ok = a.length === b.length && timingSafeEqual(a, b);

  if (!ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  return null;
}
