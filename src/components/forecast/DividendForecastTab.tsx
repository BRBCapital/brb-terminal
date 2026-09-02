"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNgx } from "@/hooks/useNgx";
import { Panel, TileBody } from "@/components/ui/Tile";
import { ForecastDisclaimer } from "./ForecastDisclaimer";
import { AiAnalysisPanel } from "./AiAnalysisPanel";
import { formatNaira, formatPercent } from "@/lib/format";
import { forecastDividends } from "@/lib/forecast/fundamental";
import type { CompanyDividends } from "@/lib/ngx/types";

export function DividendForecastTab({
  symbol,
  currentPrice,
}: {
  symbol: string;
  currentPrice: number | null;
}) {
  const query = useNgx<CompanyDividends>(`companies/${symbol}/dividends`);

  return (
    <div className="space-y-4">
      <ForecastDisclaimer />
      <Panel title="Dividend forecast" subtitle="Projected from payout history & trend">
        <TileBody query={query} isEmpty={(d) => !d?.dividends?.length}>
          {(d) => (
            <Body dividends={d.dividends} currentPrice={currentPrice} />
          )}
        </TileBody>
      </Panel>

      <AiAnalysisPanel
        symbol={symbol}
        analysisKind="dividend_forecast"
        title="AI dividend outlook"
        subtitle="Claude reads the payout history, cover and projection"
        cta="Generate dividend outlook"
        emptyBlurb="Claude analyses the dividend history, sustainability (cover vs EPS) and the projected payout path, and writes a forward income outlook — grounded in the figures above."
      />

      <ForecastDisclaimer compact />
    </div>
  );
}

function Body({
  dividends,
  currentPrice,
}: {
  dividends: CompanyDividends["dividends"];
  currentPrice: number | null;
}) {
  const fc = useMemo(
    () => forecastDividends(dividends, currentPrice ?? 0, 5),
    [dividends, currentPrice]
  );

  const chartData = fc.projections.map((p) => ({
    label: `Y+${p.year}`,
    dps: p.dps,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="TTM dividend/sh" value={formatNaira(fc.recentAnnualDps)} />
        <Metric label="Est. growth" value={formatPercent(fc.estimatedGrowthPct)} />
        <Metric
          label="Current yield"
          value={
            currentPrice && currentPrice > 0
              ? formatPercent((fc.recentAnnualDps / currentPrice) * 100)
              : "—"
          }
        />
        <Metric
          label="Yield-on-cost Y+5"
          value={formatPercent(fc.projections.at(-1)?.yieldOnCostPct ?? 0)}
        />
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#1A1A1A80" }} tickLine={false} axisLine={{ stroke: "#E8E6E0" }} />
            <YAxis tick={{ fontSize: 9, fill: "#1A1A1A80" }} width={44} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₦${v.toFixed(0)}`} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E8E6E0" }} formatter={(v: any) => [formatNaira(Number(v)), "Projected DPS"]} />
            <Bar dataKey="dps" fill="#8AC873" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left font-sans text-[13px]">
          <thead>
            <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
              <th className="py-1.5 pr-2 font-medium">Year</th>
              <th className="py-1.5 pr-2 text-right font-medium">Projected DPS</th>
              <th className="py-1.5 text-right font-medium">Yield on current price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone">
            {fc.projections.map((p) => (
              <tr key={p.year}>
                <td className="py-1.5 pr-2">Year +{p.year}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{formatNaira(p.dps)}</td>
                <td className="py-1.5 text-right tabular-nums text-forest-soft">
                  {formatPercent(p.yieldOnCostPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-sans text-[10px] text-ink/45">
        Forward dividends compound the trailing annual payout at the historical
        DPS growth rate (clamped to ±15–25% to contain one-off spikes). Assumes
        the payout policy persists.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone bg-surface px-3.5 py-3 shadow-card">
      <p className="font-sans text-[9.5px] font-semibold uppercase tracking-eyebrow text-ink/40">{label}</p>
      <p className="mt-1.5 font-serif text-base font-semibold text-forest tabular-nums">{value}</p>
    </div>
  );
}
