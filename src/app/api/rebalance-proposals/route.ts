import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { listAllProposals, type ProposalStatus } from "@/lib/db/proposals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The approvals queue is a PM/Admin surface.
export async function GET(req: NextRequest) {
  const auth = await requireRole("pm");
  if ("response" in auth) return auth.response;
  const status = req.nextUrl.searchParams.get("status") as ProposalStatus | null;
  const proposals = await listAllProposals(status ?? undefined);
  return NextResponse.json({ ok: true, proposals });
}
