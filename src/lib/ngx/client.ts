// Server-side NGN Market API client. Injects the Bearer key (never exposed to
// the browser), normalizes the response envelope + errors, and layers the TTL
// cache in front of the upstream so we don't burn the shared monthly quota.
//
// This module must only ever run on the server. Do not import it into a Client
// Component.

import "server-only";
import { cacheKey, getCached, setCached, ttlForPath } from "./cache";
import { resolveKey } from "@/lib/settings/keys";
import type {
  Envelope,
  NgxErrorCode,
  ProxyResult,
  QuotaMeta,
} from "./types";

export const BASE_URL =
  process.env.NGNMARKET_BASE_URL?.replace(/\/+$/, "") ??
  "https://api.ngnmarket.com/v1";

// Whitelist of upstream path prefixes the proxy is allowed to forward. Prevents
// the catch-all route from being turned into an open proxy.
const ALLOWED_PREFIXES = [
  "market/",
  "companies",
  "dividends/",
  "forex/",
  "indices",
  "bonds",
  "disclosures",
  "blog/",
  "etfs",
  "account/",
];

export function isAllowedPath(path: string): boolean {
  const p = path.replace(/^\/+/, "");
  return ALLOWED_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(prefix)
  );
}

// Map an upstream error code string to our normalized union.
function normalizeCode(code: string | undefined): NgxErrorCode {
  switch (code) {
    case "MISSING_API_KEY":
    case "INVALID_API_KEY":
    case "PLAN_REQUIRED":
    case "IP_NOT_ALLOWED":
    case "RATE_LIMITED":
    case "QUOTA_EXCEEDED":
    case "NOT_FOUND":
    case "SERVER_ERROR":
    case "INVALID_CURRENCY":
      return code;
    default:
      return "UNKNOWN";
  }
}

interface FetchOptions {
  path: string; // e.g. "market/snapshot"
  query?: string; // raw query string without leading "?"
  // Bypass the cache read (still writes). Used for manual refresh.
  skipCache?: boolean;
}

export async function ngxFetch<T>({
  path,
  query = "",
  skipCache = false,
}: FetchOptions): Promise<ProxyResult<T>> {
  const cleanPath = path.replace(/^\/+/, "");

  // Defense-in-depth against upstream path traversal: user-derived segments
  // (e.g. ticker symbols) flow into `path`. Reject dot-segments, encoded
  // slashes/backslashes, and absolute URLs so no caller can redirect the request
  // to a different upstream endpoint (e.g. the admin-only `account/*` routes).
  if (/(^|\/)\.\.(\/|$)/.test(cleanPath) || /%2e|%2f|%5c|\\/i.test(cleanPath) || cleanPath.includes("://")) {
    return {
      ok: false,
      meta: null,
      error: { code: "UNKNOWN", status: 400, message: "Invalid request path." },
    };
  }

  const key = cacheKey(cleanPath, query);

  if (!skipCache) {
    const hit = getCached<T>(key);
    if (hit) {
      return {
        ok: true,
        data: hit.value,
        meta: null, // quota meta is only meaningful on a live call
        cached: true,
        fetchedAt: new Date(hit.storedAt).toISOString(),
      };
    }
  }

  const apiKey = await resolveKey("ngnmarket");
  if (!apiKey || !apiKey.startsWith("ngm_")) {
    return {
      ok: false,
      meta: null,
      error: {
        code: "MISSING_API_KEY",
        status: 401,
        message:
          "No valid NGN Market API key. An admin can add it under Admin → Settings (or set NGNMARKET_API_KEY on the server). It must start with ngm_.",
      },
    };
  }

  const url = `${BASE_URL}/${cleanPath}${query ? `?${query}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      // We manage caching ourselves; never let fetch/Next cache the upstream.
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      meta: null,
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        status: 502,
        message: "Could not reach the NGN Market API. Check your connection.",
      },
    };
  }

  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    return {
      ok: false,
      meta: null,
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        status: 502,
        message: `NGN Market API returned a non-JSON response (HTTP ${res.status}).`,
      },
    };
  }

  if (body.success) {
    const meta = (body.meta ?? null) as QuotaMeta | null;
    setCached(key, body.data, ttlForPath(cleanPath));
    return {
      ok: true,
      data: body.data,
      meta,
      cached: false,
      fetchedAt: new Date().toISOString(),
    };
  }

  const err = body.error ?? { code: "UNKNOWN", message: "Unknown error" };
  return {
    ok: false,
    meta: null,
    error: {
      code: normalizeCode(err.code),
      status: res.status,
      message: err.message ?? "Request failed.",
      required_plan: err.required_plan,
      current_plan: err.current_plan,
    },
  };
}
