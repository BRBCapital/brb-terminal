import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getBrokerByApiKey, type Broker, type BrokerMode } from "@/lib/db/brokers";

// Authenticate an external broker API call by its key. Accepts either
// `Authorization: Bearer sk_...` or `X-API-Key: sk_...`. The key itself encodes
// whether the caller is in sandbox or live.
export async function authBrokerApi(
  req: NextRequest
): Promise<{ broker: Broker; keyMode: BrokerMode } | { response: NextResponse }> {
  const authz = req.headers.get("authorization") ?? "";
  const bearer = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : "";
  const key = bearer || req.headers.get("x-api-key") || "";
  const resolved = await getBrokerByApiKey(key);
  if (!resolved) {
    return {
      response: NextResponse.json(
        { ok: false, error: "Invalid or missing API key. Pass it as 'Authorization: Bearer <key>'." },
        { status: 401 }
      ),
    };
  }
  return resolved;
}

export const apiError = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });
