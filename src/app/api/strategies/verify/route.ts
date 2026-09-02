import { NextRequest, NextResponse } from "next/server";
import { verifyMemberByToken } from "@/lib/db/members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUBLIC — consumes an email-verification token from the signup link and marks
// the member verified, then redirects into the portal.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const member = await verifyMemberByToken(token);
  const dest = member
    ? new URL("/strategies/insights?verified=1", req.nextUrl.origin)
    : new URL("/strategies/login?verify=invalid", req.nextUrl.origin);
  return NextResponse.redirect(dest);
}
