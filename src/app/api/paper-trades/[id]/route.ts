import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { deleteClosedPaperTrade } from "@/lib/db/paper-trades";
import { logAudit } from "@/lib/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE — remove a single CLOSED paper trade owned by the current analyst.
// Open positions can't be deleted (close them first); scoping is enforced in
// the repo query (created_by + status = 'closed').
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const ok = await deleteClosedPaperTrade(params.id, auth.user.email);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "No closed trade with that id (open positions must be closed first)." },
      { status: 404 }
    );
  }
  await logAudit({ actor: auth.user.email, action: "paper_trade.delete", detail: params.id });
  return NextResponse.json({ ok: true });
}
