import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { deletePaperPortfolio } from "@/lib/db/paper-portfolios";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE — remove a paper trading portfolio and its positions (owner-scoped).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const ok = await deletePaperPortfolio(params.id, auth.user.email);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Portfolio not found." }, { status: 404 });
  }
  await logAudit({ actor: auth.user.email, action: "paper_portfolio.delete", detail: params.id });
  return NextResponse.json({ ok: true });
}
