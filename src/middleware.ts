import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

// Coarse page gate: redirect to /login when the session cookie is absent.
// This only checks presence (edge runtime, no DB) — full validation happens in
// server components / API routes via getSession(). API routes self-guard and are
// excluded here so they can return proper 401 JSON instead of a redirect.
export function middleware(req: NextRequest) {
  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the login page, the public /strategies marketing landing,
  // the auth API, Next internals, and static/brand assets (the logo must be
  // publicly served — it renders on the login screen and the landing page).
  matcher: ["/((?!login|strategies|broker|api|_next/static|_next/image|favicon.ico|icon.svg|brb-logo.png).*)"],
};
