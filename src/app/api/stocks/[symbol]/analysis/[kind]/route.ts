import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { enforce, HOUR } from "@/lib/rate-limit";
import { generateStockAnalysis } from "@/lib/ai/stock-analysis";
import { getAnalysis, isAnalysisKind } from "@/lib/db/ai-stock-analyses";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET — the latest cached analysis for (symbol, kind).
export async function GET(
  _req: NextRequest,
  { params }: { params: { symbol: string; kind: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (!isAnalysisKind(params.kind)) {
    return NextResponse.json({ ok: false, error: "Unknown analysis kind." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, analysis: await getAnalysis(params.symbol, params.kind) });
}

// POST — generate (or regenerate) the analysis.
export async function POST(
  _req: NextRequest,
  { params }: { params: { symbol: string; kind: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const rl = enforce(`ai:stock:${auth.user.email}`, 25, HOUR, "Please wait before running another analysis.");
  if (rl) return rl;
  if (!isAnalysisKind(params.kind)) {
    return NextResponse.json({ ok: false, error: "Unknown analysis kind." }, { status: 404 });
  }
  const result = await generateStockAnalysis(auth.user.email, params.symbol, params.kind);
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
    action: "ai.stock_analysis",
    detail: `${params.symbol.toUpperCase()} · ${params.kind}`,
  });
  return NextResponse.json({ ok: true, analysis: result.analysis });
}
