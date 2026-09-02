"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Plus, Check } from "lucide-react";
import {
  fetchWatchlists,
  addWatchlistItem,
  createWatchlistReq,
} from "@/lib/watchlist/api";
import type { Watchlist } from "@/lib/db/watchlists";

// Add the current symbol to one of the analyst's watchlists (or a new one).
export function WatchButton({ symbol }: { symbol: string }) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [added, setAdded] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && lists.length === 0) fetchWatchlists().then(setLists);
  }, [open, lists.length]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function addTo(id: string, name: string) {
    await addWatchlistItem(id, symbol);
    setAdded(name);
    setTimeout(() => setOpen(false), 700);
  }

  async function createAndAdd() {
    const res = await createWatchlistReq("My Watchlist", [symbol]);
    if (res.ok) {
      setAdded("My Watchlist");
      setLists(await fetchWatchlists());
      setTimeout(() => setOpen(false), 700);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg border border-stone px-3 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest hover:bg-sand"
      >
        <Star className="h-3.5 w-3.5" /> Watch
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-lg border border-stone bg-surface shadow-card">
          {added ? (
            <p className="flex items-center gap-2 px-3 py-3 font-sans text-[12px] text-forest">
              <Check className="h-4 w-4 text-fresh" /> Added to {added}
            </p>
          ) : (
            <>
              {lists.length > 0 && (
                <ul className="max-h-56 overflow-auto">
                  {lists.map((w) => (
                    <li key={w.id}>
                      <button
                        onClick={() => addTo(w.id, w.name)}
                        className="w-full px-3 py-2 text-left font-sans text-[13px] text-ink/80 hover:bg-sand"
                      >
                        {w.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={createAndAdd}
                className="flex w-full items-center gap-2 border-t border-stone px-3 py-2 text-left font-sans text-[12px] font-semibold text-forest-soft hover:bg-sand"
              >
                <Plus className="h-3.5 w-3.5" /> New watchlist
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
