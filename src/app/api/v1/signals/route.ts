import { NextRequest, NextResponse } from "next/server";
import { authBrokerApi } from "@/lib/auth/broker-api";
import { listBrokerTransactions } from "@/lib/db/brokers";
import { syncBrokerBook } from "@/lib/engine/broker-alloc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/signals — the OPEN orders the engine has allocated to this broker,
// scaled to their AUM. These are the instructions to execute. Sandbox vs live is
// determined by the key used.
export async function GET(req: NextRequest) {
  const auth = await authBrokerApi(req);
  if ("response" in auth) return auth.response;
  const { broker, keyMode } = auth;

  await syncBrokerBook(broker.id, keyMode);
  const open = (await listBrokerTransactions(broker.id, keyMode)).filter((t) => t.status === "open");

  return NextResponse.json({
    ok: true,
    mode: keyMode,
    count: open.length,
    signals: open.map((t) => ({
      clientOrderId: t.source_trade_id,
      side: t.side,
      symbol: t.symbol,
      quantity: t.shares,
      notional_ngn: t.amount_ngn,
      referencePrice: t.entry_price,
      weightPct: t.weight_pct,
      tenure: t.cadence.toUpperCase(),
      factors: t.signal ? JSON.parse(t.signal) : null,
      brokerStatus: t.broker_status,
    })),
  });
}
