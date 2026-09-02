import "server-only";
import { query, newId } from "./client";
import { ngxFetch } from "@/lib/ngx/client";
import { formatNaira } from "@/lib/format";
import type { CompanyDetail, UpcomingDividends } from "@/lib/ngx/types";
import type { AlertKind } from "./transactions";

export interface Notification {
  id: string;
  user_email: string;
  portfolio_id: string | null;
  alert_id: string | null;
  symbol: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

export async function listNotifications(email: string, limit = 30): Promise<Notification[]> {
  return query<Notification>(
    `SELECT * FROM notifications WHERE user_email = $1 ORDER BY created_at DESC LIMIT $2`,
    [email, limit]
  );
}

export async function unreadCount(email: string): Promise<number> {
  const rows = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM notifications WHERE user_email = $1 AND read_at IS NULL`,
    [email]
  );
  return rows[0]?.n ?? 0;
}

export async function markRead(email: string, id?: string): Promise<void> {
  if (id) {
    await query(`UPDATE notifications SET read_at = now() WHERE id = $1 AND user_email = $2`, [id, email]);
  } else {
    await query(`UPDATE notifications SET read_at = now() WHERE user_email = $1 AND read_at IS NULL`, [email]);
  }
}

interface AlertJoin {
  id: string;
  portfolio_id: string;
  symbol: string;
  kind: AlertKind;
  threshold: number | null;
  owner: string;
}

// Evaluate all active, not-yet-triggered alerts against latest prices and create
// notifications for newly-triggered ones. Each alert fires ONCE (stamped via
// triggered_at) rather than re-notifying every cycle once the user reads it.
// Returns the number of notifications created.
export async function evaluateAlerts(): Promise<number> {
  const alerts = await query<AlertJoin>(
    `SELECT a.id, a.portfolio_id, a.symbol, a.kind, a.threshold, p.created_by AS owner
       FROM alerts a JOIN portfolios p ON p.id = a.portfolio_id
      WHERE a.active = true AND a.triggered_at IS NULL`
  );
  if (!alerts.length) return 0;

  // Latest quote per unique symbol (cached by the proxy layer).
  const symbols = [...new Set(alerts.map((a) => a.symbol))];
  const quotes = new Map<string, { price: number | null; prev: number | null }>();
  for (const sym of symbols) {
    const res = await ngxFetch<CompanyDetail>({ path: `companies/${sym}` });
    quotes.set(sym, res.ok ? { price: res.data.current_price, prev: res.data.prev_close } : { price: null, prev: null });
  }

  // Upcoming ex-dividends (single call).
  const exdiv = new Map<string, { date: string; amount: number }>();
  const divRes = await ngxFetch<UpcomingDividends>({ path: "dividends/upcoming" });
  if (divRes.ok) {
    for (const u of divRes.data.dividends) {
      exdiv.set(u.symbol, { date: u.ex_dividend_date, amount: u.dividend });
    }
  }

  let created = 0;
  for (const a of alerts) {
    const q = quotes.get(a.symbol);
    const trigger = evaluate(a, q, exdiv.get(a.symbol));
    if (!trigger) continue;

    // Claim the alert atomically so overlapping worker runs can't double-fire.
    const claimed = await query<{ id: string }>(
      `UPDATE alerts SET triggered_at = now() WHERE id = $1 AND triggered_at IS NULL RETURNING id`,
      [a.id]
    );
    if (!claimed.length) continue;

    await query(
      `INSERT INTO notifications (id, user_email, portfolio_id, alert_id, symbol, message)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [newId("ntf"), a.owner, a.portfolio_id, a.id, a.symbol, trigger]
    );
    created++;
  }
  return created;
}

function evaluate(
  a: AlertJoin,
  q: { price: number | null; prev: number | null } | undefined,
  ex: { date: string; amount: number } | undefined
): string | null {
  const price = q?.price ?? null;
  const prev = q?.prev ?? null;
  switch (a.kind) {
    case "price_above":
      return price != null && a.threshold != null && price >= a.threshold
        ? `${a.symbol} rose above ${formatNaira(a.threshold)} — now ${formatNaira(price)}`
        : null;
    case "price_below":
      return price != null && a.threshold != null && price <= a.threshold
        ? `${a.symbol} fell below ${formatNaira(a.threshold)} — now ${formatNaira(price)}`
        : null;
    case "pct_move": {
      if (price == null || prev == null || prev <= 0 || a.threshold == null) return null;
      const move = ((price - prev) / prev) * 100;
      return Math.abs(move) >= a.threshold
        ? `${a.symbol} moved ${move.toFixed(2)}% today (≥ ${a.threshold}%)`
        : null;
    }
    case "ex_div":
      return ex ? `${a.symbol} goes ex-dividend on ${ex.date} (${formatNaira(ex.amount)}/sh)` : null;
  }
}
