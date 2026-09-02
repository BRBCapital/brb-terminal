import "server-only";
import { NextResponse } from "next/server";

// Lightweight in-process fixed-window rate limiter. The platform runs as a
// single Node process (embedded PGlite, in-process workers) fronted by nginx, so
// an in-memory store is sufficient. NOTE: if ever scaled to multiple instances,
// replace the Map with a shared store (Redis / Postgres) so limits are global.

interface Bucket {
  count: number;
  resetAt: number;
}
const store = new Map<string, Bucket>();

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfter: number; // seconds until the window resets
}

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  let b = store.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    store.set(key, b);
  }
  b.count += 1;

  // Opportunistic cleanup so the map can't grow unbounded.
  if (store.size > 10_000) {
    for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
  }

  const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
  if (b.count > limit) return { ok: false, remaining: 0, retryAfter };
  return { ok: true, remaining: limit - b.count, retryAfter };
}

// Best-effort client IP from the proxy chain.
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

// Standard 429 JSON response with a Retry-After header.
export function tooMany(retryAfter: number, message = "Too many requests. Please slow down and try again shortly.") {
  return NextResponse.json(
    { ok: false, error: message },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

// Convenience: enforce a limit and return a 429 response if exceeded, else null.
export function enforce(key: string, limit: number, windowMs: number, message?: string): NextResponse | null {
  const r = rateLimit(key, limit, windowMs);
  return r.ok ? null : tooMany(r.retryAfter, message);
}

// Common windows.
export const MIN = 60_000;
export const HOUR = 60 * MIN;
