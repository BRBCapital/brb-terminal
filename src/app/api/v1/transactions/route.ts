import { NextRequest, NextResponse } from "next/server";
import { authBrokerApi } from "@/lib/auth/broker-api";
import { listBrokerTransactions } from "@/lib/db/brokers";
import { syncBrokerBook } from "@/lib/engine/broker-alloc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/transactions — every order allocated to this broker (open and
// closed) with P&L, for the key's mode.
export async function GET(req: NextRequest) {
  const auth = await authBrokerApi(req);
  if ("response" in auth) return auth.response;
  const { broker, keyMode } = auth;

  await syncBrokerBook(broker.id, keyMode);
  const txns = await listBrokerTransactions(broker.id, keyMode);

  return NextResponse.json({
    ok: true,
    mode: keyMode,
    count: txns.length,
    transactions: txns.map((t) => ({
      clientOrderId: t.source_trade_id,
      side: t.side,
      symbol: t.symbol,
      company: t.company_name,
      tenure: t.cadence.toUpperCase(),
      quantity: t.shares,
      entryPrice: t.entry_price,
      notional_ngn: t.amount_ngn,
      status: t.status, // open | closed
      brokerStatus: t.broker_status, // allocated | acknowledged | filled | rejected
      closePrice: t.close_price,
      realizedPnl_ngn: t.realized_pnl,
      openedAt: t.created_at,
      closedAt: t.closed_at,
    })),
  });
}
