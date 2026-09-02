import { NextRequest, NextResponse } from "next/server";
import { createMember, createMemberSession } from "@/lib/db/members";
import { MEMBER_COOKIE, memberCookieOptions } from "@/lib/auth/member";
import { clientIp, enforce, HOUR } from "@/lib/rate-limit";
import { sendEmail, appBaseUrl } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUBLIC — self-service prospect signup from the /strategies landing. Creates a
// member account (password hashed server-side) and starts a member session.
// Verify a Cloudflare Turnstile token when a secret is configured; a no-op
// (returns true) when TURNSTILE_SECRET_KEY is unset, so the CAPTCHA is optional.
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const d = (await r.json()) as { success?: boolean };
    return !!d.success;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: { name?: string; email?: string; company?: string; password?: string; turnstileToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  // Curb automated signup spam (each account can trigger AI-cost endpoints).
  const limited = enforce(`signup:ip:${clientIp(req)}`, 5, HOUR, "Too many sign-up attempts from this network. Please try again later.");
  if (limited) return limited;

  // Optional bot check (only enforced when TURNSTILE_SECRET_KEY is configured).
  if (!(await verifyTurnstile(body.turnstileToken ?? "", clientIp(req)))) {
    return NextResponse.json({ ok: false, error: "Captcha verification failed — please try again." }, { status: 400 });
  }

  const result = await createMember({
    name: body.name ?? "",
    email: body.email ?? "",
    company: body.company ?? "",
    password: body.password ?? "",
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });

  // Send the email-verification link (required before AI insights unlock).
  const link = `${appBaseUrl()}/api/strategies/verify?token=${result.verifyToken}`;
  await sendEmail(
    result.member.email,
    "Verify your Alternative Strategies account",
    `Welcome to Alternative Strategies.\n\nConfirm your email to unlock the monthly Strategist's Thesis:\n${link}\n\nIf you didn't request this, you can ignore it.`,
    `<p>Welcome to <b>Alternative Strategies</b>.</p><p>Confirm your email to unlock the monthly Strategist&rsquo;s Thesis:</p><p><a href="${link}">Verify my email</a></p><p style="color:#888;font-size:12px">If you didn't request this, you can ignore it.</p>`
  );

  const token = await createMemberSession(result.member.id);
  const res = NextResponse.json({ ok: true, member: result.member });
  res.cookies.set(MEMBER_COOKIE, token, memberCookieOptions);
  return res;
}
