"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, Send, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { formatNaira, formatNairaCompact, formatNumber, formatPercent, formatTimestamp } from "@/lib/format";
import { fetchPortfolioProposals, submitProposal } from "@/lib/portfolio/proposals-api";
import type { ProposalTrade, RebalanceProposal } from "@/lib/db/proposals";
import type { ManageData } from "./useManageData";

export function RebalanceTab({ data }: { data: ManageData }) {
  const { valued, totals, targetWeights, quotes, loading, portfolio } = data;
  const [proposals, setProposals] = useState<RebalanceProposal[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const pid = portfolio?.id;
  useEffect(() => {
    if (pid) fetchPortfolioProposals(pid).then(setProposals);
  }, [pid]);

  const rows = useMemo(() => {
    // Union of currently-held symbols and model-target symbols.
    const symbols = new Set<string>([
      ...valued.map((v) => v.symbol),
      ...Object.keys(targetWeights),
    ]);
    return [...symbols]
      .map((symbol) => {
        const pos = valued.find((v) => v.symbol === symbol);
        const price = pos?.currentPrice ?? quotes[symbol]?.price ?? null;
        const currentValue = pos?.marketValue ?? 0;
        const currentWt =
          totals.marketValue > 0 ? (currentValue / totals.marketValue) * 100 : 0;
        const targetWt = targetWeights[symbol] ?? 0;
        const targetValue = (targetWt / 100) * totals.marketValue;
        const deltaValue = targetValue - currentValue;
        const unitsDelta = price && price > 0 ? deltaValue / price : null;
        return {
          symbol,
          price,
          currentWt,
          targetWt,
          driftPct: currentWt - targetWt,
          deltaValue,
          unitsDelta,
        };
      })
      .sort((a, b) => Math.abs(b.deltaValue) - Math.abs(a.deltaValue));
  }, [valued, totals, targetWeights, quotes]);

  const turnover = rows.reduce((s, r) => s + Math.abs(r.deltaValue), 0) / 2;

  const trades: ProposalTrade[] = useMemo(
    () =>
      rows
        .filter((r) => r.unitsDelta != null && Math.abs(r.unitsDelta) >= 1)
        .map((r) => ({
          symbol: r.symbol,
          action: (r.unitsDelta as number) > 0 ? "BUY" : "SELL",
          units: Math.round(Math.abs(r.unitsDelta as number)),
          value: Math.abs(r.deltaValue),
        })),
    [rows]
  );

  async function submit() {
    if (!pid || !trades.length) return;
    setSubmitting(true);
    setMsg(null);
    const res = await submitProposal(pid, trades, turnover, "");
    setSubmitting(false);
    if (res.ok) {
      setMsg("Submitted for PFM approval.");
      setProposals(await fetchPortfolioProposals(pid));
    } else {
      setMsg(res.error ?? "Submit failed.");
    }
  }

  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-stone" />;

  if (totals.marketValue <= 0) {
    return (
      <Panel title="Rebalancing" subtitle="Restore target weights">
        <p className="py-6 text-center font-sans text-[13px] text-ink/55">
          Add positions first — rebalancing needs a live market value to work
          against.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="brb-callout flex items-start gap-2 rounded-r-lg bg-amber-50 dark:bg-amber-950/30 py-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-700 dark:text-amber-300" />
        <p className="font-sans text-[12px] text-amber-800 dark:text-amber-200">
          <strong>Analytical proposal only.</strong> The trades below restore the
          model target weights against current prices. This is not an order and
          requires PM / IC approval before any execution.
        </p>
      </div>

      <Panel
        title="Rebalancing proposal"
        subtitle={`Estimated turnover ${formatNairaCompact(turnover)} · target = model weights`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-[13px]">
            <thead>
              <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                <th className="py-1.5 pr-2 font-medium">Stock</th>
                <th className="py-1.5 pr-2 text-right font-medium">Current %</th>
                <th className="py-1.5 pr-2 text-right font-medium">Target %</th>
                <th className="py-1.5 pr-2 text-right font-medium">Drift</th>
                <th className="py-1.5 pr-2 text-right font-medium">₦ to trade</th>
                <th className="py-1.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone">
              {rows.map((r) => {
                const buy = (r.unitsDelta ?? 0) > 0;
                const flat = Math.abs(r.unitsDelta ?? 0) < 1;
                return (
                  <tr key={r.symbol}>
                    <td className="py-1.5 pr-2 font-semibold text-forest">{r.symbol}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-ink/70">
                      {formatPercent(r.currentWt)}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-ink/70">
                      {formatPercent(r.targetWt)}
                    </td>
                    <td
                      className={`py-1.5 pr-2 text-right tabular-nums ${
                        Math.abs(r.driftPct) > 5 ? "font-semibold text-loss" : "text-ink/60"
                      }`}
                    >
                      {r.driftPct > 0 ? "+" : ""}
                      {r.driftPct.toFixed(1)}%
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {formatNaira(Math.abs(r.deltaValue))}
                    </td>
                    <td className="py-1.5 text-right">
                      {flat || r.unitsDelta == null ? (
                        <span className="font-sans text-[12px] text-ink/40">hold</span>
                      ) : (
                        <span
                          className={`font-sans text-[12px] font-semibold ${
                            buy ? "text-forest-soft" : "text-loss"
                          }`}
                        >
                          {buy ? "BUY" : "SELL"} {formatNumber(Math.abs(r.unitsDelta))} units
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-stone pt-3">
          <button
            onClick={submit}
            disabled={submitting || trades.length === 0}
            className="inline-flex items-center gap-1 rounded-lg bg-forest px-4 py-2 font-sans text-sm font-semibold text-[#F5F2EC] hover:bg-forest-soft disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Submitting…" : `Submit for PFM approval (${trades.length})`}
          </button>
          {msg && <span className="font-sans text-[12px] text-forest-soft">{msg}</span>}
        </div>
      </Panel>

      {proposals.length > 0 && (
        <Panel title="Approval history" subtitle="Rebalancing proposals for this portfolio">
          <ul className="divide-y divide-stone">
            {proposals.map((p) => {
              const trades = (() => {
                try {
                  return JSON.parse(p.trades) as ProposalTrade[];
                } catch {
                  return [];
                }
              })();
              return (
                <li key={p.id} className="flex items-start gap-3 py-2">
                  <StatusIcon status={p.status} />
                  <div className="flex-1">
                    <p className="font-sans text-[13px] text-forest">
                      <span className="font-semibold capitalize">{p.status}</span> ·{" "}
                      {trades.length} trades · turnover {formatNairaCompact(p.turnover)}
                    </p>
                    <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                      By {p.created_by} · {formatTimestamp(p.created_at)}
                      {p.decided_by ? ` · ${p.status} by ${p.decided_by}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "approved") return <CheckCircle2 className="mt-0.5 h-4 w-4 text-fresh" />;
  if (status === "rejected") return <XCircle className="mt-0.5 h-4 w-4 text-loss" />;
  return <Clock className="mt-0.5 h-4 w-4 text-amber-500" />;
}
