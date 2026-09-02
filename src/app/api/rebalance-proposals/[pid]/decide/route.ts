import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { decideProposal, getProposal } from "@/lib/db/proposals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { pid: string } }
) {
  const auth = await requireRole("pm");
  if ("response" in auth) return auth.response;

  let body: { decision?: "approved" | "rejected"; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (body.decision !== "approved" && body.decision !== "rejected") {
    return NextResponse.json({ ok: false, error: "decision must be approved or rejected." }, { status: 422 });
  }
  // Segregation of duties (maker/checker): the submitter can't decide their own
  // proposal, even as a PM/admin.
  const existing = await getProposal(params.pid);
  if (existing && existing.created_by === auth.user.email) {
    return NextResponse.json(
      { ok: false, error: "You can't decide a proposal you submitted — it needs a different approver." },
      { status: 403 }
    );
  }
  const proposal = await decideProposal(auth.user.email, params.pid, body.decision, body.note ?? "");
  if (!proposal) {
    return NextResponse.json({ ok: false, error: "Proposal not found or already decided." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, proposal });
}
