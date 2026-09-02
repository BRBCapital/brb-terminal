import { NextRequest, NextResponse } from "next/server";
import { authenticateMember, createMemberSession } from "@/lib/db/members";
import { MEMBER_COOKIE, memberCookieOptions } from "@/lib/auth/member";
import { clientIp, enforce, MIN } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUBLIC — member sign-in for the prospect portal.
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
  }
  const ipLimited = enforce(`mlogin:ip:${clientIp(req)}`, 30, 15 * MIN);
  if (ipLimited) return ipLimited;
  const acctLimited = enforce(`mlogin:acct:${email.toLowerCase()}`, 8, 15 * MIN, "Too many sign-in attempts. Please wait a few minutes and try again.");
  if (acctLimited) return acctLimited;

  const member = await authenticateMember(email, password);
  if (!member) {
    return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
  }

  const token = await createMemberSession(member.id);
  const res = NextResponse.json({ ok: true, member });
  res.cookies.set(MEMBER_COOKIE, token, memberCookieOptions);
  return res;
}
