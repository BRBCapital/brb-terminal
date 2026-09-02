import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { enforce, HOUR } from "@/lib/rate-limit";
import { getPeriodOverview } from "@/lib/engine/period";
import { streamEngineReport, type EnginePerfPayload } from "@/lib/ai/engine-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function labelFor(period: string): string {
  if (period.length === 4) return period; // year
  const d = new Date(`${period}-01T00:00:00Z`);
  return isNaN(d.getTime())
    ? period
    : d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

// POST — stream a Fable-written detailed performance review for a month or year.
// Body: { period }. NDJSON of EngineReportEvent. Admin-only.
export async function POST(req: NextRequest) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;
  const rl = enforce(`ai:engine-report:${auth.user.email}`, 15, HOUR, "Please wait before generating another report.");
  if (rl) return rl;

  let period: string;
  try {
    const body = await req.json();
    period = String(body.period ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (!/^\d{4}(-\d{2})?$/.test(period)) {
    return NextResponse.json({ ok: false, error: "Bad period." }, { status: 422 });
  }

  const { scope, overview, portfolios } = await getPeriodOverview(period);

  // Most material trades by absolute P&L for the "notable trades" section.
  const marked = [...overview.positions, ...overview.closed];
  const top_trades = [...marked]
    .sort((a, b) => Math.abs(b.unrealized) - Math.abs(a.unrealized))
    .slice(0, 12)
    .map((p) => ({
      symbol: p.symbol,
      cadence: p.cadence,
      sector: p.sector,
      entry_price: p.entry_price,
      mark_price: p.current_price,
      value_ngn: Math.round(p.amount_ngn),
      pnl_ngn: Math.round(p.unrealized),
      pnl_pct: Number(p.unrealized_pct.toFixed(2)),
    }));

  const payload: EnginePerfPayload = {
    scope,
    label: labelFor(period),
    capital: overview.totals.capital,
    totals: overview.totals,
    per_cadence: overview.per_cadence.filter((c) => c.open_count + c.closed_count > 0),
    monthly_pnl: overview.monthly_pnl,
    top_trades,
    max_drawdown: overview.max_drawdown,
    sharpe: overview.sharpe,
    context: portfolios.find((p) => p.market_context)?.market_context,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of streamEngineReport(payload)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } catch {
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "error", error: "Server error while writing the report.", errorCode: "API_ERROR" }) + "\n")
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
