import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { enforce, HOUR } from "@/lib/rate-limit";
import { getCachedSummary, generateSummary } from "@/lib/ai/market-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Claude calls can take a while with adaptive thinking.
export const maxDuration = 120;

// GET — return the cached summary for the latest trading day (if any).
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const summary = await getCachedSummary();
  return NextResponse.json({ ok: true, summary });
}

// POST — generate (or regenerate) today's summary.
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const rl = enforce(`ai:summary:${auth.user.email}`, 12, HOUR, "AI is busy for your account — please wait before regenerating.");
  if (rl) return rl;
  let webContext = false;
  try {
    const body = await req.json();
    webContext = body?.webContext === true;
  } catch {
    /* empty body — defaults */
  }
  const result = await generateSummary(auth.user.email, { webContext });
  if (!result.ok) {
    const status = result.errorCode === "NO_CREDENTIALS" ? 503 : result.errorCode === "RATE_LIMITED" ? 429 : 502;
    return NextResponse.json(
      { ok: false, error: result.error, errorCode: result.errorCode },
      { status }
    );
  }
  return NextResponse.json({ ok: true, summary: result.summary });
}
