import "server-only";
import { query, newId } from "./client";
import { ngxFetch } from "@/lib/ngx/client";
import { formatNaira } from "@/lib/format";
import type { CompanyDetail } from "@/lib/ngx/types";

export interface PriceAlert {
  id: string;
  created_by: string;
  watchlist_id: string | null;
  symbol: string;
  company_name: string;
  buy_price: number | null;
  sell_price: number | null;
  buy_triggered_at: string | null;
  sell_triggered_at: string | null;
  active: boolean;
  note: string;
  created_at: string;
}

export interface PriceAlertInput {
  created_by: string;
  watchlist_id?: string | null;
  symbol: string;
  company_name?: string;
  buy_price?: number | null;
  sell_price?: number | null;
  note?: string;
}

// PGlite returns NUMERIC columns as strings — coerce to honest numbers.
function coerce(row: PriceAlert): PriceAlert {
  row.buy_price = row.buy_price == null ? null : Number(row.buy_price);
  row.sell_price = row.sell_price == null ? null : Number(row.sell_price);
  return row;
}

export async function listPriceAlerts(actor: string): Promise<PriceAlert[]> {
  const rows = await query<PriceAlert>(
    `SELECT * FROM price_alerts WHERE created_by = $1 ORDER BY active DESC, created_at DESC`,
    [actor]
  );
  return rows.map(coerce);
}

export async function createPriceAlert(input: PriceAlertInput): Promise<PriceAlert> {
  const buy = input.buy_price != null && input.buy_price > 0 ? input.buy_price : null;
  const sell = input.sell_price != null && input.sell_price > 0 ? input.sell_price : null;
  const rows = await query<PriceAlert>(
    `INSERT INTO price_alerts
       (id, created_by, watchlist_id, symbol, company_name, buy_price, sell_price, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      newId("pal"),
      input.created_by,
      input.watchlist_id ?? null,
      input.symbol.toUpperCase(),
      input.company_name ?? "",
      buy,
      sell,
      input.note ?? "",
    ]
  );
  return coerce(rows[0]);
}

export async function deletePriceAlert(id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM price_alerts WHERE id = $1 AND created_by = $2 RETURNING id`,
    [id, actor]
  );
  return rows.length > 0;
}

// Re-arm a fired side (clears the *_triggered_at stamps) so it can notify again.
export async function rearmPriceAlert(id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE price_alerts SET buy_triggered_at = NULL, sell_triggered_at = NULL, active = true
     WHERE id = $1 AND created_by = $2 RETURNING id`,
    [id, actor]
  );
  return rows.length > 0;
}

interface PendingAlert {
  id: string;
  created_by: string;
  symbol: string;
  buy_price: number | null;
  sell_price: number | null;
  buy_triggered_at: string | null;
  sell_triggered_at: string | null;
}

// Evaluate active price alerts against latest quotes and create notifications
// for newly-reached levels. Each side (buy / sell) fires once, then is stamped
// so it won't re-fire until the alert is re-armed. Returns notifications created.
export async function evaluatePriceAlerts(): Promise<number> {
  const alerts = await query<PendingAlert>(
    `SELECT id, created_by, symbol, buy_price, sell_price, buy_triggered_at, sell_triggered_at
       FROM price_alerts
      WHERE active = true
        AND ( (buy_price  IS NOT NULL AND buy_triggered_at  IS NULL)
           OR (sell_price IS NOT NULL AND sell_triggered_at IS NULL) )`
  );
  if (!alerts.length) return 0;

  // One quote per unique symbol (served from the proxy cache).
  const symbols = [...new Set(alerts.map((a) => a.symbol))];
  const prices = new Map<string, number | null>();
  for (const sym of symbols) {
    const res = await ngxFetch<CompanyDetail>({ path: `companies/${sym}` });
    prices.set(sym, res.ok ? res.data.current_price : null);
  }

  let created = 0;
  for (const a of alerts) {
    const price = Number(prices.get(a.symbol) ?? NaN);
    if (!Number.isFinite(price)) continue;
    const buy = a.buy_price == null ? null : Number(a.buy_price);
    const sell = a.sell_price == null ? null : Number(a.sell_price);

    if (buy != null && !a.buy_triggered_at && price <= buy) {
      // Claim atomically so overlapping worker runs can't double-notify.
      const claimed = await query<{ id: string }>(
        `UPDATE price_alerts SET buy_triggered_at = now() WHERE id = $1 AND buy_triggered_at IS NULL RETURNING id`,
        [a.id]
      );
      if (claimed.length) {
        await insertNotification(
          a.created_by,
          a.id,
          a.symbol,
          `BUY level reached — ${a.symbol} at ${formatNaira(price)} (≤ your ${formatNaira(buy)} buy target)`
        );
        created++;
      }
    }
    if (sell != null && !a.sell_triggered_at && price >= sell) {
      const claimed = await query<{ id: string }>(
        `UPDATE price_alerts SET sell_triggered_at = now() WHERE id = $1 AND sell_triggered_at IS NULL RETURNING id`,
        [a.id]
      );
      if (claimed.length) {
        await insertNotification(
          a.created_by,
          a.id,
          a.symbol,
          `SELL level reached — ${a.symbol} at ${formatNaira(price)} (≥ your ${formatNaira(sell)} sell target)`
        );
        created++;
      }
    }
  }
  return created;
}

async function insertNotification(
  owner: string,
  alertId: string,
  symbol: string,
  message: string
): Promise<void> {
  await query(
    `INSERT INTO notifications (id, user_email, portfolio_id, alert_id, symbol, message)
     VALUES ($1,$2,NULL,$3,$4,$5)`,
    [newId("ntf"), owner, alertId, symbol, message]
  );
}
