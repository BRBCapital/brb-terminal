import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getUserSymbolScope } from "@/lib/db/portfolios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — the current analyst's symbol scope: names held across their portfolios
// and everything on their watchlists. Used to filter the catalyst calendar.
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const scope = await getUserSymbolScope(auth.user.email);
  return NextResponse.json({ ok: true, ...scope });
}
