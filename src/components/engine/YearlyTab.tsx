"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, CalendarRange } from "lucide-react";
import type { OverviewData } from "@/lib/engine/overview";
import { Panel } from "@/components/ui/Tile";
import { MonthlyPnlChart, EquityCurveChart } from "./charts";
import { Stat, HeroStat, DeltaChip, CadenceTag, toneClass, signedCompact, pct } from "./ui";
import { formatMonth } from "./ProfilesTab";

interface YearDetail {
  period: string; // YYYY
  overview: OverviewData;
}

export function YearlyTab() {
  const [years, setYears] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<YearDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const body = await (await fetch("/api/engine/profiles", { cache: "no-store" })).json();
      const ys: string[] = body.ok ? body.years ?? [] : [];
      setYears(ys);
      if (ys.length) setSelected(ys[0]);
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const body = await (await fetch(`/api/engine/profiles/${selected}`, { cache: "no-store" })).json();
      if (cancelled) return;
      setDetail(body.ok ? body : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (years === null) return <div className="h-40 animate-pulse rounded-xl bg-stone/60" />;
  if (!years.length) {
    return (
      <Panel title="Yearly performance" subtitle="Annual roll-up of the engine's simulated book">
        <div className="flex min-h-32 items-center justify-center px-4 py-8 text-center">
          <p className="max-w-sm font-sans text-[12px] leading-relaxed text-ink/50">
            No trading history yet. As the engine trades through the year, its annual performance and a
            downloadable AI report appear here.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {/* Year selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-ink/45">
          <CalendarRange className="h-3.5 w-3.5" /> Year
        </span>
        <select
          value={selected ?? ""}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-lg border border-stone bg-surface px-3 py-1.5 font-sans text-[13px] font-medium text-forest outline-none focus:border-fresh"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading || !detail ? <div className="h-64 animate-pulse rounded-xl bg-stone/60" /> : <YearDetailView detail={detail} />}
    </div>
  );
}

function YearDetailView({ detail }: { detail: YearDetail }) {
  const t = detail.overview.totals;
  const months = detail.overview.monthly_pnl;
  const best = months.length ? months.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  const worst = months.length ? months.reduce((a, b) => (b.total < a.total ? b : a)) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="brb-eyebrow">Annual performance</p>
          <h3 className="font-serif text-xl font-bold text-forest">{detail.period}</h3>
        </div>
        <Link
          href={`/engine/report/${detail.period}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-fresh px-3.5 py-2 font-sans text-[12px] font-semibold text-forest hover:brightness-95"
        >
          <FileText className="h-3.5 w-3.5" /> Generate PDF report
        </Link>
      </div>

      {/* KPI band */}
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <HeroStat
            label={`Net P&L · ${detail.period}`}
            value={signedCompact(t.total_pnl)}
            valueClass={t.total_pnl >= 0 ? "text-fresh" : "text-[#ff9e92]"}
            delta={<DeltaChip pct={t.return_pct} />}
            sub={`Realised ${signedCompact(t.realized)}  ·  Unrealised ${signedCompact(t.unrealized)}`}
          />
        </div>
        <Stat label="Win rate" value={t.win_rate == null ? "—" : `${t.win_rate.toFixed(0)}%`} sub={`${t.closed_count} closed`} />
        <Stat
          label="Best / worst month"
          value={best ? formatMonth(best.month).split(" ")[0] : "—"}
          sub={best && worst ? `${signedCompact(best.total)} · ${signedCompact(worst.total)}` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Monthly P&L" subtitle="Realised, by cadence">
          <MonthlyPnlChart data={months} />
        </Panel>
        <Panel title="Equity curve" subtitle="Cumulative realised P&L">
          <EquityCurveChart data={detail.overview.equity_curve} />
        </Panel>
      </div>

      {/* Per-month table */}
      <Panel title="By month" subtitle="Realised P&L per month, split by cadence">
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-stone text-left font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                <th className="px-4 py-2">Month</th>
                <th className="px-4 py-2 text-right">Intraday</th>
                <th className="px-4 py-2 text-right">Weekly</th>
                <th className="px-4 py-2 text-right">Monthly</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {months.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center font-sans text-[12px] text-ink/45">
                    No closed trades yet this year.
                  </td>
                </tr>
              )}
              {months.map((m) => (
                <tr key={m.month} className="border-b border-stone/60">
                  <td className="px-4 py-2.5 font-sans text-forest">{formatMonth(m.month)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${toneClass(m.intraday)}`}>{signedCompact(m.intraday)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${toneClass(m.weekly)}`}>{signedCompact(m.weekly)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${toneClass(m.monthly)}`}>{signedCompact(m.monthly)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${toneClass(m.total)}`}>{signedCompact(m.total)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/engine/report/${m.month}`} className="font-sans text-[11px] text-forest-soft hover:underline">
                      Report →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Per-cadence for the year */}
      <Panel title="By cadence · full year" subtitle="Contribution per strategy across the year">
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-stone text-left font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                <th className="px-4 py-2">Cadence</th>
                <th className="px-4 py-2 text-right">Trades</th>
                <th className="px-4 py-2 text-right">Win rate</th>
                <th className="px-4 py-2 text-right">Avg return</th>
                <th className="px-4 py-2 text-right">Realised</th>
                <th className="px-4 py-2 text-right">Unrealised</th>
              </tr>
            </thead>
            <tbody>
              {detail.overview.per_cadence
                .filter((c) => c.open_count + c.closed_count > 0)
                .map((c) => (
                  <tr key={c.cadence} className="border-b border-stone/60">
                    <td className="px-4 py-2.5"><CadenceTag cadence={c.cadence} /></td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink/70">{c.open_count + c.closed_count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink/70">{c.win_rate == null ? "—" : `${c.win_rate.toFixed(0)}%`}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${toneClass(c.avg_return_pct)}`}>{c.avg_return_pct == null ? "—" : pct(c.avg_return_pct)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${toneClass(c.realized)}`}>{signedCompact(c.realized)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${toneClass(c.unrealized)}`}>{signedCompact(c.unrealized)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
