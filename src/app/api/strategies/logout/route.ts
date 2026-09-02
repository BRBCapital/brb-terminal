import { NextRequest, NextResponse } from "next/server";
import { deleteMemberSession } from "@/lib/db/members";
import { MEMBER_COOKIE, memberCookieOptions } from "@/lib/auth/member";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(MEMBER_COOKIE)?.value;
  if (token) await deleteMemberSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(MEMBER_COOKIE, "", { ...memberCookieOptions, maxAge: 0 });
  return res;
}
