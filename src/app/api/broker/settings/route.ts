import { NextRequest, NextResponse } from "next/server";
import { getBroker } from "@/lib/auth/broker";
import { getBrokerWithKeys, rotateBrokerKey, setBrokerMode, updateBrokerAum, type BrokerMode } from "@/lib/db/brokers";
import { syncBrokerBook } from "@/lib/engine/broker-alloc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST — broker self-service: set the AUM they trade with the engine, switch
// between sandbox and live, or rotate an API key.
export async function POST(req: NextRequest) {
  const broker = await getBroker();
  if (!broker) return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });

  let body: { action?: string; aum_ngn?: number; mode?: string; which?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  let rotatedKey: string | undefined;
  switch (body.action) {
    case "setAum": {
      const aum = Number(body.aum_ngn);
      if (!isFinite(aum) || aum < 0) return NextResponse.json({ ok: false, error: "Enter a valid AUM amount." }, { status: 400 });
      await updateBrokerAum(broker.id, aum);
      await syncBrokerBook(broker.id, broker.mode); // re-scale future/existing allocations
      break;
    }
    case "setMode": {
      const mode: BrokerMode = body.mode === "live" ? "live" : "sandbox";
      await setBrokerMode(broker.id, mode);
      await syncBrokerBook(broker.id, mode);
      break;
    }
    case "rotateKey": {
      const which: BrokerMode = body.which === "live" ? "live" : "sandbox";
      rotatedKey = await rotateBrokerKey(broker.id, which);
      break;
    }
    default:
      return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, broker: await getBrokerWithKeys(broker.id), rotatedKey });
}
