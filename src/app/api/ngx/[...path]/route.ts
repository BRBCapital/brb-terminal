// Catch-all authenticated proxy to the NGN Market API.
//
//   GET /api/ngx/market/snapshot            -> upstream GET /market/snapshot
//   GET /api/ngx/market/movers?limit=5      -> upstream GET /market/movers?limit=5
//
// The browser never sees the API key; it only ever talks to this route. Every
// response is the normalized ProxyResult envelope (see lib/ngx/types.ts).

import { NextRequest, NextResponse } from "next/server";
import { isAllowedPath, ngxFetch } from "@/lib/ngx/client";
import { requireUser } from "@/lib/auth/guard";

// Always run on the Node.js runtime (module-level cache + server-only key).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  // Middleware excludes /api so it can return JSON 401s — this proxy MUST
  // self-guard, or anonymous callers could burn the shared quota with our
  // secret key. Every proxied fetch requires a signed-in user.
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const path = (params.path ?? []).join("/");

  // account/* exposes the shared NGN Market account's plan/usage/billing —
  // restrict it to admins (the admin quota panel is its only consumer).
  if (path.startsWith("account/") && auth.user.role !== "admin") {
    return NextResponse.json(
      { ok: false, meta: null, error: { code: "FORBIDDEN", status: 403, message: "Admin only." } },
      { status: 403 }
    );
  }

  if (!isAllowedPath(path)) {
    return NextResponse.json(
      {
        ok: false,
        meta: null,
        error: {
          code: "NOT_FOUND",
          status: 404,
          message: `Path '/${path}' is not a proxied NGN Market endpoint.`,
        },
      },
      { status: 404 }
    );
  }

  const query = req.nextUrl.searchParams;
  const skipCache = query.get("_refresh") === "1";
  query.delete("_refresh");
  const queryString = query.toString();

  const result = await ngxFetch({ path, query: queryString, skipCache });

  const httpStatus = result.ok ? 200 : result.error.status || 502;
  return NextResponse.json(result, { status: httpStatus });
}
