import { NextRequest, NextResponse } from "next/server";
import { requirePortfolioAccess } from "@/lib/auth/guard";
import {
  addTransaction,
  addTransactions,
  listTransactions,
  type TransactionInput,
} from "@/lib/db/transactions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;
  const transactions = await listTransactions(params.id);
  return NextResponse.json({ ok: true, transactions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePortfolioAccess(params.id);
  if ("response" in auth) return auth.response;

  let body: TransactionInput | { transactions: TransactionInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  if ("transactions" in body && Array.isArray(body.transactions)) {
    const invalid = body.transactions.find((t) => !t.symbol || !t.kind || !t.trade_date);
    if (invalid) {
      return NextResponse.json({ ok: false, error: "Each transaction needs symbol, kind, trade_date." }, { status: 422 });
    }
    const count = await addTransactions(auth.user.email, params.id, body.transactions);
    const transactions = await listTransactions(params.id);
    return NextResponse.json({ ok: true, count, transactions }, { status: 201 });
  }

  const t = body as TransactionInput;
  if (!t.symbol || !t.kind || !t.trade_date) {
    return NextResponse.json({ ok: false, error: "symbol, kind and trade_date are required." }, { status: 422 });
  }
  if ((t.kind === "buy" || t.kind === "sell") && !(Number(t.units) > 0 && Number(t.price) > 0)) {
    return NextResponse.json({ ok: false, error: "Buys and sells need units and price greater than zero." }, { status: 422 });
  }
  if (t.kind === "dividend" && !(Number(t.amount) > 0)) {
    return NextResponse.json({ ok: false, error: "Dividend needs an amount greater than zero." }, { status: 422 });
  }

  const transaction = await addTransaction(auth.user.email, params.id, t);
  return NextResponse.json({ ok: true, transaction }, { status: 201 });
}
