import "server-only";
import { query, newId } from "./client";
import type { Horizon, PaperTrade } from "./paper-trades";

export interface PaperPortfolio {
  id: string;
  created_by: string;
  name: string;
  horizon: Horizon;
  currency: string;
  amount_input: number;
  budget_ngn: number;
  market_context: string;
  risk_note: string;
  model: string;
  created_at: string;
}

export interface PaperPortfolioWithTrades extends PaperPortfolio {
  trades: PaperTrade[];
}

export interface PaperPortfolioPositionInput {
  symbol: string;
  company_name?: string;
  sector?: string;
  entry_price: number;
  shares: number;
  amount_ngn: number;
  rationale?: string;
}

export interface CreatePaperPortfolioInput {
  actor: string;
  name: string;
  horizon: Horizon;
  currency: string;
  amount_input?: number;
  budget_ngn?: number;
  market_context?: string;
  risk_note?: string;
  model?: string;
  positions: PaperPortfolioPositionInput[];
}

function coerceMeta(row: PaperPortfolio): PaperPortfolio {
  row.amount_input = Number(row.amount_input);
  row.budget_ngn = Number(row.budget_ngn);
  return row;
}

function coerceTrade(row: PaperTrade): PaperTrade {
  row.entry_price = Number(row.entry_price);
  row.shares = Number(row.shares);
  row.amount_ngn = Number(row.amount_ngn);
  row.close_price = row.close_price == null ? null : Number(row.close_price);
  return row;
}

// Create a paper trading portfolio + its position rows (paper_trades linked via
// paper_portfolio_id). Share/price maths come pre-reconciled from the builder.
export async function createPaperPortfolio(
  input: CreatePaperPortfolioInput
): Promise<PaperPortfolioWithTrades> {
  const id = newId("pp");
  await query(
    `INSERT INTO paper_portfolios
       (id, created_by, name, horizon, currency, amount_input, budget_ngn, market_context, risk_note, model)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      input.actor,
      input.name,
      input.horizon,
      input.currency,
      input.amount_input ?? 0,
      input.budget_ngn ?? 0,
      input.market_context ?? "",
      input.risk_note ?? "",
      input.model ?? "",
    ]
  );

  for (const p of input.positions) {
    if (!(p.entry_price > 0) || !(p.shares > 0)) continue;
    await query(
      `INSERT INTO paper_trades
         (id, created_by, paper_portfolio_id, symbol, company_name, sector, horizon, currency,
          entry_price, shares, amount_ngn, rationale)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        newId("pt"),
        input.actor,
        id,
        p.symbol.toUpperCase(),
        p.company_name ?? "",
        p.sector ?? "",
        input.horizon,
        input.currency,
        p.entry_price,
        p.shares,
        p.amount_ngn,
        p.rationale ?? "",
      ]
    );
  }

  return (await getPaperPortfolio(id, input.actor))!;
}

export async function getPaperPortfolio(
  id: string,
  actor: string
): Promise<PaperPortfolioWithTrades | null> {
  const rows = await query<PaperPortfolio>(
    `SELECT * FROM paper_portfolios WHERE id = $1 AND created_by = $2`,
    [id, actor]
  );
  if (!rows.length) return null;
  const trades = await query<PaperTrade>(
    `SELECT * FROM paper_trades WHERE paper_portfolio_id = $1 ORDER BY amount_ngn DESC`,
    [id]
  );
  return { ...coerceMeta(rows[0]), trades: trades.map(coerceTrade) };
}

// All of the analyst's paper trading portfolios, newest first, each with its
// positions.
export async function listPaperPortfolios(actor: string): Promise<PaperPortfolioWithTrades[]> {
  const metas = await query<PaperPortfolio>(
    `SELECT * FROM paper_portfolios WHERE created_by = $1 ORDER BY created_at DESC`,
    [actor]
  );
  if (!metas.length) return [];
  const trades = await query<PaperTrade>(
    `SELECT * FROM paper_trades WHERE created_by = $1 AND paper_portfolio_id IS NOT NULL
     ORDER BY amount_ngn DESC`,
    [actor]
  );
  const byPortfolio = new Map<string, PaperTrade[]>();
  for (const t of trades.map(coerceTrade)) {
    const key = (t as PaperTrade & { paper_portfolio_id?: string }).paper_portfolio_id ?? "";
    if (!byPortfolio.has(key)) byPortfolio.set(key, []);
    byPortfolio.get(key)!.push(t);
  }
  return metas.map((m) => ({ ...coerceMeta(m), trades: byPortfolio.get(m.id) ?? [] }));
}

// Delete a portfolio and its positions (owner-scoped). Returns whether a
// portfolio row was removed.
export async function deletePaperPortfolio(id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM paper_portfolios WHERE id = $1 AND created_by = $2 RETURNING id`,
    [id, actor]
  );
  if (!rows.length) return false;
  await query(`DELETE FROM paper_trades WHERE paper_portfolio_id = $1 AND created_by = $2`, [id, actor]);
  return true;
}
