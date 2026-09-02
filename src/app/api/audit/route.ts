import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth/session";
import { listAudit } from "@/lib/db/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSession();
  // The audit trail is an admin/compliance surface.
  if (!hasRole(user, "admin")) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }
  const portfolioId = req.nextUrl.searchParams.get("portfolio") ?? undefined;
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;
  const entries = await listAudit({ portfolioId, limit });
  return NextResponse.json({ ok: true, entries });
}
