// Tiny in-memory TTL cache for upstream NGN Market responses.
//
// Rationale: all API keys share one monthly quota pool, so we must never burn
// quota on redundant calls. Prices refresh every 20 min; static data far less
// often. This is a single-process cache — fine for phase 1 (one Node server).
// Phase 3 swaps this for Redis when portfolios/persistence land.

interface Entry {
  value: unknown;
  expiresAt: number; // epoch ms
  storedAt: number; // epoch ms — when we last hit upstream
}

// Survive Next.js dev hot-reload by hanging state off globalThis.
const globalForCache = globalThis as unknown as {
  __ngxCache?: Map<string, Entry>;
};
const store: Map<string, Entry> =
  globalForCache.__ngxCache ?? (globalForCache.__ngxCache = new Map());

// The NGN Market API is REST-only (no streaming) and republishes equity/ETF
// prices ~every 20 min during NGX hours; outside hours prices are the static
// last-session close. So the cache is MARKET-HOURS-AWARE: short TTLs while the
// exchange is open (catch each ~20-min republish within a few minutes) and long
// TTLs when it's closed (nothing changes — refetching would just waste the
// shared monthly quota). This both improves intraday freshness AND cuts idle
// waste vs a flat 20-min TTL.

// NGX regular session: Mon–Fri 09:00–16:00 WAT (Africa/Lagos, UTC+1, no DST).
export function isNgxOpen(now: Date = new Date()): boolean {
  const wat = new Date(now.getTime() + 60 * 60 * 1000); // shift to WAT wall clock
  const day = wat.getUTCDay(); // 0 Sun … 6 Sat
  if (day === 0 || day === 6) return false;
  const minutes = wat.getUTCHours() * 60 + wat.getUTCMinutes();
  return minutes >= 9 * 60 && minutes < 16 * 60;
}

const MIN = 60;
const HOUR = 60 * 60;

// Live price / market data — the group that benefits from a tighter session TTL.
const PRICE_PREFIXES = [
  "market/snapshot",
  "market/movers",
  "market/top-trades",
  "market/sectors",
  "market/breadth",
  "market/ytd-performers",
  "forex/current",
  "indices",
  "bonds",
  "etfs",
];

export function ttlForPath(path: string, now: Date = new Date()): number {
  const p = path.replace(/^\/+/, "");
  const open = isNgxOpen(now);

  // EOD charts (companies/…/chart, indices/…/chart, etfs/…/chart).
  if (p.endsWith("/chart")) return HOUR;

  // Static / slow reference data — cache hard regardless of session.
  if (p.startsWith("companies/identifiers")) return 24 * HOUR;
  if (p.startsWith("market/holidays")) return 24 * HOUR;
  if (p.startsWith("disclosures/types")) return 12 * HOUR;
  if (p.startsWith("disclosures")) return 6 * HOUR;
  if (p.startsWith("dividends")) return 6 * HOUR;
  if (p.startsWith("blog")) return 6 * HOUR;
  if (p.startsWith("forex/history")) return 6 * HOUR;
  if (p.startsWith("market/available-dates")) return HOUR;
  if (p.startsWith("account/")) return MIN; // quota/log views — keep current

  // Slow company sub-resources (financials, dividends, disclosures, news).
  if (/^companies\/[^/]+\/(financials|dividends|disclosures|news)/.test(p)) return 12 * HOUR;

  // Company detail bundles a live-ish price with slow fundamentals.
  if (/^companies\/[^/]+$/.test(p)) return open ? 5 * MIN : 6 * HOUR;

  // Company list carries per-name prices.
  if (p === "companies") return open ? 10 * MIN : HOUR;

  // Market open/closed status — flips must feel responsive around the bell.
  if (p.startsWith("market/status")) return open ? MIN : 30 * MIN;

  // Live price / market group. Kept as fresh as useful while open: the upstream
  // republishes ~every 20 min, so a 2-min open TTL catches a new print quickly
  // without wasting the shared monthly quota (going lower gains little).
  if (PRICE_PREFIXES.some((pre) => p.startsWith(pre))) return open ? 2 * MIN : HOUR;

  return open ? 5 * MIN : 30 * MIN;
}

export function cacheKey(path: string, query: string): string {
  return query ? `${path}?${query}` : path;
}

export function getCached<T>(key: string): { value: T; storedAt: number } | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return { value: entry.value as T, storedAt: entry.storedAt };
}

export function setCached(key: string, value: unknown, ttlSeconds: number): void {
  const now = Date.now();
  store.set(key, {
    value,
    storedAt: now,
    expiresAt: now + ttlSeconds * 1000,
  });
}

export function clearCache(): void {
  store.clear();
}
