"use client";

import { Panel } from "@/components/ui/Tile";
import { formatNairaCompact } from "@/lib/format";
import type { OverviewData } from "@/lib/engine/overview";
import { EquityCurveChart, MonthlyPnlChart, AllocationDonut } from "./charts";
import { Stat, HeroStat, DeltaChip, toneClass, signedCompact, pct, CadenceTag } from "./ui";

export function OverviewTab({ data }: { data: OverviewData }) {
  const t = data.totals;
  const byCadence = data.per_cadence.map((c) => ({ label: c.cadence, value: c.capital }));

  return (
    <div className="space-y-4">
      {/* Headline band */}
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <HeroStat
            label="Net P&L"
            value={signedCompact(t.total_pnl)}
            valueClass={t.total_pnl >= 0 ? "text-fresh" : "text-[#ff9e92]"}
            delta={<DeltaChip pct={t.return_pct} />}
            sub={`Realised ${signedCompact(t.realized)}  ·  Unrealised ${signedCompact(t.unrealized)}`}
          />
        </div>
        <Stat
          label="Capital deployed"
          value={formatNairaCompact(t.deployed)}
          sub={`of ${formatNairaCompact(t.capital)}  ·  idle ${formatNairaCompact(t.cash_idle)}`}
        />
        <Stat
          label="Win rate"
          value={t.win_rate == null ? "—" : `${t.win_rate.toFixed(0)}%`}
          sub={`${t.open_count} open · ${t.closed_count} closed`}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Realised P&L" value={signedCompact(t.realized)} valueClass={toneClass(t.realized)} />
        <Stat label="Unrealised P&L" value={signedCompact(t.unrealized)} valueClass={toneClass(t.unrealized)} />
        <Stat label="Total return" value={pct(t.return_pct)} valueClass={toneClass(t.return_pct)} />
        <Stat
          label="Max drawdown"
          value={data.max_drawdown > 0 ? `−${formatNairaCompact(data.max_drawdown)}` : "—"}
          valueClass={data.max_drawdown > 0 ? "text-loss" : ""}
        />
        <Stat label="Sharpe (ann.)" value={data.sharpe == null ? "—" : data.sharpe.toFixed(2)} sub="monthly" />
        <Stat label="Positions" value={`${t.open_count} / ${t.closed_count}`} sub="open / closed" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Equity curve" subtitle="Cumulative realised P&L">
          <EquityCurveChart data={data.equity_curve} />
        </Panel>
        <Panel title="Monthly P&L" subtitle="Realised, by cadence">
          <MonthlyPnlChart data={data.monthly_pnl} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Capital allocation" subtitle="By cadence">
          <AllocationDonut data={byCadence} />
        </Panel>
        <Panel title="Sector exposure" subtitle="Live book by sector">
          {data.sector_allocation.length ? (
            <AllocationDonut data={data.sector_allocation.map((s) => ({ label: s.sector, value: s.amount }))} />
          ) : (
            <div className="flex h-56 items-center justify-center">
              <p className="font-sans text-[12px] text-ink/45">No open positions.</p>
            </div>
          )}
        </Panel>
      </div>

      {/* Per-cadence table */}
      <Panel title="Cadence performance" subtitle="Intraday · weekly · monthly">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left font-sans text-[12px]">
            <thead>
              <tr className="border-b border-stone text-[10px] uppercase tracking-eyebrow text-ink/45">
                <th className="py-2 pr-3">Cadence</th>
                <th className="px-3 text-right">Capital</th>
                <th className="px-3 text-right">Deployed</th>
                <th className="px-3 text-right">Open</th>
                <th className="px-3 text-right">Closed</th>
                <th className="px-3 text-right">Win rate</th>
                <th className="px-3 text-right">Avg return</th>
                <th className="px-3 text-right">Realised</th>
                <th className="pl-3 text-right">Unrealised</th>
              </tr>
            </thead>
            <tbody>
              {data.per_cadence.map((c) => (
                <tr key={c.cadence} className="border-b border-stone/60">
                  <td className="py-2 pr-3"><CadenceTag cadence={c.cadence} /></td>
                  <td className="px-3 text-right tabular-nums">{formatNairaCompact(c.capital)}</td>
                  <td className="px-3 text-right tabular-nums">{formatNairaCompact(c.deployed)}</td>
                  <td className="px-3 text-right tabular-nums">{c.open_count}</td>
                  <td className="px-3 text-right tabular-nums">{c.closed_count}</td>
                  <td className="px-3 text-right tabular-nums">{c.win_rate == null ? "—" : `${c.win_rate.toFixed(0)}%`}</td>
                  <td className={`px-3 text-right tabular-nums ${toneClass(c.avg_return_pct)}`}>{pct(c.avg_return_pct)}</td>
                  <td className={`px-3 text-right tabular-nums ${toneClass(c.realized)}`}>{signedCompact(c.realized)}</td>
                  <td className={`pl-3 text-right tabular-nums ${toneClass(c.unrealized)}`}>{signedCompact(c.unrealized)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
