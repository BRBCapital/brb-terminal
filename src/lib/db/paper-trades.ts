import "server-only";
import { query, queryOne, newId } from "./client";

export type Horizon = "intraday" | "weekly" | "monthly" | "yearly";

export interface PaperTrade {
  id: string;
  created_by: string;
  symbol: string;
  company_name: string;
  sector: string;
  horizon: Horizon;
  currency: string;
  entry_price: number;
  shares: number;
  amount_ngn: number;
  rationale: string;
  status: "open" | "closed";
  opened_at: string;
  close_price: number | null;
  closed_at: string | null;
  paper_portfolio_id?: string | null; // set when part of a paper trading portfolio
}

// PGlite returns NUMERIC columns as strings — coerce to honest numbers.
function coerce(row: PaperTrade | null): PaperTrade | null {
  if (!row) return null;
  row.entry_price = Number(row.entry_price);
  row.shares = Number(row.shares);
  row.amount_ngn = Number(row.amount_ngn);
  row.close_price = row.close_price == null ? null : Number(row.close_price);
  return row;
}

// Standalone paper trades only (individual picks) — grouped positions belonging
// to a paper trading portfolio are managed via the paper-portfolios repo.
export async function listPaperTrades(actor: string): Promise<PaperTrade[]> {
  const rows = await query<PaperTrade>(
    `SELECT * FROM paper_trades WHERE created_by = $1 AND paper_portfolio_id IS NULL
     ORDER BY (status = 'open') DESC, opened_at DESC`,
    [actor]
  );
  return rows.map((r) => coerce(r)!);
}

export async function getPaperTrade(id: string, actor: string): Promise<PaperTrade | null> {
  return coerce(
    await queryOne<PaperTrade>(`SELECT * FROM paper_trades WHERE id = $1 AND created_by = $2`, [
      id,
      actor,
    ])
  );
}

export async function openPaperTrade(input: {
  actor: string;
  symbol: string;
  companyName: string;
  sector: string;
  horizon: Horizon;
  currency: string;
  entryPrice: number;
  shares: number;
  amountNgn: number;
  rationale: string;
}): Promise<PaperTrade> {
  const id = newId("pt");
  await query(
    `INSERT INTO paper_trades
       (id, created_by, symbol, company_name, sector, horizon, currency, entry_price, shares, amount_ngn, rationale)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      input.actor,
      input.symbol.toUpperCase(),
      input.companyName,
      input.sector,
      input.horizon,
      input.currency,
      input.entryPrice,
      input.shares,
      input.amountNgn,
      input.rationale,
    ]
  );
  return (await getPaperTrade(id, input.actor))!;
}

// Delete a single CLOSED trade (open positions can't be deleted — close first).
export async function deleteClosedPaperTrade(id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM paper_trades WHERE id = $1 AND created_by = $2 AND status = 'closed' RETURNING id`,
    [id, actor]
  );
  return rows.length > 0;
}

// Clear the actor's entire closed-positions history. Returns the count removed.
export async function clearClosedPaperTrades(actor: string): Promise<number> {
  const rows = await query<{ id: string }>(
    `DELETE FROM paper_trades WHERE created_by = $1 AND status = 'closed' AND paper_portfolio_id IS NULL RETURNING id`,
    [actor]
  );
  return rows.length;
}

export async function closePaperTrade(
  id: string,
  actor: string,
  closePrice: number
): Promise<PaperTrade | null> {
  const t = await getPaperTrade(id, actor);
  if (!t || t.status === "closed") return t;
  await query(
    `UPDATE paper_trades SET status = 'closed', close_price = $2, closed_at = now()
     WHERE id = $1 AND created_by = $3`,
    [id, closePrice, actor]
  );
  return getPaperTrade(id, actor);
}
