import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { deletePriceAlert, rearmPriceAlert } from "@/lib/db/price-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const ok = await deletePriceAlert(params.id, auth.user.email);
  if (!ok) return NextResponse.json({ ok: false, error: "Alert not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// PATCH re-arms a fired alert (clears the triggered stamps so it can notify again).
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const ok = await rearmPriceAlert(params.id, auth.user.email);
  if (!ok) return NextResponse.json({ ok: false, error: "Alert not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
