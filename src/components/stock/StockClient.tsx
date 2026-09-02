"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { PrintButton, PrintHeader } from "@/components/ui/PrintButton";
import { WatchButton } from "@/components/watchlist/WatchButton";
import { useNgx } from "@/hooks/useNgx";
import { Delta } from "@/components/ui/Delta";
import { TickerBadge } from "@/components/ui/TickerBadge";
import { Freshness } from "@/components/ui/Freshness";
import { formatNaira } from "@/lib/format";
import type { CompanyDetail } from "@/lib/ngx/types";
import { OverviewTab } from "./OverviewTab";
import { PriceChartTab } from "./PriceChartTab";
import { FundamentalsTab } from "./FundamentalsTab";
import { DividendsTab } from "./DividendsTab";
import { NewsTab } from "./NewsTab";
import { PeersTab } from "./PeersTab";

const TABS = [
  "Overview",
  "Price chart",
  "Fundamentals",
  "Dividends",
  "News & disclosures",
  "Peers",
] as const;
type Tab = (typeof TABS)[number];

export function StockClient({ symbol }: { symbol: string }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const query = useNgx<CompanyDetail>(`companies/${symbol}`, {
    refetchInterval: 5 * 60_000,
  });
  const result = query.data;
  const d = result && result.ok ? result.data : null;

  return (
    <div className="space-y-4">
      <PrintHeader title={`${symbol} — research one-pager`} />
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/screener"
          className="inline-flex items-center gap-1 font-sans text-[11px] uppercase tracking-eyebrow text-forest-soft hover:text-forest"
        >
          <ArrowLeft className="h-3 w-3" /> Screener
        </Link>
        <div className="flex gap-2">
          <WatchButton symbol={symbol} />
          <PrintButton />
          <Link
            href={`/forecasting/${symbol}`}
            className="inline-flex items-center gap-1 rounded-lg bg-fresh px-3 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest hover:brightness-95"
          >
            Forecast <TrendingUp className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Company header */}
      <div className="brb-card p-5">
        {!result ? (
          <div className="h-16 animate-pulse rounded bg-stone" />
        ) : !result.ok ? (
          <p className="font-sans text-sm text-loss">
            {result.error.code}: {result.error.message}
          </p>
        ) : d ? (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <TickerBadge symbol={d.symbol} logoUrl={d.logo_url} size={44} />
              <div>
                <h1 className="font-serif text-2xl font-bold text-forest">
                  {d.symbol}
                </h1>
                <p className="font-sans text-sm text-ink/60">{d.name}</p>
                <p className="mt-0.5 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                  {d.sector}
                  {d.sub_sector ? ` · ${d.sub_sector}` : ""} ·{" "}
                  {d.market_classification}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-serif text-3xl font-bold text-forest tabular-nums">
                {formatNaira(d.current_price)}
              </p>
              <Delta value={d.price_change_percent} className="justify-end" />
              <div className="mt-1">
                <Freshness
                  updatedAt={d.last_updated}
                  cached={result.cached}
                  fetchedAt={result.fetchedAt}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-stone print:hidden">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "-mb-px border-b-2 px-3 py-2 font-sans text-[12px] font-semibold uppercase tracking-eyebrow transition-colors",
              tab === t
                ? "border-fresh text-forest"
                : "border-transparent text-ink/45 hover:text-forest"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === "Overview" && <OverviewTab detail={d} loading={!result} />}
        {tab === "Price chart" && <PriceChartTab symbol={symbol} />}
        {tab === "Fundamentals" && <FundamentalsTab symbol={symbol} detail={d} />}
        {tab === "Dividends" && (
          <DividendsTab
            symbol={symbol}
            reportedYield={d?.dividend_yield ?? null}
            ttmDividends={d?.ttm_dividends ?? null}
          />
        )}
        {tab === "News & disclosures" && <NewsTab symbol={symbol} />}
        {tab === "Peers" && (
          <PeersTab symbol={symbol} sector={d?.sector ?? null} />
        )}
      </div>
    </div>
  );
}
