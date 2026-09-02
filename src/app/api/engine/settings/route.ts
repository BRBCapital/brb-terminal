import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { getSettings, updateSettings } from "@/lib/db/strategy";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NUMERIC_FIELDS = [
  "total_capital_ngn",
  "intraday_pct",
  "weekly_pct",
  "monthly_pct",
  "intraday_capital",
  "weekly_capital",
  "monthly_capital",
  "max_position_pct",
  "max_adv_pct",
  "stop_loss_pct",
  "drawdown_halt_pct",
];

export async function GET() {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;
  return NextResponse.json({ ok: true, settings: await getSettings() });
}

// POST — update engine settings (enable/pause, allocation, risk params).
export async function POST(req: NextRequest) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.fx_overlay === "boolean") patch.fx_overlay = body.fx_overlay;
  if (body.allocation_mode === "auto" || body.allocation_mode === "manual") {
    patch.allocation_mode = body.allocation_mode;
  }
  for (const f of NUMERIC_FIELDS) {
    if (body[f] !== undefined) {
      const n = Number(body[f]);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ ok: false, error: `Invalid value for ${f}.` }, { status: 422 });
      }
      patch[f] = n;
    }
  }

  const settings = await updateSettings(patch, auth.user.email);
  await logAudit({
    actor: auth.user.email,
    action: "engine.settings",
    detail: JSON.stringify(patch).slice(0, 300),
  });
  return NextResponse.json({ ok: true, settings });
}
