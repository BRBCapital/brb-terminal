"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, LineChart } from "lucide-react";
import { fetchProxy } from "@/lib/ngx/browser";
import { fetchPortfolio, deletePortfolioReq } from "@/lib/portfolio/api";
import { computeMetrics, type EnrichedHolding } from "@/lib/portfolio/metrics";
import { SectorDonut } from "./SectorDonut";
import { PortfolioBacktest } from "./PortfolioBacktest";
import { TickerBadge } from "@/components/ui/TickerBadge";
import { Delta } from "@/components/ui/Delta";
import { ComplianceNote } from "@/components/ui/ComplianceNote";
import { PrintButton, PrintHeader } from "@/components/ui/PrintButton";
import { formatNaira, formatPercent, formatNumber } from "@/lib/format";
import type { CompanyDetail } from "@/lib/ngx/types";
import type { PortfolioWithHoldings } from "@/lib/db/portfolios";

export function PortfolioView({ id }: { id: string }) {
  const router = useRouter();
  const [pf, setPf] = useState<PortfolioWithHoldings | null | undefined>(undefined);
  const [enriched, setEnriched] = useState<EnrichedHolding[]>([]);

  useEffect(() => {
    fetchPortfolio(id).then(setPf);
  }, [id]);

  // Enrich holdings with live metrics for the analytics blocks.
  useEffect(() => {
    if (!pf) return;
    let cancelled = false;
    (async () => {
      const rows = await Promise.all(
        pf.holdings.map(async (h) => {
          const res = await fetchProxy<CompanyDetail>(`companies/${h.symbol}`);
          const base: EnrichedHolding = {
            symbol: h.symbol,
            company_name: h.company_name,
            sector: h.sector,
            mode: h.mode,
            weight: h.weight,
            units: h.units,
            entry_price: h.entry_price,
          };
          if (res.ok) {
            return {
              ...base,
              sector: h.sector || res.data.sector,
              current_price: res.data.current_price,
              dividend_yield: res.data.dividend_yield,
              ttm_eps: res.data.ttm_eps,
            } as EnrichedHolding;
          }
          return base;
        })
      );
      if (!cancelled) setEnriched(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [pf]);

  const metrics = useMemo(() => computeMetrics(enriched), [enriched]);

  async function onDelete() {
    if (!pf) return;
    if (!confirm(`Delete portfolio "${pf.name}"? This cannot be undone.`)) return;
    const ok = await deletePortfolioReq(pf.id);
    if (ok) {
      router.push("/portfolios");
      router.refresh();
    }
  }

  if (pf === undefined) {
    return <div className="h-40 animate-pulse rounded-xl bg-stone" />;
  }
  if (pf === null) {
    return (
      <div className="brb-card p-8 text-center">
        <p className="font-serif text-lg text-forest">Portfolio not found</p>
        <Link href="/portfolios" className="mt-2 inline-block text-forest-soft underline">
          Back to portfolios
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PrintHeader title={`${pf.name} — portfolio one-pager`} />
      <Link
        href="/portfolios"
        className="inline-flex items-center gap-1 font-sans text-[11px] uppercase tracking-eyebrow text-forest-soft hover:text-forest print:hidden"
      >
        <ArrowLeft className="h-3 w-3" /> Portfolios
      </Link>

      {/* Header */}
      <div className="brb-card flex flex-wrap items-start justify-between gap-3 p-5">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest">{pf.name}</h1>
          {pf.mandate_notes && (
            <p className="mt-1 max-w-2xl font-sans text-[13px] text-ink/60">
              {pf.mandate_notes}
            </p>
          )}
          <p className="mt-1 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
            Benchmark {pf.benchmark_symbol} · base {pf.base_currency} ·{" "}
            {pf.holdings.length} holdings
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton label="PDF one-pager" />
          <Link
            href={`/portfolios/${pf.id}/manage`}
            className="inline-flex items-center gap-1 rounded-lg bg-fresh px-3 py-1.5 font-sans text-[12px] font-semibold text-forest hover:brightness-95"
          >
            <LineChart className="h-3.5 w-3.5" /> Manage
          </Link>
          <Link
            href={`/portfolios/${pf.id}/edit`}
            className="inline-flex items-center gap-1 rounded-lg border border-stone px-3 py-1.5 font-sans text-[12px] font-semibold text-forest hover:bg-sand"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-lg border border-loss/40 px-3 py-1.5 font-sans text-[12px] font-semibold text-loss hover:bg-loss/5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Metrics + donut */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="brb-card p-4 lg:col-span-1">
          <p className="mb-3 font-sans text-[12px] font-semibold uppercase tracking-eyebrow text-forest">
            Metrics
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Wtd. div yield" value={metrics.weightedDividendYield != null ? formatPercent(metrics.weightedDividendYield) : "—"} />
            <Metric label="Wtd. P/E" value={metrics.weightedPE != null ? `${metrics.weightedPE.toFixed(1)}×` : "—"} />
            <Metric label={metrics.isUnitsMode ? "Invested (₦)" : "Weight sum"} value={metrics.isUnitsMode ? formatNaira(metrics.investedValue ?? 0) : formatPercent(metrics.weightSum)} />
            <Metric label="Holdings" value={String(pf.holdings.length)} />
          </div>
        </div>
        <div className="brb-card p-4 lg:col-span-2">
          <p className="mb-3 font-sans text-[12px] font-semibold uppercase tracking-eyebrow text-forest">
            Sector allocation
          </p>
          <SectorDonut data={metrics.sectorAllocation} />
        </div>
      </div>

      {/* Holdings */}
      <div className="brb-card p-4">
        <p className="mb-3 font-sans text-[12px] font-semibold uppercase tracking-eyebrow text-forest">
          Holdings
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-[13px]">
            <thead>
              <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                <th className="py-1.5 pr-2 font-medium">Stock</th>
                <th className="py-1.5 pr-2 text-right font-medium">Entry</th>
                <th className="py-1.5 pr-2 text-right font-medium">Current</th>
                <th className="py-1.5 pr-2 text-right font-medium">
                  {metrics.isUnitsMode ? "Units" : "Weight"}
                </th>
                <th className="py-1.5 pr-2 text-right font-medium">Eff. %</th>
                <th className="py-1.5 text-right font-medium">Unreal. %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone">
              {enriched.map((h) => {
                const eff = metrics.weights.find((w) => w.symbol === h.symbol)?.pct ?? 0;
                const pl =
                  h.current_price != null && h.entry_price > 0
                    ? ((h.current_price - h.entry_price) / h.entry_price) * 100
                    : null;
                return (
                  <tr key={h.symbol}>
                    <td className="py-1.5 pr-2">
                      <Link href={`/stocks/${h.symbol}`} className="flex items-center gap-2">
                        <TickerBadge symbol={h.symbol} size={22} />
                        <div className="min-w-0">
                          <p className="font-semibold text-forest">{h.symbol}</p>
                          <p className="truncate text-[10px] text-ink/45">{h.sector}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatNaira(h.entry_price)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatNaira(h.current_price)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-ink/70">
                      {metrics.isUnitsMode ? formatNumber(h.units ?? 0) : formatPercent(h.weight ?? 0)}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-ink/70">{formatPercent(eff)}</td>
                    <td className="py-1.5 text-right">
                      <Delta value={pl} showArrow={false} className="text-[12px]" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PortfolioBacktest holdings={pf.holdings} benchmarkSymbol={pf.benchmark_symbol} />

      <ComplianceNote>
        Model portfolio for internal analysis only. Unrealised P&L compares the
        stated entry price to the latest available price (delayed up to 20 minutes
        during NGX hours). Not investment advice; past performance does not
        indicate future results.
      </ComplianceNote>
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
