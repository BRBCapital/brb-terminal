import "server-only";
import { query, queryOne, newId } from "./client";

export type HoldingMode = "weight" | "units";

export interface Holding {
  id: string;
  portfolio_id: string;
  symbol: string;
  company_name: string;
  sector: string;
  mode: HoldingMode;
  weight: number | null;
  units: number | null;
  entry_price: number;
}

export interface Portfolio {
  id: string;
  name: string;
  mandate_notes: string;
  benchmark_symbol: string;
  base_currency: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  ledger_seeded_at: string | null; // set once the Manage ledger is auto-seeded
}

export interface PortfolioWithHoldings extends Portfolio {
  holdings: Holding[];
}

export interface HoldingInput {
  symbol: string;
  company_name?: string;
  sector?: string;
  mode: HoldingMode;
  weight?: number | null;
  units?: number | null;
  entry_price: number;
}

export interface PortfolioInput {
  name: string;
  mandate_notes?: string;
  benchmark_symbol?: string;
  base_currency?: string;
  holdings: HoldingInput[];
}

async function audit(
  actor: string,
  action: string,
  portfolioId: string | null,
  detail: string
) {
  await query(
    `INSERT INTO audit_log (id, actor, action, portfolio_id, detail)
     VALUES ($1,$2,$3,$4,$5)`,
    [newId("aud"), actor, action, portfolioId, detail]
  );
}

// List row enriched with cheap model-level aggregates for richer list cards.
export interface PortfolioSummary extends Portfolio {
  holdings_count: number;
  sector_count: number;
}

const LIST_SELECT = `
  SELECT p.*,
    (SELECT count(*)::int FROM holdings h WHERE h.portfolio_id = p.id) AS holdings_count,
    (SELECT count(DISTINCT h.sector)::int FROM holdings h
       WHERE h.portfolio_id = p.id AND coalesce(h.sector,'') <> '') AS sector_count
  FROM portfolios p`;

export async function listPortfolios(actor: string): Promise<PortfolioSummary[]> {
  return query<PortfolioSummary>(
    `${LIST_SELECT} WHERE p.created_by = $1 ORDER BY p.updated_at DESC`,
    [actor]
  );
}

// Admins see every analyst's portfolios.
export async function listAllPortfolios(): Promise<PortfolioSummary[]> {
  return query<PortfolioSummary>(`${LIST_SELECT} ORDER BY p.updated_at DESC`);
}

// Distinct symbols the analyst cares about — every name held across their model
// portfolios plus everything on their watchlists. Powers the catalyst calendar's
// "my holdings / my watchlists" scope filters.
export async function getUserSymbolScope(
  email: string
): Promise<{ holdings: string[]; watchlist: string[] }> {
  const held = await query<{ symbol: string }>(
    `SELECT DISTINCT h.symbol FROM holdings h
       JOIN portfolios p ON p.id = h.portfolio_id
      WHERE p.created_by = $1`,
    [email]
  );
  const watched = await query<{ symbol: string }>(
    `SELECT DISTINCT wi.symbol FROM watchlist_items wi
       JOIN watchlists w ON w.id = wi.watchlist_id
      WHERE w.created_by = $1`,
    [email]
  );
  return {
    holdings: held.map((r) => r.symbol.toUpperCase()),
    watchlist: watched.map((r) => r.symbol.toUpperCase()),
  };
}

export async function getPortfolio(
  id: string
): Promise<PortfolioWithHoldings | null> {
  const p = await queryOne<Portfolio>(`SELECT * FROM portfolios WHERE id = $1`, [
    id,
  ]);
  if (!p) return null;
  const holdings = await query<Holding>(
    `SELECT * FROM holdings WHERE portfolio_id = $1 ORDER BY created_at ASC`,
    [id]
  );
  return { ...p, holdings };
}

async function insertHoldings(portfolioId: string, holdings: HoldingInput[]) {
  for (const h of holdings) {
    await query(
      `INSERT INTO holdings (id, portfolio_id, symbol, company_name, sector, mode, weight, units, entry_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        newId("hold"),
        portfolioId,
        h.symbol.toUpperCase(),
        h.company_name ?? "",
        h.sector ?? "",
        h.mode,
        h.mode === "weight" ? h.weight ?? null : null,
        h.mode === "units" ? h.units ?? null : null,
        h.entry_price,
      ]
    );
  }
}

export async function createPortfolio(
  actor: string,
  input: PortfolioInput
): Promise<PortfolioWithHoldings> {
  const id = newId("pf");
  await query(
    `INSERT INTO portfolios (id, name, mandate_notes, benchmark_symbol, base_currency, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      id,
      input.name,
      input.mandate_notes ?? "",
      input.benchmark_symbol ?? "ASI",
      input.base_currency ?? "NGN",
      actor,
    ]
  );
  await insertHoldings(id, input.holdings);
  await audit(
    actor,
    "portfolio.create",
    id,
    `${input.name} · ${input.holdings.length} holdings`
  );
  return (await getPortfolio(id))!;
}

export async function updatePortfolio(
  actor: string,
  id: string,
  input: PortfolioInput
): Promise<PortfolioWithHoldings | null> {
  const existing = await queryOne<Portfolio>(
    `SELECT * FROM portfolios WHERE id = $1`,
    [id]
  );
  if (!existing) return null;
  await query(
    `UPDATE portfolios
       SET name = $2, mandate_notes = $3, benchmark_symbol = $4,
           base_currency = $5, updated_at = now()
     WHERE id = $1`,
    [
      id,
      input.name,
      input.mandate_notes ?? "",
      input.benchmark_symbol ?? "ASI",
      input.base_currency ?? "NGN",
    ]
  );
  // Replace holdings wholesale — simplest correct semantics for an editor.
  await query(`DELETE FROM holdings WHERE portfolio_id = $1`, [id]);
  await insertHoldings(id, input.holdings);
  await audit(
    actor,
    "portfolio.update",
    id,
    `${input.name} · ${input.holdings.length} holdings`
  );
  return getPortfolio(id);
}

export async function deletePortfolio(
  actor: string,
  id: string
): Promise<boolean> {
  const existing = await queryOne<Portfolio>(
    `SELECT id FROM portfolios WHERE id = $1`,
    [id]
  );
  if (!existing) return false;
  await query(`DELETE FROM portfolios WHERE id = $1`, [id]);
  await audit(actor, "portfolio.delete", id, "");
  return true;
}
