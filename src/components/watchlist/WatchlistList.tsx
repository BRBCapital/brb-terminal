"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Star, Trash2 } from "lucide-react";
import {
  fetchWatchlists,
  createWatchlistReq,
  deleteWatchlistReq,
} from "@/lib/watchlist/api";
import { formatDate } from "@/lib/format";
import type { Watchlist } from "@/lib/db/watchlists";

export function WatchlistList() {
  const [lists, setLists] = useState<Watchlist[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLists(await fetchWatchlists());
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    await createWatchlistReq(name.trim());
    setName("");
    setBusy(false);
    load();
  }

  return (
    <div className="space-y-3">
      <div className="brb-card flex items-center gap-2 p-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="New watchlist name…"
          className="flex-1 rounded-lg border border-stone px-3 py-1.5 font-sans text-sm outline-none focus:border-fresh"
        />
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-fresh px-4 py-1.5 font-sans text-sm font-semibold text-forest hover:brightness-95 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> Create
        </button>
      </div>

      {lists === null ? (
        <div className="h-16 animate-pulse rounded-xl bg-stone" />
      ) : lists.length === 0 ? (
        <div className="brb-card flex flex-col items-center gap-2 p-10 text-center">
          <Star className="h-8 w-8 text-ink/30" />
          <p className="font-serif text-lg text-forest">No watchlists yet</p>
          <p className="font-sans text-[13px] text-ink/55">
            Create one above, then add tickers to track prices and news.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {lists.map((w) => (
            <li key={w.id} className="brb-card flex items-center justify-between p-4">
              <Link href={`/watchlists/${w.id}`} className="flex-1">
                <p className="font-serif text-lg font-semibold text-forest">{w.name}</p>
                <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/40">
                  Updated {formatDate(w.updated_at)}
                </p>
              </Link>
              <button
                onClick={async () => {
                  if (confirm(`Delete watchlist "${w.name}"?`)) {
                    await deleteWatchlistReq(w.id);
                    load();
                  }
                }}
                className="text-ink/30 hover:text-loss"
                aria-label="Delete watchlist"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
