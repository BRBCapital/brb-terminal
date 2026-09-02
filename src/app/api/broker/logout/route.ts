import { NextRequest, NextResponse } from "next/server";
import { deleteBrokerSession } from "@/lib/db/brokers";
import { BROKER_COOKIE, brokerCookieOptions } from "@/lib/auth/broker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(BROKER_COOKIE)?.value;
  if (token) await deleteBrokerSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(BROKER_COOKIE, "", { ...brokerCookieOptions, maxAge: 0 });
  return res;
}
