import "server-only";
import { query, queryOne, newId } from "./client";

// Cadences the automated engine trades. These are a subset of the paper-trading
// `Horizon` union and are valid inputs to buildPortfolio().
export type Cadence = "intraday" | "weekly" | "monthly";
export const CADENCES: Cadence[] = ["intraday", "weekly", "monthly"];

export type ExecutionMode = "auto" | "manual";

export interface StrategySettings {
  id: string;
  enabled: boolean;
  execution_mode: ExecutionMode;
  allocation_mode: "auto" | "manual";
  total_capital_ngn: number;
  intraday_pct: number;
  weekly_pct: number;
  monthly_pct: number;
  intraday_capital: number;
  weekly_capital: number;
  monthly_capital: number;
  max_position_pct: number;
  max_adv_pct: number;
  stop_loss_pct: number;
  fx_overlay: boolean;
  drawdown_halt_pct: number;
  regime_enabled: boolean;
  regime_dwell_days: number;
  updated_at: string;
  updated_by: string;
}

export interface StrategyPortfolio {
  id: string;
  cadence: Cadence;
  period: string; // YYYY-MM
  capital_ngn: number;
  status: "active" | "closed";
  model: string;
  market_context: string;
  risk_note: string;
  created_at: string;
}

export interface StrategyTrade {
  id: string;
  strategy_portfolio_id: string;
  cadence: Cadence;
  period: string;
  symbol: string;
  company_name: string;
  sector: string;
  entry_price: number;
  shares: number;
  amount_ngn: number;
  target_price: number | null;
  stop_loss: number | null;
  signal: string;
  rationale: string;
  status: "pending" | "open" | "closed" | "rejected";
  opened_at: string;
  opened_on: string; // YYYY-MM-DD
  close_price: number | null;
  closed_at: string | null;
  realized_pnl: number | null;
  close_reason: string;
  decided_by: string;
  decided_at: string | null;
}

export interface StrategyRun {
  id: string;
  kind: string;
  run_key: string;
  status: "running" | "success" | "error" | "skipped";
  trigger: "schedule" | "manual";
  trades_opened: number;
  trades_closed: number;
  pnl: number;
  detail: string;
  fired_at: string;
  finished_at: string | null;
}

const num = (v: unknown) => Number(v);
const numN = (v: unknown) => (v == null ? null : Number(v));

// PGlite returns NUMERIC as strings; coerce to honest numbers.
function coerceSettings(r: Record<string, unknown>): StrategySettings {
  return {
    id: String(r.id),
    enabled: Boolean(r.enabled),
    execution_mode: (r.execution_mode as ExecutionMode) ?? "manual",
    allocation_mode: (r.allocation_mode as StrategySettings["allocation_mode"]) ?? "auto",
    total_capital_ngn: num(r.total_capital_ngn),
    intraday_pct: num(r.intraday_pct),
    weekly_pct: num(r.weekly_pct),
    monthly_pct: num(r.monthly_pct),
    intraday_capital: num(r.intraday_capital),
    weekly_capital: num(r.weekly_capital),
    monthly_capital: num(r.monthly_capital),
    max_position_pct: num(r.max_position_pct),
    max_adv_pct: num(r.max_adv_pct),
    stop_loss_pct: num(r.stop_loss_pct),
    fx_overlay: Boolean(r.fx_overlay),
    drawdown_halt_pct: num(r.drawdown_halt_pct),
    regime_enabled: Boolean(r.regime_enabled),
    regime_dwell_days: num(r.regime_dwell_days),
    updated_at: String(r.updated_at),
    updated_by: String(r.updated_by ?? ""),
  };
}

// PGlite returns TIMESTAMPTZ as a Date and DATE as a Date/string — normalise the
// temporal columns to ISO strings so downstream .slice()/date math is safe.
const isoStr = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : String(v ?? "");

function coerceTrade(r: Record<string, unknown>): StrategyTrade {
  return {
    ...(r as unknown as StrategyTrade),
    entry_price: num(r.entry_price),
    shares: num(r.shares),
    amount_ngn: num(r.amount_ngn),
    target_price: numN(r.target_price),
    stop_loss: numN(r.stop_loss),
    close_price: numN(r.close_price),
    realized_pnl: numN(r.realized_pnl),
    opened_at: isoStr(r.opened_at),
    opened_on: isoStr(r.opened_on).slice(0, 10),
    closed_at: r.closed_at == null ? null : isoStr(r.closed_at),
    decided_by: String(r.decided_by ?? ""),
    decided_at: r.decided_at == null ? null : isoStr(r.decided_at),
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export async function getSettings(): Promise<StrategySettings> {
  // Ensure the single default row exists, then read it.
  await query(`INSERT INTO strategy_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING`);
  const row = await queryOne<Record<string, unknown>>(
    `SELECT * FROM strategy_settings WHERE id = 'default'`
  );
  return coerceSettings(row!);
}

const SETTABLE = [
  "enabled",
  "execution_mode",
  "allocation_mode",
  "total_capital_ngn",
  "intraday_pct",
  "weekly_pct",
  "monthly_pct",
  "intraday_capital",
  "weekly_capital",
  "monthly_capital",
  "max_position_pct",
  "max_adv_pct",
  "stop_loss_pct",
  "fx_overlay",
  "drawdown_halt_pct",
  "regime_enabled",
  "regime_dwell_days",
] as const;

export async function updateSettings(
  patch: Record<string, unknown>,
  actor: string
): Promise<StrategySettings> {
  await getSettings(); // ensure row exists
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const key of SETTABLE) {
    if (patch[key] !== undefined) {
      vals.push(patch[key]);
      sets.push(`${key} = $${vals.length}`);
    }
  }
  if (sets.length) {
    vals.push(actor);
    sets.push(`updated_by = $${vals.length}`);
    sets.push(`updated_at = now()`);
    await query(`UPDATE strategy_settings SET ${sets.join(", ")} WHERE id = 'default'`, vals);
  }
  return getSettings();
}

// ---------------------------------------------------------------------------
// Portfolios (one active profile per cadence+period)
// ---------------------------------------------------------------------------
export async function getActivePortfolio(
  cadence: Cadence,
  period: string
): Promise<StrategyPortfolio | null> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT * FROM strategy_portfolios
      WHERE cadence = $1 AND period = $2 AND status = 'active'
      ORDER BY created_at DESC LIMIT 1`,
    [cadence, period]
  );
  return row ? ({ ...(row as unknown as StrategyPortfolio), capital_ngn: num(row.capital_ngn) }) : null;
}

// Reuse the month's active profile if present, else create it.
export async function upsertActivePortfolio(input: {
  cadence: Cadence;
  period: string;
  capital_ngn: number;
  model?: string;
  market_context?: string;
  risk_note?: string;
}): Promise<string> {
  const existing = await getActivePortfolio(input.cadence, input.period);
  if (existing) return existing.id;
  const id = newId("sp");
  await query(
    `INSERT INTO strategy_portfolios (id, cadence, period, capital_ngn, model, market_context, risk_note)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      input.cadence,
      input.period,
      input.capital_ngn,
      input.model ?? "",
      input.market_context ?? "",
      input.risk_note ?? "",
    ]
  );
  return id;
}

export async function listPortfolios(): Promise<StrategyPortfolio[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM strategy_portfolios ORDER BY period DESC, cadence ASC`
  );
  return rows.map((r) => ({ ...(r as unknown as StrategyPortfolio), capital_ngn: num(r.capital_ngn) }));
}

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------
export interface StrategyTradeInput {
  symbol: string;
  company_name: string;
  sector: string;
  entry_price: number;
  shares: number;
  amount_ngn: number;
  target_price: number | null;
  stop_loss: number | null;
  signal: string;
  rationale: string;
}

export async function insertTrades(input: {
  portfolioId: string;
  cadence: Cadence;
  period: string;
  openedOn: string; // YYYY-MM-DD
  trades: StrategyTradeInput[];
  // 'open' = executed immediately (full automation); 'pending' = queued for human
  // approval before it becomes a live position.
  status?: "open" | "pending";
}): Promise<number> {
  const status = input.status ?? "open";
  let n = 0;
  for (const t of input.trades) {
    if (!(t.entry_price > 0) || !(t.shares > 0)) continue;
    await query(
      `INSERT INTO strategy_trades
        (id, strategy_portfolio_id, cadence, period, symbol, company_name, sector,
         entry_price, shares, amount_ngn, target_price, stop_loss, signal, rationale, opened_on, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        newId("st"),
        input.portfolioId,
        input.cadence,
        input.period,
        t.symbol.toUpperCase(),
        t.company_name,
        t.sector,
        t.entry_price,
        t.shares,
        t.amount_ngn,
        t.target_price,
        t.stop_loss,
        t.signal,
        t.rationale,
        input.openedOn,
        status,
      ]
    );
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Manual execution — the human-approval queue (when execution_mode = 'manual')
// ---------------------------------------------------------------------------
export async function listPendingTrades(): Promise<StrategyTrade[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM strategy_trades WHERE status = 'pending' ORDER BY opened_at DESC`
  );
  return rows.map(coerceTrade);
}

export async function countPendingTrades(): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::int AS n FROM strategy_trades WHERE status = 'pending'`
  );
  return Number(row?.n ?? 0);
}

// Approve a proposed trade → it becomes a live open position, executed at the
// proposed entry price, stamped with the acting admin and the execution date.
export async function approveTrade(id: string, actor: string, dateStr: string): Promise<StrategyTrade | null> {
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE strategy_trades
        SET status = 'open', opened_at = now(), opened_on = $3, decided_by = $2, decided_at = now()
      WHERE id = $1 AND status = 'pending'
      RETURNING *`,
    [id, actor, dateStr]
  );
  return row ? coerceTrade(row) : null;
}

// Reject a proposed trade → discarded, never executed.
export async function rejectTrade(id: string, actor: string): Promise<StrategyTrade | null> {
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE strategy_trades
        SET status = 'rejected', decided_by = $2, decided_at = now()
      WHERE id = $1 AND status = 'pending'
      RETURNING *`,
    [id, actor]
  );
  return row ? coerceTrade(row) : null;
}

export async function listOpenTrades(cadence?: Cadence): Promise<StrategyTrade[]> {
  const rows = cadence
    ? await query<Record<string, unknown>>(
        `SELECT * FROM strategy_trades WHERE status = 'open' AND cadence = $1 ORDER BY opened_at DESC`,
        [cadence]
      )
    : await query<Record<string, unknown>>(
        `SELECT * FROM strategy_trades WHERE status = 'open' ORDER BY opened_at DESC`
      );
  return rows.map(coerceTrade);
}

export async function listAllTrades(): Promise<StrategyTrade[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM strategy_trades ORDER BY opened_at DESC`
  );
  return rows.map(coerceTrade);
}

// Idempotency guard: has the engine already opened this cadence today?
export async function hasOpenTradesOpenedOn(cadence: Cadence, dateStr: string): Promise<boolean> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::int AS n FROM strategy_trades
      WHERE cadence = $1 AND opened_on = $2`,
    [cadence, dateStr]
  );
  return Number(row?.n ?? 0) > 0;
}

export async function closeTrade(
  id: string,
  closePrice: number,
  reason: string
): Promise<number> {
  // realized_pnl = (close - entry) * shares, computed in SQL against stored numerics.
  const row = await queryOne<{ realized_pnl: string }>(
    `UPDATE strategy_trades
        SET status = 'closed', close_price = $2, closed_at = now(),
            close_reason = $3,
            realized_pnl = ($2 - entry_price) * shares
      WHERE id = $1 AND status = 'open'
      RETURNING realized_pnl`,
    [id, closePrice, reason]
  );
  return row ? Number(row.realized_pnl) : 0;
}

// ---------------------------------------------------------------------------
// Runs (scheduler log + atomic dedup)
// ---------------------------------------------------------------------------
export async function claimRun(
  kind: string,
  runKey: string,
  trigger: "schedule" | "manual" = "schedule"
): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO strategy_runs (id, kind, run_key, trigger)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (kind, run_key) DO NOTHING
     RETURNING id`,
    [newId("sr"), kind, runKey, trigger]
  );
  return row?.id ?? null;
}

export async function finishRun(
  id: string,
  patch: {
    status: StrategyRun["status"];
    trades_opened?: number;
    trades_closed?: number;
    pnl?: number;
    detail?: string;
  }
): Promise<void> {
  await query(
    `UPDATE strategy_runs
        SET status = $2, trades_opened = $3, trades_closed = $4, pnl = $5,
            detail = $6, finished_at = now()
      WHERE id = $1`,
    [
      id,
      patch.status,
      patch.trades_opened ?? 0,
      patch.trades_closed ?? 0,
      patch.pnl ?? 0,
      (patch.detail ?? "").slice(0, 500),
    ]
  );
}

// Wipe the entire engine ledger — trades, monthly profiles, and run history.
// Settings (capital, risk params, enabled flag) are preserved. Admin-only.
export async function resetLedger(): Promise<{ trades: number; portfolios: number; runs: number }> {
  const t = await query<{ id: string }>(`DELETE FROM strategy_trades RETURNING id`);
  const p = await query<{ id: string }>(`DELETE FROM strategy_portfolios RETURNING id`);
  const r = await query<{ id: string }>(`DELETE FROM strategy_runs RETURNING id`);
  return { trades: t.length, portfolios: p.length, runs: r.length };
}

export async function listRuns(limit = 40): Promise<StrategyRun[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM strategy_runs ORDER BY fired_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    ...(r as unknown as StrategyRun),
    trades_opened: Number(r.trades_opened),
    trades_closed: Number(r.trades_closed),
    pnl: Number(r.pnl),
  }));
}
