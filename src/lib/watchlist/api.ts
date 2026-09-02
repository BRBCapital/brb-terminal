"use client";

import type { Watchlist, WatchlistWithItems } from "@/lib/db/watchlists";
import type { ScreenPreset } from "@/lib/db/presets";

export async function fetchWatchlists(): Promise<Watchlist[]> {
  const res = await fetch("/api/watchlists", { cache: "no-store" });
  const b = await res.json();
  return b.ok ? b.watchlists : [];
}

export async function fetchWatchlist(id: string): Promise<WatchlistWithItems | null> {
  const res = await fetch(`/api/watchlists/${id}`, { cache: "no-store" });
  const b = await res.json();
  return b.ok ? b.watchlist : null;
}

export async function createWatchlistReq(
  name: string,
  symbols: string[] = []
): Promise<{ ok: boolean; watchlist?: WatchlistWithItems; error?: string }> {
  const res = await fetch("/api/watchlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, symbols }),
  });
  return res.json();
}

export async function deleteWatchlistReq(id: string): Promise<boolean> {
  const res = await fetch(`/api/watchlists/${id}`, { method: "DELETE" });
  return (await res.json()).ok;
}

export async function addWatchlistItem(id: string, symbol: string): Promise<WatchlistWithItems | null> {
  const res = await fetch(`/api/watchlists/${id}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol }),
  });
  const b = await res.json();
  return b.ok ? b.watchlist : null;
}

export async function removeWatchlistItem(id: string, symbol: string): Promise<WatchlistWithItems | null> {
  const res = await fetch(`/api/watchlists/${id}/items?symbol=${encodeURIComponent(symbol)}`, {
    method: "DELETE",
  });
  const b = await res.json();
  return b.ok ? b.watchlist : null;
}

// --- presets ---
export async function fetchPresets(): Promise<ScreenPreset[]> {
  const res = await fetch("/api/presets", { cache: "no-store" });
  const b = await res.json();
  return b.ok ? b.presets : [];
}

export async function createPresetReq(
  name: string,
  config: unknown
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, config }),
  });
  return res.json();
}

export async function deletePresetReq(id: string): Promise<boolean> {
  const res = await fetch(`/api/presets/${id}`, { method: "DELETE" });
  return (await res.json()).ok;
}
