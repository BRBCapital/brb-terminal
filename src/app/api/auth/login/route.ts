import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, createSession } from "@/lib/db/users";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { clientIp, enforce, MIN } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A real scrypt hash/salt pair to burn equivalent time when the email is
// unknown, keeping login response time independent of account existence.
const DUMMY_HASH =
  "a".repeat(128); // 64-byte hex; length-mismatch fails fast but scrypt still runs
const DUMMY_SALT = "0".repeat(32);

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

  // Throttle brute-force / credential stuffing: per-IP and per-account windows.
  const ipLimited = enforce(`login:ip:${clientIp(req)}`, 30, 15 * MIN);
  if (ipLimited) return ipLimited;
  const acctLimited = enforce(`login:acct:${email.toLowerCase()}`, 8, 15 * MIN, "Too many sign-in attempts. Please wait a few minutes and try again.");
  if (acctLimited) return acctLimited;

  const user = await getUserByEmail(email);
  // Constant-ish response regardless of which check fails (avoid user
  // enumeration). When the email is unknown, still run one scrypt against a
  // dummy hash so the response time matches the wrong-password path.
  if (!user) {
    verifyPassword(password, DUMMY_HASH, DUMMY_SALT);
    return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
  }
  if (!verifyPassword(password, user.password_hash, user.password_salt)) {
    return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
  }

  const token = await createSession(user.id);
  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
