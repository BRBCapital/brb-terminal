import { NextRequest, NextResponse } from "next/server";
import { authenticateBroker, createBrokerSession } from "@/lib/db/brokers";
import { BROKER_COOKIE, brokerCookieOptions } from "@/lib/auth/broker";
import { clientIp, enforce, MIN } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
  }
  const ipLimited = enforce(`blogin:ip:${clientIp(req)}`, 30, 15 * MIN);
  if (ipLimited) return ipLimited;
  const acctLimited = enforce(`blogin:acct:${body.email.toLowerCase()}`, 8, 15 * MIN, "Too many sign-in attempts. Please wait a few minutes and try again.");
  if (acctLimited) return acctLimited;
  const broker = await authenticateBroker(body.email, body.password);
  if (!broker) return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });

  const token = await createBrokerSession(broker.id);
  const res = NextResponse.json({ ok: true, broker });
  res.cookies.set(BROKER_COOKIE, token, brokerCookieOptions);
  return res;
}
