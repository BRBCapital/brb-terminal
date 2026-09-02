import "server-only";
import { query, queryOne, newId } from "./client";

export interface Watchlist {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  symbol: string;
  created_at: string;
}
export interface WatchlistWithItems extends Watchlist {
  items: WatchlistItem[];
}

async function audit(actor: string, action: string, detail: string) {
  await query(
    `INSERT INTO audit_log (id, actor, action, portfolio_id, detail) VALUES ($1,$2,$3,$4,$5)`,
    [newId("aud"), actor, action, null, detail]
  );
}

export async function listWatchlists(actor: string): Promise<Watchlist[]> {
  return query<Watchlist>(
    `SELECT * FROM watchlists WHERE created_by = $1 ORDER BY updated_at DESC`,
    [actor]
  );
}

export async function getWatchlist(id: string): Promise<WatchlistWithItems | null> {
  const wl = await queryOne<Watchlist>(`SELECT * FROM watchlists WHERE id = $1`, [id]);
  if (!wl) return null;
  const items = await query<WatchlistItem>(
    `SELECT * FROM watchlist_items WHERE watchlist_id = $1 ORDER BY created_at ASC`,
    [id]
  );
  return { ...wl, items };
}

export async function createWatchlist(
  actor: string,
  name: string,
  symbols: string[] = []
): Promise<WatchlistWithItems> {
  const id = newId("wl");
  await query(`INSERT INTO watchlists (id, name, created_by) VALUES ($1,$2,$3)`, [
    id,
    name,
    actor,
  ]);
  for (const s of symbols) await addItemRaw(id, s);
  await audit(actor, "watchlist.create", name);
  return (await getWatchlist(id))!;
}

async function addItemRaw(watchlistId: string, symbol: string) {
  await query(
    `INSERT INTO watchlist_items (id, watchlist_id, symbol)
     VALUES ($1,$2,$3) ON CONFLICT (watchlist_id, symbol) DO NOTHING`,
    [newId("wli"), watchlistId, symbol.toUpperCase()]
  );
}

export async function addItem(actor: string, watchlistId: string, symbol: string) {
  await addItemRaw(watchlistId, symbol);
  await query(`UPDATE watchlists SET updated_at = now() WHERE id = $1`, [watchlistId]);
  await audit(actor, "watchlist.add", `${symbol.toUpperCase()}`);
}

export async function removeItem(watchlistId: string, symbol: string) {
  await query(`DELETE FROM watchlist_items WHERE watchlist_id = $1 AND symbol = $2`, [
    watchlistId,
    symbol.toUpperCase(),
  ]);
  await query(`UPDATE watchlists SET updated_at = now() WHERE id = $1`, [watchlistId]);
}

export async function deleteWatchlist(actor: string, id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM watchlists WHERE id = $1 RETURNING id`,
    [id]
  );
  if (rows.length) await audit(actor, "watchlist.delete", id);
  return rows.length > 0;
}

export function ownsWatchlist(wl: Watchlist, email: string, role: string): boolean {
  return role === "admin" || wl.created_by === email;
}
