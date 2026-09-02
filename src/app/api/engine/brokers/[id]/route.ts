import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { getBrokerWithKeys, resetBrokerPassword, setBrokerStatus } from "@/lib/db/brokers";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — a broker's full record incl. API keys (admin).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;
  const broker = await getBrokerWithKeys(params.id);
  if (!broker) return NextResponse.json({ ok: false, error: "Broker not found." }, { status: 404 });
  return NextResponse.json({ ok: true, broker });
}

// PATCH — admin actions: suspend / activate / set AUM.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;

  let body: { action?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const broker = await getBrokerWithKeys(params.id);
  if (!broker) return NextResponse.json({ ok: false, error: "Broker not found." }, { status: 404 });

  switch (body.action) {
    case "suspend":
      await setBrokerStatus(params.id, "suspended");
      await logAudit({ actor: auth.user.email, action: "broker.suspend", detail: broker.firm_name });
      break;
    case "activate":
      await setBrokerStatus(params.id, "active");
      await logAudit({ actor: auth.user.email, action: "broker.activate", detail: broker.firm_name });
      break;
    case "resetPassword": {
      const result = await resetBrokerPassword(params.id, String(body.password ?? ""));
      if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      await logAudit({ actor: auth.user.email, action: "broker.resetPassword", detail: broker.firm_name });
      break;
    }
    default:
      return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, broker: await getBrokerWithKeys(params.id) });
}
