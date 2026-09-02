import { NextRequest, NextResponse } from "next/server";
import { requirePortfolioAccess } from "@/lib/auth/guard";
import { deleteTransaction } from "@/lib/db/transactions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; txId: string } }
) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;
  const ok = await deleteTransaction(auth.user.email, params.id, params.txId);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Transaction not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
