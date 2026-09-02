import { NextRequest, NextResponse } from "next/server";
import { authBrokerApi } from "@/lib/auth/broker-api";
import { getSettings } from "@/lib/db/strategy";
import { allocationPlan, modelCapital } from "@/lib/engine/broker-alloc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/account — the authenticated broker's account, mode and how their
// AUM is deployed across cadences.
export async function GET(req: NextRequest) {
  const auth = await authBrokerApi(req);
  if ("response" in auth) return auth.response;
  const { broker, keyMode } = auth;
  const settings = await getSettings();

  return NextResponse.json({
    ok: true,
    account: {
      firm: broker.firm_name,
      mode: keyMode,
      aum_ngn: broker.aum_ngn,
      status: broker.status,
      engine_model_capital_ngn: modelCapital(settings),
      allocation: allocationPlan(broker.aum_ngn, settings),
      risk: {
        max_position_pct: settings.max_position_pct,
        max_pct_daily_volume: settings.max_adv_pct,
        stop_loss_pct: settings.stop_loss_pct,
        drawdown_halt_pct: settings.drawdown_halt_pct,
        fx_overlay: settings.fx_overlay,
      },
    },
  });
}
