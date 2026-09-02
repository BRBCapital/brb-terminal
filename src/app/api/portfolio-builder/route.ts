import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { buildPortfolio } from "@/lib/ai/portfolio-builder";
import { logAudit } from "@/lib/db/audit";
import type { Horizon } from "@/lib/db/paper-trades";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Fable 5 construction can run a few minutes

const HORIZONS = ["intraday", "weekly", "monthly", "yearly"];

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  let body: { amount?: number; currency?: string; horizon?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const amount = Number(body.amount);
  const currency = body.currency === "USD" ? "USD" : "NGN";
  if (!HORIZONS.includes(body.horizon ?? "")) {
    return NextResponse.json({ ok: false, error: "Choose a valid trading horizon." }, { status: 422 });
  }
  if (!(amount > 0)) {
    return NextResponse.json({ ok: false, error: "Enter an amount greater than zero." }, { status: 422 });
  }

  const result = await buildPortfolio({ amount, currency, horizon: body.horizon as Horizon });
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
    action: "ai.portfolio_build",
    detail: `${currency} ${amount} · ${body.horizon} · ${result.portfolio!.positions.length} picks`,
  });
  return NextResponse.json({ ok: true, portfolio: result.portfolio });
}
