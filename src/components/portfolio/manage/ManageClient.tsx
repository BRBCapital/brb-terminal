"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import { useManageData } from "./useManageData";
import { HoldingsTab } from "./HoldingsTab";
import { TransactionsTab } from "./TransactionsTab";
import { RebalanceTab } from "./RebalanceTab";
import { PerformanceTab } from "./PerformanceTab";
import { RiskTab } from "./RiskTab";
import { AlertsTab } from "./AlertsTab";
import { AiReviewTab } from "./AiReviewTab";
import { AskFableTab } from "./AskFableTab";
import { Delta } from "@/components/ui/Delta";
import { Freshness } from "@/components/ui/Freshness";
import { ComplianceNote } from "@/components/ui/ComplianceNote";
import { formatNaira, formatNairaCompact } from "@/lib/format";

const TABS = ["Holdings", "Transactions", "Rebalancing", "Performance", "Risk", "AI Review", "Ask Fable", "Alerts"] as const;
type Tab = (typeof TABS)[number];

export function ManageClient({ id }: { id: string }) {
  const data = useManageData(id);
  const [tab, setTab] = useState<Tab>("Holdings");
  const [ccy, setCcy] = useState<"NGN" | "USD">("NGN");

  const { portfolio, totals, usdRate, lastUpdated } = data;

  if (portfolio === undefined) {
    return <div className="h-40 animate-pulse rounded-xl bg-stone" />;
  }
  if (portfolio === null) {
    return (
      <div className="brb-card p-8 text-center">
        <p className="font-serif text-lg text-forest">Portfolio not found</p>
        <Link href="/portfolios" className="mt-2 inline-block text-forest-soft underline">
          Back to portfolios
        </Link>
      </div>
    );
  }

  const conv = (naira: number) => (ccy === "USD" && usdRate ? naira / usdRate : naira);
  const money = (naira: number) =>
    ccy === "USD" && usdRate
      ? `$${conv(naira).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : formatNairaCompact(naira);

  return (
    <div className="space-y-4">
      <Link
        href={`/portfolios/${id}`}
        className="inline-flex items-center gap-1 font-sans text-[11px] uppercase tracking-eyebrow text-forest-soft hover:text-forest"
      >
        <ArrowLeft className="h-3 w-3" /> {portfolio.name}
      </Link>

      {/* Summary header */}
      <div className="brb-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-forest">
              {portfolio.name}
            </h1>
            <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
              Live management · benchmark {portfolio.benchmark_symbol}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex overflow-hidden rounded-lg border border-stone text-sm">
              {(["NGN", "USD"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCcy(c)}
                  disabled={c === "USD" && !usdRate}
                  className={
                    ccy === c
                      ? "bg-forest px-3 py-1 text-[#F5F2EC]"
                      : "bg-surface px-3 py-1 text-ink/50 hover:bg-sand disabled:opacity-40"
                  }
                >
                  {c === "NGN" ? "₦ NGN" : "$ USD"}
                </button>
              ))}
            </div>
            <Freshness updatedAt={lastUpdated} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {/* Hero: market value + day move */}
          <div className="rounded-xl border border-fresh/30 bg-fresh/[0.06] p-4">
            <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
              Market value
            </p>
            <p className="mt-1 font-serif text-3xl font-bold tabular-nums text-forest">
              {money(totals.marketValue)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1 font-sans text-[11px] text-ink/45">
                <span className="uppercase tracking-eyebrow">Day</span>
                <span className="font-semibold text-ink/70">{money(totals.dayChangeValue)}</span>
                <Delta
                  value={
                    totals.marketValue - totals.dayChangeValue > 0
                      ? (totals.dayChangeValue / (totals.marketValue - totals.dayChangeValue)) * 100
                      : null
                  }
                  className="text-[11px]"
                />
              </span>
              <span className="flex items-center gap-1 font-sans text-[11px] text-ink/45">
                <span className="uppercase tracking-eyebrow">Unreal.</span>
                <Delta value={totals.unrealisedPct} className="text-[11px]" />
              </span>
            </div>
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:col-span-2">
            <Summary label="Cost basis" value={money(totals.costBasis)} />
            <Summary
              label="Unrealised P&L"
              value={money(totals.unrealisedPnl)}
              delta={totals.unrealisedPct}
            />
            <Summary
              label="Day change"
              value={money(totals.dayChangeValue)}
              delta={
                totals.marketValue - totals.dayChangeValue > 0
                  ? (totals.dayChangeValue / (totals.marketValue - totals.dayChangeValue)) * 100
                  : null
              }
            />
            <Summary label="Realised P&L" value={money(totals.realisedPnl)} />
            <Summary label="Dividends" value={money(totals.dividends)} />
            <Summary label="Benchmark" value={portfolio.benchmark_symbol} />
          </div>
        </div>
        {ccy === "USD" && usdRate && (
          <p className="mt-2 font-sans text-[10px] uppercase tracking-eyebrow text-ink/40">
            USD overlay at ₦{usdRate.toLocaleString()} / $1 (current rate)
          </p>
        )}
      </div>

      {/* Tabs */}
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
            {t === "Alerts" && data.alerts.length > 0 && (
              <span className="ml-1 rounded-full bg-fresh px-1.5 text-[10px] text-forest">
                {data.alerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div>
        {tab === "Holdings" && <HoldingsTab data={data} ccy={ccy} />}
        {tab === "Transactions" && <TransactionsTab id={id} data={data} />}
        {tab === "Rebalancing" && <RebalanceTab data={data} />}
        {tab === "Performance" && <PerformanceTab data={data} />}
        {tab === "Risk" && <RiskTab data={data} />}
        {tab === "AI Review" && <AiReviewTab id={id} data={data} />}
        {tab === "Ask Fable" && <AskFableTab id={id} data={data} />}
        {tab === "Alerts" && <AlertsTab id={id} data={data} />}
      </div>

      <ComplianceNote>
        Live management view for internal analysis. Values use prices delayed up to
        20 minutes during NGX hours (last close otherwise). Rebalancing output is an
        analytical suggestion requiring PM/IC approval — not an order. Not investment
        advice; past performance does not indicate future results.
      </ComplianceNote>
    </div>
  );
}

function Summary({
  label,
  value,
  delta,
  strong,
}: {
  label: string;
  value: string;
  delta?: number | null;
  strong?: boolean;
}) {
  return (
    <div className="rounded-xl border border-stone bg-surface px-3.5 py-3 shadow-card">
      <p className="font-sans text-[9.5px] font-semibold uppercase tracking-eyebrow text-ink/40">
        {label}
      </p>
      <p
        className={clsx(
          "mt-0.5 font-serif font-semibold tabular-nums text-forest",
          strong ? "text-xl" : "text-base"
        )}
      >
        {value}
      </p>
      {delta !== undefined && (
        <Delta value={delta} className="text-[11px]" showArrow={false} />
      )}
    </div>
  );
}
