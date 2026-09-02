import { NextRequest, NextResponse } from "next/server";
import { authBrokerApi, apiError } from "@/lib/auth/broker-api";
import { recordExecutionReport } from "@/lib/db/brokers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["acknowledged", "filled", "rejected", "cancelled"]);

// POST /api/v1/execution-reports — the broker reports back what happened to an
// allocated order. Body: { clientOrderId, status }.
export async function POST(req: NextRequest) {
  const auth = await authBrokerApi(req);
  if ("response" in auth) return auth.response;
  const { broker, keyMode } = auth;

  let body: { clientOrderId?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return apiError(400, "Invalid JSON body.");
  }

  const clientOrderId = String(body.clientOrderId ?? "");
  const status = String(body.status ?? "").toLowerCase();
  if (!clientOrderId) return apiError(400, "clientOrderId is required.");
  if (!ALLOWED.has(status)) return apiError(422, `status must be one of: ${[...ALLOWED].join(", ")}.`);

  const updated = await recordExecutionReport(broker.id, clientOrderId, keyMode, status);
  if (!updated) return apiError(404, "No allocated order matches that clientOrderId in this mode.");

  return NextResponse.json({
    ok: true,
    clientOrderId,
    recorded: status,
    order: { symbol: updated.symbol, quantity: updated.shares, brokerStatus: updated.broker_status },
  });
}
