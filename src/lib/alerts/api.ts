"use client";

import type { PriceAlert } from "@/lib/db/price-alerts";

export async function fetchPriceAlerts(): Promise<PriceAlert[]> {
  const res = await fetch("/api/price-alerts", { cache: "no-store" });
  const b = await res.json();
  return b.ok ? b.alerts : [];
}

export async function createPriceAlertReq(input: {
  symbol: string;
  company_name?: string;
  watchlist_id?: string | null;
  buy_price?: number | null;
  sell_price?: number | null;
  note?: string;
}): Promise<{ ok: boolean; alert?: PriceAlert; error?: string }> {
  const res = await fetch("/api/price-alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function deletePriceAlertReq(id: string): Promise<boolean> {
  const res = await fetch(`/api/price-alerts/${id}`, { method: "DELETE" });
  return (await res.json()).ok;
}

export async function rearmPriceAlertReq(id: string): Promise<boolean> {
  const res = await fetch(`/api/price-alerts/${id}`, { method: "PATCH" });
  return (await res.json()).ok;
}
