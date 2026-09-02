"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, CalendarRange, ArrowUp, ArrowDown } from "lucide-react";
import { formatNaira, formatNairaCompact } from "@/lib/format";
import type { OverviewData, OverviewPosition } from "@/lib/engine/overview";
import type { MonthlyProfileSummary } from "@/lib/engine/profiles";
import type { StrategyPortfolio } from "@/lib/db/strategy";
import { Panel } from "@/components/ui/Tile";
import { Delta } from "@/components/ui/Delta";
import { Stat, HeroStat, DeltaChip, CadenceTag, toneClass, signedCompact, pct } from "./ui";

export function formatMonth(period: string): string {
  const d = new Date(`${period}-01T00:00:00`);
  return isNaN(d.getTime())
    ? period
    : d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

interface Detail {
  period: string;
  overview: OverviewData;
  portfolios: StrategyPortfolio[];
}

type Row = OverviewPosition & { status: "open" | "closed" };
type SortKey = "symbol" | "opened_on" | "entry_price" | "current_price" | "amount_ngn" | "unrealized" | "unrealized_pct";

export function ProfilesTab() {
  const [profiles, setProfiles] = useState<MonthlyProfileSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    (async () => {
      const body = await (await fetch("/api/engine/profiles", { cache: "no-store" })).json();
      const list: MonthlyProfileSummary[] = body.ok ? body.profiles : [];
      setProfiles(list);
      if (list.length) setSelected(list[0].period);
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      setLoadingDetail(true);
      const body = await (await fetch(`/api/engine/profiles/${selected}`, { cache: "no-store" })).json();
      if (cancelled) return;
      setDetail(body.ok ? body : null);
      setLoadingDetail(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (profiles === null) return <div className="h-40 animate-pulse rounded-xl bg-stone/60" />;
  if (!profiles.length) {
    return (
      <Panel title="Monthly profiles" subtitle="A performance statement per trading month">
        <div className="flex min-h-32 items-center justify-center px-4 py-8 text-center">
          <p className="max-w-sm font-sans text-[12px] leading-relaxed text-ink/50">
            No trading months yet. Once the engine books trades, each month appears here with its
            trades, a performance statement, and an AI-written PDF report.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month selector — pick any month on record */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-ink/45">
          <CalendarRange className="h-3.5 w-3.5" /> Trading month
        </span>
        <select
          value={selected ?? ""}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-lg border border-stone bg-surface px-3 py-1.5 font-sans text-[13px] font-medium text-forest outline-none focus:border-fresh"
        >
          {profiles.map((p) => (
            <option key={p.period} value={p.period}>
              {formatMonth(p.period)} · {p.trade_count} trade{p.trade_count === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </div>

      {loadingDetail || !detail ? (
        <div className="h-64 animate-pulse rounded-xl bg-stone/60" />
      ) : (
        <ProfileDetail detail={detail} />
      )}
    </div>
  );
}

function ProfileDetail({ detail }: { detail: Detail }) {
  const t = detail.overview.totals;
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "opened_on", dir: -1 });

  const rows = useMemo<Row[]>(() => {
    const open = detail.overview.positions.map((p) => ({ ...p, status: "open" as const }));
    const closed = detail.overview.closed.map((p) => ({ ...p, status: "closed" as const }));
    const all = [...open, ...closed];
    return all.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string" && typeof bv === "string") return av < bv ? -sort.dir : av > bv ? sort.dir : 0;
      return ((Number(av) || 0) - (Number(bv) || 0)) * sort.dir;
    });
  }, [detail, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));

  const context = detail.portfolios.find((p) => p.market_context)?.market_context;

  return (
    <div className="space-y-4">
      {/* Header + PDF */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="brb-eyebrow">Performance statement</p>
          <h3 className="font-serif text-xl font-bold text-forest">{formatMonth(detail.period)}</h3>
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
            label={`Net P&L · ${formatMonth(detail.period)}`}
            value={signedCompact(t.total_pnl)}
            valueClass={t.total_pnl >= 0 ? "text-fresh" : "text-[#ff9e92]"}
            delta={<DeltaChip pct={t.return_pct} />}
            sub={`Realised ${signedCompact(t.realized)}  ·  Unrealised ${signedCompact(t.unrealized)}`}
          />
        </div>
        <Stat label="Win rate" value={t.win_rate == null ? "—" : `${t.win_rate.toFixed(0)}%`} sub={`${t.open_count} open · ${t.closed_count} closed`} />
        <Stat label="Deployed" value={formatNairaCompact(t.deployed)} sub={`of ${formatNairaCompact(t.capital)}`} />
      </div>

      {/* Per-cadence */}
      <Panel title="By cadence" subtitle="Realised & open contribution per strategy">
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

      {/* Trades — sortable */}
      <Panel title="Trades this month" subtitle={`${rows.length} position${rows.length === 1 ? "" : "s"} — click a column to sort`}>
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-stone text-left font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                <SortTh label="Stock" k="symbol" sort={sort} onClick={toggle} />
                <th className="px-4 py-2">Cadence</th>
                <SortTh label="Opened" k="opened_on" sort={sort} onClick={toggle} />
                <SortTh label="Entry" k="entry_price" sort={sort} onClick={toggle} right />
                <SortTh label="Mark / close" k="current_price" sort={sort} onClick={toggle} right />
                <SortTh label="Value" k="amount_ngn" sort={sort} onClick={toggle} right />
                <SortTh label="P&L" k="unrealized" sort={sort} onClick={toggle} right />
                <SortTh label="%" k="unrealized_pct" sort={sort} onClick={toggle} right />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-stone/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/stocks/${r.symbol}`} className="font-sans text-[11px] font-bold uppercase text-forest hover:underline">
                      {r.symbol}
                    </Link>
                    <span className="ml-2 rounded-full bg-sand px-1.5 py-0.5 font-sans text-[8px] uppercase tracking-eyebrow text-ink/50">{r.status}</span>
                  </td>
                  <td className="px-4 py-2.5"><CadenceTag cadence={r.cadence} /></td>
                  <td className="px-4 py-2.5 tabular-nums text-ink/55">{r.opened_on}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink/70">{formatNaira(r.entry_price)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink/70">{r.current_price == null ? "—" : formatNaira(r.current_price)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink/70">{formatNairaCompact(r.amount_ngn)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${toneClass(r.unrealized)}`}>{signedCompact(r.unrealized)}</td>
                  <td className="px-4 py-2.5 text-right"><Delta value={r.unrealized_pct} showArrow={false} className="text-[11px]" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {context && (
        <div className="brb-callout py-2">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest-soft">Desk context at entry</p>
          <p className="mt-1 font-sans text-[12px] leading-relaxed text-ink/60">{context}</p>
        </div>
      )}
    </div>
  );
}

function SortTh({
  label,
  k,
  sort,
  onClick,
  right,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onClick: (k: SortKey) => void;
  right?: boolean;
}) {
  const active = sort.key === k;
  return (
    <th className={`px-4 py-2 ${right ? "text-right" : ""}`}>
      <button
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-eyebrow transition-colors hover:text-forest ${active ? "text-forest" : ""}`}
      >
        {label}
        {active && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}
