"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Layers, LineChart, ListChecks, Radar, Settings2, ShieldCheck, CircleDot, CalendarRange, CalendarClock, ClipboardCheck, Zap, Gauge } from "lucide-react";
import { formatNairaCompact } from "@/lib/format";
import type { OverviewData } from "@/lib/engine/overview";
import type { StrategyRun, StrategySettings } from "@/lib/db/strategy";
import { OverviewTab } from "./OverviewTab";
import { PositionsTab } from "./PositionsTab";
import { ProfilesTab } from "./ProfilesTab";
import { YearlyTab } from "./YearlyTab";
import { ApprovalsTab } from "./ApprovalsTab";
import { RegimeTab } from "./RegimeTab";
import { SignalsTab } from "./SignalsTab";
import { RunsTab } from "./RunsTab";
import { SettingsTab } from "./SettingsTab";
import { signedCompact, pct, toneClass } from "./ui";

type Payload = OverviewData & { settings: StrategySettings; runs: StrategyRun[] };

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "regime", label: "Regime", icon: Gauge },
  { id: "positions", label: "Positions", icon: Layers },
  { id: "approvals", label: "Approvals", icon: ClipboardCheck },
  { id: "profiles", label: "Monthly", icon: CalendarRange },
  { id: "yearly", label: "Yearly", icon: CalendarClock },
  { id: "signals", label: "Signals", icon: Radar },
  { id: "runs", label: "Runs", icon: ListChecks },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;

export function EngineClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/engine/overview", { cache: "no-store" });
      const body = await res.json();
      if (body.ok) {
        setData(body as Payload);
        setError(null);
      } else {
        setError(body.error ?? "Could not load the engine.");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // refresh live mark-to-market
    return () => clearInterval(t);
  }, [load]);

  const enabled = data?.settings.enabled ?? false;
  const auto = data?.settings.execution_mode === "auto";

  return (
    <div className="space-y-4">
      {/* Masthead + governance status + persistent KPI strip */}
      <div className="brb-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-forest to-forest-soft text-fresh shadow-card">
              <LineChart className="h-5 w-5" />
            </span>
            <div>
              <p className="brb-eyebrow">AI-native quant · emerging markets</p>
              <h1 className="font-serif text-2xl font-bold leading-tight text-forest">Alternative Strategies Engine</h1>
              <p className="mt-0.5 font-sans text-[11px] text-ink/50">
                Research-to-execution for frontier markets — AI signals, frontier-calibrated risk, governed simulated execution · NGX
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[12px] font-semibold ${
                  auto ? "bg-amber-400/20 text-amber-700 ring-1 ring-amber-300/40 dark:text-amber-300" : "bg-fresh/15 text-forest ring-1 ring-fresh/25"
                }`}
                title={auto ? "Trades execute automatically without approval" : "Trades require admin approval before execution"}
              >
                {auto ? <Zap className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {auto ? "Full automation" : "Human approval"}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-[12px] font-semibold ${
                enabled ? "bg-fresh/20 text-forest ring-1 ring-fresh/30" : "bg-stone text-ink/55"
              }`}
            >
              <CircleDot className={`h-3.5 w-3.5 ${enabled ? "animate-pulse text-fresh" : "text-ink/40"}`} />
              {enabled ? "Engine active" : "Engine paused"}
            </span>
          </div>
        </div>
        {data && (
          <div className="grid grid-cols-2 divide-x divide-y divide-stone border-t border-stone sm:grid-cols-4 sm:divide-y-0">
            <HeaderMetric label="Net P&L" value={signedCompact(data.totals.total_pnl)} valueClass={toneClass(data.totals.total_pnl)} />
            <HeaderMetric label="Total return" value={pct(data.totals.return_pct)} valueClass={toneClass(data.totals.return_pct)} />
            <HeaderMetric label="Capital deployed" value={formatNairaCompact(data.totals.deployed)} sub={`of ${formatNairaCompact(data.totals.capital)}`} />
            <HeaderMetric label="Win rate" value={data.totals.win_rate == null ? "—" : `${data.totals.win_rate.toFixed(0)}%`} sub={`${data.totals.open_count} open · ${data.totals.closed_count} closed`} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-stone">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 font-sans text-[12px] font-medium uppercase tracking-eyebrow transition-colors ${
                active ? "border-fresh text-forest" : "border-transparent text-ink/45 hover:text-forest"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
              {t.id === "approvals" && data?.pending_count ? (
                <span className="ml-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 py-px font-sans text-[9px] font-bold text-white">
                  {data.pending_count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-3 font-sans text-[12px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {error}
        </p>
      )}

      {loading && !data ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-xl bg-stone/60" />
          <div className="h-56 animate-pulse rounded-xl bg-stone/60" />
        </div>
      ) : data ? (
        <>
          {tab === "overview" && <OverviewTab data={data} />}
          {tab === "regime" && <RegimeTab />}
          {tab === "positions" && <PositionsTab open={data.positions} closed={data.closed} />}
          {tab === "approvals" && <ApprovalsTab onChanged={load} />}
          {tab === "profiles" && <ProfilesTab />}
          {tab === "yearly" && <YearlyTab />}
          {tab === "signals" && <SignalsTab />}
          {tab === "runs" && <RunsTab runs={data.runs} />}
          {tab === "settings" && <SettingsTab settings={data.settings} onChanged={load} />}
        </>
      ) : null}

      {/* Compliance footer */}
      <div className="brb-callout py-2">
        <p className="font-sans text-[11px] leading-relaxed text-ink/55">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-forest-soft" />
          <strong>Simulated / illustrative.</strong> This engine paper-trades only — it places no real orders and holds no
          client assets. AI-selected candidates are risk-sized by transparent rules; signals are computed factors, not a
          prediction. Not investment advice, not a recommendation, and not an offer.{" "}
          {auto
            ? "Full automation is enabled — generated trades execute automatically, without a human approval gate."
            : "Human approval is enabled — every generated trade requires admin sign-off before execution."}{" "}
          Prices are delayed up to 20 minutes during NGX hours; past performance does not indicate future results.
        </p>
      </div>
    </div>
  );
}

function HeaderMetric({
  label,
  value,
  valueClass,
  sub,
}: {
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
}) {
  return (
    <div className="px-5 py-3">
      <p className="font-sans text-[9px] font-semibold uppercase tracking-eyebrow text-ink/40">{label}</p>
      <p className={`mt-1 font-serif text-lg font-semibold tabular-nums text-forest ${valueClass ?? ""}`}>{value}</p>
      {sub && <p className="font-sans text-[10px] text-ink/45">{sub}</p>}
    </div>
  );
}
