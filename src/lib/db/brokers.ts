import "server-only";
import { query, queryOne, newId } from "./client";
import { hashPassword, verifyPassword, newToken, hashApiKey } from "@/lib/auth/password";
import { encryptSecret, decryptSecret } from "./crypto";
import { isValidEmail, MIN_PASSWORD_LEN } from "./users";

// Broker execution partners. A THIRD identity system, separate from internal
// `users` and prospect `strategy_members`. Admin-created; brokers log into their
// own portal and integrate the engine over an API key.

export type BrokerMode = "sandbox" | "live";

export interface Broker {
  id: string;
  firm_name: string;
  contact_name: string;
  email: string;
  status: "active" | "suspended";
  aum_ngn: number;
  mode: BrokerMode;
  created_by: string;
  created_at: string;
  last_login_at: string | null;
}

// Includes the API keys — only returned to the broker themselves or an admin.
export interface BrokerWithKeys extends Broker {
  sandbox_key: string;
  live_key: string;
}

interface BrokerRow extends Broker {
  password_hash: string;
  password_salt: string;
  sandbox_key_enc: string | null;
  live_key_enc: string | null;
}

const num = (v: unknown) => Number(v);
const numN = (v: unknown) => (v == null ? null : Number(v));
const isoN = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

function coerce(r: Record<string, unknown>): BrokerRow {
  return {
    id: String(r.id),
    firm_name: String(r.firm_name),
    contact_name: String(r.contact_name ?? ""),
    email: String(r.email),
    status: (r.status as Broker["status"]) ?? "active",
    aum_ngn: num(r.aum_ngn),
    mode: (r.mode as BrokerMode) ?? "sandbox",
    sandbox_key_enc: r.sandbox_key_enc == null ? null : String(r.sandbox_key_enc),
    live_key_enc: r.live_key_enc == null ? null : String(r.live_key_enc),
    created_by: String(r.created_by ?? ""),
    created_at: isoN(r.created_at) ?? "",
    last_login_at: isoN(r.last_login_at),
    password_hash: String(r.password_hash),
    password_salt: String(r.password_salt),
  };
}

const pub = (b: BrokerRow): Broker => ({
  id: b.id, firm_name: b.firm_name, contact_name: b.contact_name, email: b.email,
  status: b.status, aum_ngn: b.aum_ngn, mode: b.mode, created_by: b.created_by,
  created_at: b.created_at, last_login_at: b.last_login_at,
});
// Decrypts the stored ciphertext so the owner (or admin) can re-reveal the key.
const withKeys = (b: BrokerRow): BrokerWithKeys => ({
  ...pub(b),
  sandbox_key: b.sandbox_key_enc ? decryptSecret(b.sandbox_key_enc) : "",
  live_key: b.live_key_enc ? decryptSecret(b.live_key_enc) : "",
});

const genKey = (mode: BrokerMode) => `sk_${mode === "live" ? "live" : "sandbox"}_${newToken().slice(0, 40)}`;

// ---- accounts ------------------------------------------------------------

export async function getBrokerRowByEmail(email: string): Promise<BrokerRow | null> {
  const r = await queryOne<Record<string, unknown>>(`SELECT * FROM broker_accounts WHERE lower(email) = lower($1)`, [email]);
  return r ? coerce(r) : null;
}
export async function getBrokerById(id: string): Promise<Broker | null> {
  const r = await queryOne<Record<string, unknown>>(`SELECT * FROM broker_accounts WHERE id = $1`, [id]);
  return r ? pub(coerce(r)) : null;
}
export async function getBrokerWithKeys(id: string): Promise<BrokerWithKeys | null> {
  const r = await queryOne<Record<string, unknown>>(`SELECT * FROM broker_accounts WHERE id = $1`, [id]);
  return r ? withKeys(coerce(r)) : null;
}
export async function listBrokers(): Promise<Broker[]> {
  const rows = await query<Record<string, unknown>>(`SELECT * FROM broker_accounts ORDER BY created_at DESC`);
  return rows.map((r) => pub(coerce(r)));
}
export async function countActiveBrokers(): Promise<number> {
  const r = await queryOne<{ n: string }>(`SELECT count(*)::int AS n FROM broker_accounts WHERE status = 'active'`);
  return Number(r?.n ?? 0);
}

type CreateResult = { ok: true; broker: BrokerWithKeys } | { ok: false; error: string };

export async function createBroker(input: {
  firm_name: string; contact_name: string; email: string; password: string; aum_ngn?: number; createdBy: string;
}): Promise<CreateResult> {
  const firm = (input.firm_name ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const password = input.password ?? "";
  if (firm.length < 2) return { ok: false, error: "Enter the broker firm name." };
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid contact email." };
  if (password.length < MIN_PASSWORD_LEN) return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` };
  if (await getBrokerRowByEmail(email)) return { ok: false, error: "A broker with that email already exists." };

  const id = newId("brk");
  const { hash, salt } = hashPassword(password);
  const sk = genKey("sandbox");
  const lk = genKey("live");
  await query(
    `INSERT INTO broker_accounts
      (id, firm_name, contact_name, email, password_hash, password_salt, aum_ngn,
       sandbox_key_hash, live_key_hash, sandbox_key_enc, live_key_enc, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id, firm, (input.contact_name ?? "").trim(), email, hash, salt, Math.max(0, input.aum_ngn ?? 0),
      hashApiKey(sk), hashApiKey(lk), encryptSecret(sk), encryptSecret(lk), input.createdBy,
    ]
  );
  return { ok: true, broker: (await getBrokerWithKeys(id))! };
}

export async function authenticateBroker(email: string, password: string): Promise<Broker | null> {
  const row = await getBrokerRowByEmail(email);
  if (!row) {
    verifyPassword(password, "a".repeat(128), "0".repeat(32));
    return null;
  }
  if (row.status !== "active") return null;
  if (!verifyPassword(password, row.password_hash, row.password_salt)) return null;
  return pub(row);
}

export async function updateBrokerAum(id: string, aum: number): Promise<void> {
  await query(`UPDATE broker_accounts SET aum_ngn = $2 WHERE id = $1`, [id, Math.max(0, aum)]);
}
export async function setBrokerMode(id: string, mode: BrokerMode): Promise<void> {
  await query(`UPDATE broker_accounts SET mode = $2 WHERE id = $1`, [id, mode === "live" ? "live" : "sandbox"]);
}
export async function setBrokerStatus(id: string, status: "active" | "suspended"): Promise<void> {
  await query(`UPDATE broker_accounts SET status = $2 WHERE id = $1`, [id, status]);
  if (status === "suspended") await query(`DELETE FROM broker_sessions WHERE broker_id = $1`, [id]);
}
export async function rotateBrokerKey(id: string, which: BrokerMode): Promise<string> {
  const key = genKey(which);
  const hcol = which === "live" ? "live_key_hash" : "sandbox_key_hash";
  const ecol = which === "live" ? "live_key_enc" : "sandbox_key_enc";
  await query(`UPDATE broker_accounts SET ${hcol} = $2, ${ecol} = $3 WHERE id = $1`, [id, hashApiKey(key), encryptSecret(key)]);
  return key;
}

// Reset a broker's login password (admin) and revoke their active sessions.
export async function resetBrokerPassword(id: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if ((newPassword?.length ?? 0) < MIN_PASSWORD_LEN) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` };
  }
  const { hash, salt } = hashPassword(newPassword);
  await query(`UPDATE broker_accounts SET password_hash = $2, password_salt = $3 WHERE id = $1`, [id, hash, salt]);
  await query(`DELETE FROM broker_sessions WHERE broker_id = $1`, [id]);
  return { ok: true };
}

// Resolve an API key to its broker + the mode that key represents. Lookup is by
// the key's SHA-256 hash — the plaintext key is never stored for auth.
export async function getBrokerByApiKey(key: string): Promise<{ broker: Broker; keyMode: BrokerMode } | null> {
  if (!key) return null;
  const h = hashApiKey(key);
  const r = await queryOne<Record<string, unknown>>(
    `SELECT * FROM broker_accounts WHERE (sandbox_key_hash = $1 OR live_key_hash = $1) AND status = 'active'`,
    [h]
  );
  if (!r) return null;
  const keyMode: BrokerMode = String(r.live_key_hash ?? "") === h ? "live" : "sandbox";
  return { broker: pub(coerce(r)), keyMode };
}

// ---- sessions ------------------------------------------------------------
const SESSION_DAYS = 14;
export async function createBrokerSession(brokerId: string): Promise<string> {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await query(`INSERT INTO broker_sessions (token, broker_id, expires_at) VALUES ($1,$2,$3)`, [hashApiKey(token), brokerId, expires]);
  await query(`UPDATE broker_accounts SET last_login_at = now() WHERE id = $1`, [brokerId]);
  return token;
}
export async function getBrokerBySession(token: string): Promise<Broker | null> {
  const r = await queryOne<Record<string, unknown>>(
    `SELECT b.* FROM broker_sessions s JOIN broker_accounts b ON b.id = s.broker_id
      WHERE s.token = $1 AND s.expires_at > now() AND b.status = 'active'`,
    [hashApiKey(token)]
  );
  return r ? pub(coerce(r)) : null;
}
export async function deleteBrokerSession(token: string): Promise<void> {
  await query(`DELETE FROM broker_sessions WHERE token = $1`, [hashApiKey(token)]);
}

// ---- transactions --------------------------------------------------------

export interface BrokerTransaction {
  id: string;
  broker_id: string;
  mode: BrokerMode;
  source_trade_id: string;
  cadence: string;
  symbol: string;
  company_name: string;
  side: string;
  entry_price: number;
  shares: number;
  amount_ngn: number;
  weight_pct: number;
  signal: string;
  status: "open" | "closed";
  broker_status: string;
  created_at: string;
  close_price: number | null;
  closed_at: string | null;
  realized_pnl: number | null;
}

function coerceTxn(r: Record<string, unknown>): BrokerTransaction {
  return {
    ...(r as unknown as BrokerTransaction),
    entry_price: num(r.entry_price), shares: num(r.shares), amount_ngn: num(r.amount_ngn),
    weight_pct: num(r.weight_pct), close_price: numN(r.close_price), realized_pnl: numN(r.realized_pnl),
    created_at: isoN(r.created_at) ?? "", closed_at: isoN(r.closed_at),
  };
}

export async function listBrokerTransactions(brokerId: string, mode: BrokerMode): Promise<BrokerTransaction[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM broker_transactions WHERE broker_id = $1 AND mode = $2 ORDER BY created_at DESC`,
    [brokerId, mode]
  );
  return rows.map(coerceTxn);
}

// Idempotent upsert of one allocated transaction (keyed by broker+source+mode).
export async function upsertBrokerTransaction(t: {
  brokerId: string; mode: BrokerMode; sourceTradeId: string; cadence: string; symbol: string; company_name: string;
  entry_price: number; shares: number; amount_ngn: number; weight_pct: number; signal: string;
  status: "open" | "closed"; close_price: number | null; realized_pnl: number | null; closed_at: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO broker_transactions
      (id, broker_id, mode, source_trade_id, cadence, symbol, company_name, entry_price, shares, amount_ngn,
       weight_pct, signal, status, close_price, realized_pnl, closed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (broker_id, source_trade_id, mode) DO UPDATE SET
       status = EXCLUDED.status, close_price = EXCLUDED.close_price,
       realized_pnl = EXCLUDED.realized_pnl, closed_at = EXCLUDED.closed_at`,
    [
      newId("btx"), t.brokerId, t.mode, t.sourceTradeId, t.cadence, t.symbol, t.company_name,
      t.entry_price, t.shares, t.amount_ngn, t.weight_pct, t.signal, t.status,
      t.close_price, t.realized_pnl, t.closed_at,
    ]
  );
}

export async function markBrokerTransaction(brokerId: string, id: string, status: string): Promise<BrokerTransaction | null> {
  const r = await queryOne<Record<string, unknown>>(
    `UPDATE broker_transactions SET broker_status = $3 WHERE id = $1 AND broker_id = $2 RETURNING *`,
    [id, brokerId, status]
  );
  return r ? coerceTxn(r) : null;
}

// Record a broker's execution report against the allocated order it references
// (clientOrderId == source model trade id), scoped to the calling key's mode.
export async function recordExecutionReport(
  brokerId: string,
  sourceTradeId: string,
  mode: BrokerMode,
  brokerStatus: string
): Promise<BrokerTransaction | null> {
  const r = await queryOne<Record<string, unknown>>(
    `UPDATE broker_transactions SET broker_status = $4
      WHERE broker_id = $1 AND source_trade_id = $2 AND mode = $3 RETURNING *`,
    [brokerId, sourceTradeId, mode, brokerStatus]
  );
  return r ? coerceTxn(r) : null;
}
