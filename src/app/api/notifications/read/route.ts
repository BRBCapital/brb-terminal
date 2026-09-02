import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { markRead } from "@/lib/db/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  let body: { id?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* mark-all when no body */
  }
  await markRead(auth.user.email, body.id);
  return NextResponse.json({ ok: true });
}
