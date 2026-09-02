import { NextRequest, NextResponse } from "next/server";
import { requirePortfolioAccess } from "@/lib/auth/guard";
import { addAlert, listAlerts, type AlertInput } from "@/lib/db/transactions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;
  const alerts = await listAlerts(params.id);
  return NextResponse.json({ ok: true, alerts });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;

  let body: AlertInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.symbol || !body.kind) {
    return NextResponse.json({ ok: false, error: "symbol and kind are required." }, { status: 422 });
  }
  if (body.kind !== "ex_div" && !(Number(body.threshold) > 0)) {
    return NextResponse.json({ ok: false, error: "This alert needs a threshold greater than zero." }, { status: 422 });
  }
  const alert = await addAlert(auth.user.email, params.id, body);
  return NextResponse.json({ ok: true, alert }, { status: 201 });
}
