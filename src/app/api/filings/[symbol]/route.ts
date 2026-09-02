import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { enforce, HOUR } from "@/lib/rate-limit";
import { listFinancialFilings, extractFiling } from "@/lib/ai/filing-extract";
import { listFilingExtractions } from "@/lib/db/ai-filings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// PDF download + Claude reading a full filing takes a while.
export const maxDuration = 300;

// GET — financial-statement filings for the company + cached extractions.
export async function GET(
  _req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const symbol = params.symbol.toUpperCase();
  const [filings, extractions] = await Promise.all([
    listFinancialFilings(symbol),
    listFilingExtractions(symbol),
  ]);
  return NextResponse.json({ ok: true, filings, extractions });
}

// POST — extract one filing (cached per document URL unless force).
export async function POST(
  req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const rl = enforce(`ai:filing:${auth.user.email}`, 20, HOUR, "Please wait before extracting another filing.");
  if (rl) return rl;
  let body: { documentUrl?: string; title?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.documentUrl) {
    return NextResponse.json({ ok: false, error: "documentUrl is required." }, { status: 422 });
  }
  const result = await extractFiling(auth.user.email, {
    symbol: params.symbol.toUpperCase(),
    documentUrl: body.documentUrl,
    title: body.title ?? "NGX filing",
    force: body.force === true,
  });
  if (!result.ok) {
    const status =
      result.errorCode === "NO_CREDENTIALS" ? 503
      : result.errorCode === "RATE_LIMITED" ? 429
      : result.errorCode === "TOO_LARGE" ? 413
      : 502;
    return NextResponse.json(
      { ok: false, error: result.error, errorCode: result.errorCode },
      { status }
    );
  }
  return NextResponse.json({ ok: true, filing: result.filing });
}
