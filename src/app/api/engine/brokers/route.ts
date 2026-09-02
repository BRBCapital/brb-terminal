import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { createBroker, listBrokers } from "@/lib/db/brokers";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — list broker accounts (admin).
export async function GET() {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;
  return NextResponse.json({ ok: true, brokers: await listBrokers() });
}

// POST — create a broker account (admin). Returns the account WITH its API keys
// once, so the admin can hand them over securely.
export async function POST(req: NextRequest) {
  const auth = await requireRole("admin");
  if ("response" in auth) return auth.response;

  let body: { firm_name?: string; contact_name?: string; email?: string; password?: string; aum_ngn?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const result = await createBroker({
    firm_name: body.firm_name ?? "",
    contact_name: body.contact_name ?? "",
    email: body.email ?? "",
    password: body.password ?? "",
    aum_ngn: Number(body.aum_ngn ?? 0),
    createdBy: auth.user.email,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });

  await logAudit({ actor: auth.user.email, action: "broker.create", detail: `${result.broker.firm_name} <${result.broker.email}>` });
  return NextResponse.json({ ok: true, broker: result.broker });
}
