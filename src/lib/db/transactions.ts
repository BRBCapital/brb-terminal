import "server-only";
import { query, newId } from "./client";

export type TxKind = "buy" | "sell" | "dividend";

export interface Transaction {
  id: string;
  portfolio_id: string;
  symbol: string;
  kind: TxKind;
  trade_date: string; // YYYY-MM-DD
  units: number;
  price: number;
  fees: number;
  amount: number;
  notes: string;
  created_at: string;
}

export interface TransactionInput {
  symbol: string;
  kind: TxKind;
  trade_date: string;
  units?: number;
  price?: number;
  fees?: number;
  amount?: number;
  notes?: string;
}

async function audit(actor: string, action: string, portfolioId: string, detail: string) {
  await query(
    `INSERT INTO audit_log (id, actor, action, portfolio_id, detail) VALUES ($1,$2,$3,$4,$5)`,
    [newId("aud"), actor, action, portfolioId, detail]
  );
}

export async function listTransactions(portfolioId: string): Promise<Transaction[]> {
  return query<Transaction>(
    `SELECT * FROM transactions WHERE portfolio_id = $1 ORDER BY trade_date DESC, created_at DESC`,
    [portfolioId]
  );
}

export async function addTransaction(
  actor: string,
  portfolioId: string,
  input: TransactionInput
): Promise<Transaction> {
  const id = newId("tx");
  await query(
    `INSERT INTO transactions (id, portfolio_id, symbol, kind, trade_date, units, price, fees, amount, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      portfolioId,
      input.symbol.toUpperCase(),
      input.kind,
      input.trade_date,
      input.units ?? 0,
      input.price ?? 0,
      input.fees ?? 0,
      input.amount ?? 0,
      input.notes ?? "",
    ]
  );
  await audit(
    actor,
    `transaction.${input.kind}`,
    portfolioId,
    `${input.symbol} ${input.units ?? ""}@${input.price ?? input.amount}`
  );
  return (await query<Transaction>(`SELECT * FROM transactions WHERE id = $1`, [id]))[0];
}

// Bulk insert (used by "initialize positions from model").
export async function addTransactions(
  actor: string,
  portfolioId: string,
  inputs: TransactionInput[]
): Promise<number> {
  for (const input of inputs) {
    await query(
      `INSERT INTO transactions (id, portfolio_id, symbol, kind, trade_date, units, price, fees, amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        newId("tx"),
        portfolioId,
        input.symbol.toUpperCase(),
        input.kind,
        input.trade_date,
        input.units ?? 0,
        input.price ?? 0,
        input.fees ?? 0,
        input.amount ?? 0,
        input.notes ?? "",
      ]
    );
  }
  await audit(actor, "transaction.bulk", portfolioId, `${inputs.length} transactions`);
  return inputs.length;
}

// Default notional used to translate a %-weight model into share counts when no
// explicit capital is supplied. The absolute figure is arbitrary for a model
// book (weights, not naira, define it); the analyst can re-seed with a specific
// amount from the Holdings tab.
const DEFAULT_SEED_NOTIONAL_NGN = 10_000_000;

// Seed the live-management ledger with opening buys derived from the model
// holdings — the bridge from a constructed model portfolio to the trade-tracking
// Manage view. Idempotent and race-safe: the one-shot `ledger_seeded_at` stamp is
// claimed with an optimistic UPDATE, so concurrent calls (React strict-mode
// double effects, rapid revisits) and re-opens after the analyst empties the
// ledger never double-book.
export async function seedLedgerFromModel(
  actor: string,
  portfolioId: string,
  opts: { totalNgn?: number } = {}
): Promise<{ seeded: boolean; count: number; reason?: string }> {
  // Claim the seed slot: returns a row only if we were the first (flag was NULL).
  const claim = await query<{ created_at: unknown }>(
    `UPDATE portfolios SET ledger_seeded_at = now()
      WHERE id = $1 AND ledger_seeded_at IS NULL
      RETURNING created_at`,
    [portfolioId]
  );
  if (!claim.length) return { seeded: false, count: 0, reason: "already_seeded" };

  const holdings = await query<{
    symbol: string;
    mode: string;
    weight: number | null;
    units: number | null;
    entry_price: number;
  }>(
    `SELECT symbol, mode, weight, units, entry_price FROM holdings WHERE portfolio_id = $1`,
    [portfolioId]
  );
  if (!holdings.length) return { seeded: false, count: 0, reason: "no_model" };

  // Book the opening trades at the model's creation date (created_at may come
  // back as a Date or an ISO string depending on the driver).
  const ca = claim[0].created_at ? new Date(claim[0].created_at as string) : new Date();
  const seedDate = (isNaN(ca.getTime()) ? new Date() : ca).toISOString().slice(0, 10);
  const isUnits = holdings.some((h) => h.mode === "units");
  const total = opts.totalNgn && opts.totalNgn > 0 ? opts.totalNgn : DEFAULT_SEED_NOTIONAL_NGN;

  const seeds: TransactionInput[] = holdings
    .map((h) => {
      const units = isUnits
        ? h.units ?? 0
        : h.entry_price > 0
          ? (((h.weight ?? 0) / 100) * total) / h.entry_price
          : 0;
      return {
        symbol: h.symbol,
        kind: "buy" as const,
        trade_date: seedDate,
        units,
        price: h.entry_price,
        notes: "Opening position from model",
      };
    })
    .filter((s) => (s.units ?? 0) > 0 && (s.price ?? 0) > 0);

  if (!seeds.length) return { seeded: false, count: 0, reason: "no_priced_holdings" };
  const count = await addTransactions(actor, portfolioId, seeds);
  return { seeded: true, count };
}

export async function deleteTransaction(
  actor: string,
  portfolioId: string,
  id: string
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM transactions WHERE id = $1 AND portfolio_id = $2 RETURNING id`,
    [id, portfolioId]
  );
  if (rows.length) await audit(actor, "transaction.delete", portfolioId, id);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export type AlertKind = "price_above" | "price_below" | "pct_move" | "ex_div";

export interface Alert {
  id: string;
  portfolio_id: string;
  symbol: string;
  kind: AlertKind;
  threshold: number | null;
  active: boolean;
  note: string;
  created_at: string;
  triggered_at?: string | null;
}

export interface AlertInput {
  symbol: string;
  kind: AlertKind;
  threshold?: number | null;
  note?: string;
}

export async function listAlerts(portfolioId: string): Promise<Alert[]> {
  return query<Alert>(
    `SELECT * FROM alerts WHERE portfolio_id = $1 ORDER BY created_at DESC`,
    [portfolioId]
  );
}

export async function addAlert(
  actor: string,
  portfolioId: string,
  input: AlertInput
): Promise<Alert> {
  const id = newId("alert");
  await query(
    `INSERT INTO alerts (id, portfolio_id, symbol, kind, threshold, note)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, portfolioId, input.symbol.toUpperCase(), input.kind, input.threshold ?? null, input.note ?? ""]
  );
  await audit(actor, "alert.create", portfolioId, `${input.symbol} ${input.kind} ${input.threshold ?? ""}`);
  return (await query<Alert>(`SELECT * FROM alerts WHERE id = $1`, [id]))[0];
}

export async function deleteAlert(
  actor: string,
  portfolioId: string,
  id: string
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM alerts WHERE id = $1 AND portfolio_id = $2 RETURNING id`,
    [id, portfolioId]
  );
  if (rows.length) await audit(actor, "alert.delete", portfolioId, id);
  return rows.length > 0;
}
