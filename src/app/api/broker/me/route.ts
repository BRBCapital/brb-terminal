import { NextResponse } from "next/server";
import { getBroker } from "@/lib/auth/broker";
import { getBrokerWithKeys, listBrokerTransactions } from "@/lib/db/brokers";
import { getSettings } from "@/lib/db/strategy";
import { allocationPlan, modelCapital, syncBrokerBook } from "@/lib/engine/broker-alloc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — the signed-in broker's profile, API keys, allocation plan and the
// transactions the engine allocated to them in the current (sandbox/live) mode.
export async function GET() {
  const broker = await getBroker();
  if (!broker) return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });

  const [full, settings] = await Promise.all([getBrokerWithKeys(broker.id), getSettings()]);
  await syncBrokerBook(broker.id, broker.mode); // lazy-scale the model book to AUM
  const transactions = await listBrokerTransactions(broker.id, broker.mode);

  return NextResponse.json({
    ok: true,
    broker: full,
    transactions,
    plan: allocationPlan(broker.aum_ngn, settings),
    engine: {
      model_capital: modelCapital(settings),
      execution_mode: settings.execution_mode,
      enabled: settings.enabled,
      splits: { intraday: settings.intraday_pct, weekly: settings.weekly_pct, monthly: settings.monthly_pct },
      risk: { max_position_pct: settings.max_position_pct, max_adv_pct: settings.max_adv_pct, stop_loss_pct: settings.stop_loss_pct, drawdown_halt_pct: settings.drawdown_halt_pct, fx_overlay: settings.fx_overlay },
    },
  });
}
