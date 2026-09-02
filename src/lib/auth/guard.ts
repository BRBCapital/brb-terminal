import "server-only";
import { NextResponse } from "next/server";
import { getSession, hasRole } from "./session";
import { getPortfolio } from "@/lib/db/portfolios";
import { getWatchlist } from "@/lib/db/watchlists";
import type { Role, User } from "@/lib/db/users";

// Route guards. Each returns either the authorized context or a NextResponse to
// return immediately (401/403/404).

export async function requireUser(): Promise<
  { user: User } | { response: NextResponse }
> {
  const user = await getSession();
  if (!user) {
    return {
      response: NextResponse.json(
        { ok: false, error: "Authentication required." },
        { status: 401 }
      ),
    };
  }
  return { user };
}

// Require at least a given role (admin ≥ pm ≥ analyst).
export async function requireRole(min: Role): Promise<
  { user: User } | { response: NextResponse }
> {
  const user = await getSession();
  if (!user) {
    return { response: NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 }) };
  }
  if (!hasRole(user, min)) {
    return { response: NextResponse.json({ ok: false, error: "Insufficient role." }, { status: 403 }) };
  }
  return { user };
}

// Load a portfolio the current user is allowed to touch (owner or admin).
export async function requirePortfolioAccess(id: string): Promise<
  | { user: User; portfolio: Awaited<ReturnType<typeof getPortfolio>> }
  | { response: NextResponse }
> {
  const auth = await requireUser();
  if ("response" in auth) return auth;
  const portfolio = await getPortfolio(id);
  if (!portfolio) {
    return {
      response: NextResponse.json({ ok: false, error: "Portfolio not found." }, { status: 404 }),
    };
  }
  if (auth.user.role !== "admin" && portfolio.created_by !== auth.user.email) {
    return {
      response: NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 }),
    };
  }
  return { user: auth.user, portfolio };
}

export async function requireWatchlistAccess(id: string): Promise<
  | { user: User; watchlist: NonNullable<Awaited<ReturnType<typeof getWatchlist>>> }
  | { response: NextResponse }
> {
  const auth = await requireUser();
  if ("response" in auth) return auth;
  const watchlist = await getWatchlist(id);
  if (!watchlist) {
    return {
      response: NextResponse.json({ ok: false, error: "Watchlist not found." }, { status: 404 }),
    };
  }
  if (auth.user.role !== "admin" && watchlist.created_by !== auth.user.email) {
    return { response: NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 }) };
  }
  return { user: auth.user, watchlist };
}
