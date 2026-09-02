import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import {
  createPortfolio,
  listPortfolios,
  listAllPortfolios,
} from "@/lib/db/portfolios";
import type { PortfolioInput } from "@/lib/db/portfolios";
import { validatePortfolio } from "@/lib/portfolio/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const portfolios =
    auth.user.role === "admin"
      ? await listAllPortfolios()
      : await listPortfolios(auth.user.email);
  return NextResponse.json({ ok: true, portfolios });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
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

  const portfolio = await createPortfolio(auth.user.email, body);
  return NextResponse.json({ ok: true, portfolio }, { status: 201 });
}
