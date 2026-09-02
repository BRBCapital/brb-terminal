"use client";

import { useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { Delta } from "@/components/ui/Delta";
import { TickerBadge } from "@/components/ui/TickerBadge";
import { formatNaira, formatNumber, formatPercent } from "@/lib/format";
import { CsvExportButton } from "@/components/ui/ExportButtons";
import { bulkTransactionsReq } from "@/lib/portfolio/api";
import type { TransactionInput } from "@/lib/db/transactions";
import type { ManageData } from "./useManageData";

export function HoldingsTab({
  data,
  ccy,
}: {
  data: ManageData;
  ccy: "NGN" | "USD";
}) {
  const { valued, totals, targetWeights, usdRate, loading } = data;

  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-stone" />;
  }
  if (valued.length === 0) {
    return <EmptyHoldings data={data} />;
  }

  const money = (n: number | null) => {
    if (n == null) return "—";
    if (ccy === "USD" && usdRate) return `$${formatNumber(n / usdRate, 2)}`;
    return formatNaira(n);
  };

  return (
    <Panel
      title="Holdings"
      subtitle="Live positions · actual vs target weight"
      right={
        <CsvExportButton
          rows={valued}
          filename="holdings"
          columns={[
            { key: "symbol", label: "Symbol" },
            { key: "sector", label: "Sector" },
            { key: "units", label: "Units" },
            { key: "avgCost", label: "Avg cost (NGN)" },
            { key: "currentPrice", label: "Price (NGN)" },
            { key: "marketValue", label: "Market value (NGN)" },
            { key: "unrealisedPnl", label: "Unrealised P&L (NGN)" },
            { key: "unrealisedPct", label: "Unrealised %" },
            { key: "dayChangePct", label: "Day %" },
          ]}
        />
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left font-sans text-[13px]">
          <thead>
            <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
              <th className="py-1.5 pr-2 font-medium">Stock</th>
              <th className="py-1.5 pr-2 text-right font-medium">Units</th>
              <th className="py-1.5 pr-2 text-right font-medium">Avg cost</th>
              <th className="py-1.5 pr-2 text-right font-medium">Price</th>
              <th className="py-1.5 pr-2 text-right font-medium">Mkt value</th>
              <th className="py-1.5 pr-2 text-right font-medium">Day</th>
              <th className="py-1.5 pr-2 text-right font-medium">Unreal P&L</th>
              <th className="py-1.5 pr-2 text-right font-medium">Wt / Tgt</th>
              <th className="py-1.5 text-right font-medium">Drift</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone">
            {valued.map((p) => {
              const actualWt =
                totals.marketValue > 0 && p.marketValue != null
                  ? (p.marketValue / totals.marketValue) * 100
                  : 0;
              const target = targetWeights[p.symbol] ?? 0;
              const drift = actualWt - target;
              return (
                <tr key={p.symbol}>
                  <td className="py-1.5 pr-2">
                    <Link href={`/stocks/${p.symbol}`} className="flex items-center gap-2">
                      <TickerBadge symbol={p.symbol} size={22} />
                      <div className="min-w-0">
                        <p className="font-semibold text-forest">{p.symbol}</p>
                        <p className="truncate text-[10px] text-ink/45">{p.sector}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{formatNumber(p.units)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{money(p.avgCost)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{money(p.currentPrice)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{money(p.marketValue)}</td>
                  <td className="py-1.5 pr-2 text-right">
                    <Delta value={p.dayChangePct} showArrow={false} className="text-[12px]" />
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    <span className="tabular-nums">{money(p.unrealisedPnl)}</span>{" "}
                    <Delta value={p.unrealisedPct} showArrow={false} className="text-[11px]" />
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-ink/70">
                    {formatPercent(actualWt)}{" "}
                    <span className="text-ink/35">/ {formatPercent(target)}</span>
                  </td>
                  <td
                    className={`py-1.5 text-right tabular-nums ${
                      Math.abs(drift) > 5 ? "font-semibold text-loss" : "text-ink/60"
                    }`}
                  >
                    {drift > 0 ? "+" : ""}
                    {drift.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// Empty-state for a freshly-built portfolio: the management view is a live
// ledger, so a model with no booked trades shows no positions. Offer the
// "initialize from model" action right here (where the user lands) instead of
// making them discover it in the Transactions tab.
function EmptyHoldings({ data }: { data: ManageData }) {
  const { portfolio, reloadTx } = data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("10000000");
  const modelCount = portfolio?.holdings.length ?? 0;
  const isUnits = portfolio?.holdings.some((h) => h.mode === "units") ?? false;

  async function initFromModel() {
    if (!portfolio) return;
    const seedDate =
      portfolio.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    let seeds: TransactionInput[];
    if (isUnits) {
      seeds = portfolio.holdings.map((h) => ({
        symbol: h.symbol,
        kind: "buy" as const,
        trade_date: seedDate,
        units: h.units ?? 0,
        price: h.entry_price,
        notes: "Initialized from model",
      }));
    } else {
      const total = Number(amount);
      if (!(total > 0)) {
        setError("Enter a positive amount to invest.");
        return;
      }
      seeds = portfolio.holdings.map((h) => ({
        symbol: h.symbol,
        kind: "buy" as const,
        trade_date: seedDate,
        units: h.entry_price > 0 ? (((h.weight ?? 0) / 100) * total) / h.entry_price : 0,
        price: h.entry_price,
        notes: "Initialized from model weights",
      }));
    }
    setBusy(true);
    setError(null);
    const res = await bulkTransactionsReq(portfolio.id, seeds);
    setBusy(false);
    if (res.ok) await reloadTx();
    else setError(res.error ?? "Could not initialize from the model.");
  }

  return (
    <Panel title="Holdings" subtitle="No open positions yet">
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="max-w-md font-sans text-[13px] leading-relaxed text-ink/55">
          This is the live management ledger — it tracks positions from booked
          trades.{" "}
          {modelCount > 0 ? (
            <>
              Seed it with opening buys from this portfolio&apos;s{" "}
              <span className="font-semibold text-forest">{modelCount} model holdings</span>,
              or record trades manually in the{" "}
              <span className="font-semibold">Transactions</span> tab.
            </>
          ) : (
            <>
              Record buys in the <span className="font-semibold">Transactions</span> tab to
              build positions.
            </>
          )}
        </p>
        {modelCount > 0 && (
          <div className="flex flex-col items-center gap-2">
            {/* Weight-mode books need a capital figure to translate %-weights
                into share counts; units-mode books already carry share counts. */}
            {!isUnits && (
              <label className="flex items-center gap-2 font-sans text-[12px] text-ink/55">
                Amount to invest
                <span className="flex items-center rounded-lg border border-stone bg-surface px-2 focus-within:border-fresh">
                  <span className="text-ink/45">₦</span>
                  <input
                    type="number"
                    min={0}
                    step={100000}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={busy}
                    className="w-36 bg-transparent px-1 py-1.5 text-right tabular-nums text-ink outline-none disabled:opacity-50"
                  />
                </span>
              </label>
            )}
            <button
              onClick={initFromModel}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-fresh px-4 py-2 font-sans text-sm font-semibold text-forest hover:brightness-95 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {busy ? "Initializing…" : "Initialize from model"}
            </button>
          </div>
        )}
        {error && <p className="font-sans text-[12px] text-loss">{error}</p>}
      </div>
    </Panel>
  );
}
