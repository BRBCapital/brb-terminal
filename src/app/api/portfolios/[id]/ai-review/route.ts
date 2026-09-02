import { NextRequest, NextResponse } from "next/server";
import { requirePortfolioAccess } from "@/lib/auth/guard";
import { enforce, HOUR } from "@/lib/rate-limit";
import { generateReview, type ReviewSnapshot } from "@/lib/ai/portfolio-review";
import { getReview } from "@/lib/db/ai-reviews";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180; // deep review + adaptive thinking

// GET — the latest cached review for this portfolio.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;
  return NextResponse.json({ ok: true, review: await getReview(params.id) });
}

// POST — generate (or regenerate) the review from the analyst's snapshot + cash.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;
  const rl = enforce(`ai:review:${auth.user.email}`, 12, HOUR, "Please wait before generating another review.");
  if (rl) return rl;

  let body: { cashAvailable?: number; snapshot?: ReviewSnapshot };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.snapshot) {
    return NextResponse.json({ ok: false, error: "Portfolio snapshot is required." }, { status: 422 });
  }
  const cash = Number.isFinite(body.cashAvailable) ? Math.max(0, Number(body.cashAvailable)) : 0;

  const result = await generateReview(auth.user.email, {
    portfolioId: params.id,
    cashAvailable: cash,
    snapshot: body.snapshot,
  });
  if (!result.ok) {
    const status =
      result.errorCode === "NO_CREDENTIALS" ? 503
      : result.errorCode === "RATE_LIMITED" ? 429
      : result.errorCode === "NO_DATA" ? 422
      : 502;
    return NextResponse.json({ ok: false, error: result.error, errorCode: result.errorCode }, { status });
  }
  await logAudit({
    actor: auth.user.email,
    action: "ai.portfolio_review",
    portfolioId: params.id,
    detail: `cash ₦${cash.toLocaleString()}`,
  });
  return NextResponse.json({ ok: true, review: result.review });
}
