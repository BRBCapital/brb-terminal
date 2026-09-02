import { NextRequest, NextResponse } from "next/server";
import { requirePortfolioAccess } from "@/lib/auth/guard";
import { deleteAlert } from "@/lib/db/transactions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; alertId: string } }
) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;
  const ok = await deleteAlert(auth.user.email, params.id, params.alertId);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Alert not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
