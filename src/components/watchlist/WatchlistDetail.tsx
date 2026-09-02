"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BellPlus, ExternalLink, Trash2 } from "lucide-react";
import { fetchProxy } from "@/lib/ngx/browser";
import {
  fetchWatchlist,
  addWatchlistItem,
  removeWatchlistItem,
} from "@/lib/watchlist/api";
import { CompanySearch } from "@/components/search/CompanySearch";
import { WatchlistAlerts } from "./WatchlistAlerts";
import { Panel } from "@/components/ui/Tile";
import { Delta } from "@/components/ui/Delta";
import { Sparkline } from "@/components/ui/Sparkline";
import { TickerBadge } from "@/components/ui/TickerBadge";
import { formatNaira } from "@/lib/format";
import type { CompanyDetail, CompanyChart, CompanyNews, NewsItem } from "@/lib/ngx/types";
import type { WatchlistWithItems } from "@/lib/db/watchlists";

interface Quote {
  name: string;
  sector: string;
  price: number | null;
  change: number | null;
  spark: number[];
}
type NewsWithSymbol = NewsItem & { symbol: string };

export function WatchlistDetail({ id }: { id: string }) {
  const [wl, setWl] = useState<WatchlistWithItems | null | undefined>(undefined);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [news, setNews] = useState<NewsWithSymbol[]>([]);
  const [alertSymbol, setAlertSymbol] = useState<string | null>(null);

  const load = useCallback(async () => {
    setWl(await fetchWatchlist(id));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  // Enrich each item with a quote + sparkline, and aggregate recent news.
  useEffect(() => {
    if (!wl) return;
    let cancelled = false;
    (async () => {
      const symbols = wl.items.map((i) => i.symbol);
      await Promise.all(
        symbols.map(async (sym) => {
          const [detail, chart] = await Promise.all([
            fetchProxy<CompanyDetail>(`companies/${sym}`),
            fetchProxy<CompanyChart>(`companies/${sym}/chart`),
          ]);
          if (cancelled) return;
          const spark = chart.ok
            ? chart.data.data.slice(-30).map((p) => p.close ?? p.price ?? 0).filter((v) => v > 0)
            : [];
          setQuotes((q) => ({
            ...q,
            [sym]: {
              name: detail.ok ? detail.data.name : sym,
              sector: detail.ok ? detail.data.sector : "",
              price: detail.ok ? detail.data.current_price : null,
              change: detail.ok ? detail.data.price_change_percent : null,
              spark,
            },
          }));
        })
      );
      // News: pull per-symbol, merge and keep the freshest.
      const newsLists = await Promise.all(
        symbols.slice(0, 8).map(async (sym) => {
          const r = await fetchProxy<CompanyNews>(`companies/${sym}/news`);
          return r.ok ? r.data.data.slice(0, 3).map((n) => ({ ...n, symbol: sym })) : [];
        })
      );
      if (cancelled) return;
      const merged = newsLists.flat().sort((a, b) => (a.days_old ?? 99) - (b.days_old ?? 99));
      setNews(merged.slice(0, 12));
    })();
    return () => {
      cancelled = true;
    };
  }, [wl]);

  if (wl === undefined) return <div className="h-40 animate-pulse rounded-xl bg-stone" />;
  if (wl === null) {
    return (
      <div className="brb-card p-8 text-center">
        <p className="font-serif text-lg text-forest">Watchlist not found</p>
        <Link href="/watchlists" className="mt-2 inline-block text-forest-soft underline">
          Back to watchlists
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/watchlists"
        className="inline-flex items-center gap-1 font-sans text-[11px] uppercase tracking-eyebrow text-forest-soft hover:text-forest"
      >
        <ArrowLeft className="h-3 w-3" /> Watchlists
      </Link>

      <div className="brb-card p-5">
        <h1 className="font-serif text-2xl font-bold text-forest">{wl.name}</h1>
        <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
          {wl.items.length} instruments
        </p>
        <div className="mt-3 max-w-md">
          <CompanySearch
            clearOnSelect
            placeholder="Add a ticker to this watchlist…"
            onSelect={async (sym) => {
              const updated = await addWatchlistItem(id, sym);
              if (updated) setWl(updated);
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Instruments" subtitle="Live price · 30-session trend">
            {wl.items.length === 0 ? (
              <p className="py-6 text-center font-sans text-[13px] text-ink/55">
                No instruments yet — add tickers above.
              </p>
            ) : (
              <ul className="divide-y divide-stone">
                {wl.items.map((item) => {
                  const q = quotes[item.symbol];
                  return (
                    <li key={item.symbol} className="flex items-center gap-3 py-2">
                      <Link href={`/stocks/${item.symbol}`} className="flex flex-1 items-center gap-2">
                        <TickerBadge symbol={item.symbol} size={24} />
                        <div className="min-w-0">
                          <p className="font-sans text-[13px] font-semibold text-forest">
                            {item.symbol}
                          </p>
                          <p className="truncate font-sans text-[10px] text-ink/45">
                            {q?.name ?? "…"}
                          </p>
                        </div>
                      </Link>
                      {q && q.spark.length > 1 && <Sparkline values={q.spark} />}
                      <div className="w-24 text-right">
                        <p className="font-sans text-[13px] font-semibold text-ink tabular-nums">
                          {formatNaira(q?.price)}
                        </p>
                        <Delta value={q?.change} className="text-[11px]" showArrow={false} />
                      </div>
                      <button
                        onClick={() => setAlertSymbol(item.symbol)}
                        className="text-ink/30 hover:text-forest"
                        aria-label={`Set price alert for ${item.symbol}`}
                        title="Set price alert"
                      >
                        <BellPlus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async () => {
                          const updated = await removeWatchlistItem(id, item.symbol);
                          if (updated) setWl(updated);
                        }}
                        className="text-ink/30 hover:text-loss"
                        aria-label={`Remove ${item.symbol}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          {wl.items.length > 0 && (
            <WatchlistAlerts
              watchlistId={id}
              symbols={wl.items.map((i) => ({
                symbol: i.symbol,
                name: quotes[i.symbol]?.name ?? i.symbol,
                price: quotes[i.symbol]?.price ?? null,
              }))}
              focusSymbol={alertSymbol}
              onFocusHandled={() => setAlertSymbol(null)}
            />
          )}

          <Panel title="News feed" subtitle="Across your watchlist">
          {news.length === 0 ? (
            <p className="py-6 text-center font-sans text-[12px] text-ink/45">
              {wl.items.length ? "Loading headlines…" : "Add tickers to see news."}
            </p>
          ) : (
            <ul className="divide-y divide-stone">
              {news.map((n, i) => (
                <li key={n.guid ?? i} className="py-2">
                  <a href={n.link} target="_blank" rel="noreferrer" className="group flex items-start gap-2">
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-ink/30 group-hover:text-forest" />
                    <span>
                      <span className="font-sans text-[12px] font-medium text-forest group-hover:underline">
                        {n.title}
                      </span>
                      <span className="mt-0.5 block font-sans text-[9px] uppercase tracking-eyebrow text-ink/40">
                        {n.symbol} · {n.source} · {n.time_ago}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
