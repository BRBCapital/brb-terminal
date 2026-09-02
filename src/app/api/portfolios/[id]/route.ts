import { NextRequest, NextResponse } from "next/server";
import { requirePortfolioAccess } from "@/lib/auth/guard";
import { deletePortfolio, updatePortfolio } from "@/lib/db/portfolios";
import type { PortfolioInput } from "@/lib/db/portfolios";
import { validatePortfolio } from "@/lib/portfolio/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;
  return NextResponse.json({ ok: true, portfolio: auth.portfolio });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;

  let body: PortfolioInput;
  try {
    body = (await req.json()) as PortfolioInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const issues = validatePortfolio(body);
  if (issues.some((i) => i.level === "error")) {
    return NextResponse.json(
      { ok: false, error: "Validation failed.", issues },
      { status: 422 }
    );
  }

  const portfolio = await updatePortfolio(auth.user.email, params.id, body);
  return NextResponse.json({ ok: true, portfolio });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;
  await deletePortfolio(auth.user.email, params.id);
  return NextResponse.json({ ok: true });
}
