// Browser-side helpers for talking to our proxy route. This file is safe to
// import into Client Components — it never touches the API key.

import type { ProxyResult } from "./types";

export function buildProxyUrl(
  path: string,
  query?: Record<string, string | number | undefined>
): string {
  const clean = path.replace(/^\/+/, "");
  const sp = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") sp.set(k, String(v));
    }
  }
  const qs = sp.toString();
  return `/api/ngx/${clean}${qs ? `?${qs}` : ""}`;
}

// Always resolves to a ProxyResult — API-level errors (PLAN_REQUIRED, quota,
// etc.) come back as { ok: false } bodies so each tile can degrade on its own.
// Only a hard failure reaching our own route rejects.
export async function fetchProxy<T>(
  path: string,
  query?: Record<string, string | number | undefined>
): Promise<ProxyResult<T>> {
  const res = await fetch(buildProxyUrl(path, query), {
    headers: { Accept: "application/json" },
  });
  const body = (await res.json()) as ProxyResult<T>;
  return body;
}
