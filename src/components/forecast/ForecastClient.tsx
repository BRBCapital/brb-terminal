"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import { useNgx } from "@/hooks/useNgx";
import { Delta } from "@/components/ui/Delta";
import { TickerBadge } from "@/components/ui/TickerBadge";
import { formatNaira } from "@/lib/format";
import { AiForecastTab } from "./AiForecastTab";
import { FundamentalScenarioTab } from "./FundamentalScenarioTab";
import { DividendForecastTab } from "./DividendForecastTab";
import { MacroContextTab } from "./MacroContextTab";
import { SignalTab } from "./SignalTab";
import type { CompanyDetail } from "@/lib/ngx/types";

const TABS = [
  "AI Price Forecast",
  "Buy/Sell Signal",
  "Fundamental Scenario",
  "Dividend Forecast",
  "Macro Context",
] as const;
type Tab = (typeof TABS)[number];

export function ForecastClient({ symbol }: { symbol: string }) {
  const [tab, setTab] = useState<Tab>("AI Price Forecast");
  const query = useNgx<CompanyDetail>(`companies/${symbol}`, {
    refetchInterval: 3 * 60_000,
  });
  const d = query.data?.ok ? query.data.data : null;

  return (
    <div className="space-y-4">
      <Link
        href={`/stocks/${symbol}`}
        className="inline-flex items-center gap-1 font-sans text-[11px] uppercase tracking-eyebrow text-forest-soft hover:text-forest"
      >
        <ArrowLeft className="h-3 w-3" /> {symbol} research
      </Link>

      <div className="brb-card p-5">
        {d ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <TickerBadge symbol={d.symbol} logoUrl={d.logo_url} size={40} />
              <div>
                <h1 className="font-serif text-2xl font-bold text-forest">{d.symbol}</h1>
                <p className="font-sans text-sm text-ink/60">{d.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-serif text-2xl font-bold text-forest tabular-nums">
                {formatNaira(d.current_price)}
              </p>
              <Delta value={d.price_change_percent} className="justify-end" />
            </div>
          </div>
        ) : (
          <div className="h-14 animate-pulse rounded bg-stone" />
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-stone">
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

      <div>
        {tab === "AI Price Forecast" && <AiForecastTab symbol={symbol} />}
        {tab === "Buy/Sell Signal" && <SignalTab symbol={symbol} />}
        {tab === "Fundamental Scenario" && <FundamentalScenarioTab detail={d} />}
        {tab === "Dividend Forecast" && (
          <DividendForecastTab symbol={symbol} currentPrice={d?.current_price ?? null} />
        )}
        {tab === "Macro Context" && <MacroContextTab detail={d} />}
      </div>
    </div>
  );
}
