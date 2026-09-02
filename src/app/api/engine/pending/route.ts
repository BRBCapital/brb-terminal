import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import {
  approveTrade,
  countPendingTrades,
  getSettings,
  listPendingTrades,
  rejectTrade,
} from "@/lib/db/strategy";
import { watClock } from "@/lib/engine/clock";
import { ngxFetch } from "@/lib/ngx/client";
import type { CompanyDetail } from "@/lib/ngx/types";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — the human-approval queue: proposed trades awaiting execution, each with
// its live NGX mark for context. Admin-only.
export async function GET() {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;

  const [settings, pending] = await Promise.all([getSettings(), listPendingTrades()]);
  const syms = [...new Set(pending.map((t) => t.symbol.toUpperCase()))];
  const priceBySymbol: Record<string, number | null> = {};
  await Promise.all(
    syms.map(async (sym) => {
      const res = await ngxFetch<CompanyDetail>({ path: `companies/${sym}` });
      priceBySymbol[sym] = res.ok ? res.data.current_price ?? res.data.prev_close ?? null : null;
    })
  );

  return NextResponse.json({ ok: true, execution_mode: settings.execution_mode, pending, priceBySymbol });
}

// POST — approve or reject proposals. Body: { action, id? }.
//   approve / reject   → act on a single proposal (id required)
//   approve_all / reject_all → act on the whole queue
// Approving executes the trade (it becomes a live open position). Admin-only, audited.
export async function POST(req: NextRequest) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;

  let body: { action?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const action = body.action ?? "";
  const dateStr = watClock().dateStr;
  let approved = 0;
  let rejected = 0;

  const doApprove = async (id: string) => {
    const t = await approveTrade(id, auth.user.email, dateStr);
    if (t) {
      approved++;
      await logAudit({ actor: auth.user.email, action: "engine.trade.approve", detail: `${t.cadence} ${t.symbol} · ${t.shares} @ ${t.entry_price}` });
    }
  };
  const doReject = async (id: string) => {
    const t = await rejectTrade(id, auth.user.email);
    if (t) {
      rejected++;
      await logAudit({ actor: auth.user.email, action: "engine.trade.reject", detail: `${t.cadence} ${t.symbol}` });
    }
  };

  if (action === "approve" || action === "reject") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing trade id." }, { status: 400 });
    if (action === "approve") await doApprove(body.id);
    else await doReject(body.id);
  } else if (action === "approve_all" || action === "reject_all") {
    const pending = await listPendingTrades();
    for (const t of pending) {
      if (action === "approve_all") await doApprove(t.id);
      else await doReject(t.id);
    }
  } else {
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }

  const remaining = await countPendingTrades();
  return NextResponse.json({ ok: true, approved, rejected, remaining });
}
