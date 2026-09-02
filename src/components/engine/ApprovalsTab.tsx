"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { formatNaira, formatNumber } from "@/lib/format";
import type { ExecutionMode, StrategyTrade } from "@/lib/db/strategy";
import { toneClass, pct, CadenceTag } from "./ui";

interface Payload {
  ok: boolean;
  execution_mode: ExecutionMode;
  pending: StrategyTrade[];
  priceBySymbol: Record<string, number | null>;
}

export function ApprovalsTab({ onChanged }: { onChanged: () => void }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // trade id, or "all-approve"/"all-reject"
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/engine/pending", { cache: "no-store" });
      const body = await res.json();
      if (body.ok) setData(body as Payload);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: "approve" | "reject" | "approve_all" | "reject_all", id?: string) {
    setBusy(id ?? action);
    setMsg(null);
    try {
      const res = await fetch("/api/engine/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      const body = await res.json();
      if (body.ok) {
        const bits = [];
        if (body.approved) bits.push(`${body.approved} executed`);
        if (body.rejected) bits.push(`${body.rejected} rejected`);
        setMsg(bits.length ? `${bits.join(" · ")} — ${body.remaining} still pending.` : null);
        await load();
        onChanged(); // refresh the dashboard KPIs + badge
      } else {
        setMsg(body.error ?? "Could not complete the action.");
      }
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  const pending = data?.pending ?? [];
  const mode = data?.execution_mode ?? "manual";

  return (
    <div className="space-y-4">
      {/* Mode context banner */}
      <div
        className={`flex items-start gap-2.5 rounded-xl border p-3 ${
          mode === "auto"
            ? "border-amber-400/50 bg-amber-50/70 dark:bg-amber-950/20"
            : "border-fresh/30 bg-fresh/[0.06]"
        }`}
      >
        {mode === "auto" ? (
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        ) : (
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest-soft" />
        )}
        <p className="font-sans text-[12px] leading-relaxed text-ink/70">
          {mode === "auto" ? (
            <>
              <strong className="text-amber-700 dark:text-amber-300">Full automation is ON.</strong> New signals execute
              immediately without approval. This queue only fills while automation is paused (switch modes in Settings).
            </>
          ) : (
            <>
              <strong className="text-forest">Human approval is ON.</strong> Automated execution is paused — every signal the
              engine generates waits here for your decision before it becomes a live position.
            </>
          )}
        </p>
      </div>

      <Panel
        title="Pending approvals"
        subtitle="Proposed trades awaiting execution"
        right={
          pending.length ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => act("approve_all")}
                disabled={!!busy}
                className="inline-flex items-center gap-1 rounded-md bg-fresh px-2.5 py-1 font-sans text-[12px] font-semibold text-forest hover:brightness-95 disabled:opacity-50"
              >
                {busy === "approve_all" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve all
              </button>
              <button
                onClick={() => act("reject_all")}
                disabled={!!busy}
                className="inline-flex items-center gap-1 rounded-md border border-loss/40 px-2.5 py-1 font-sans text-[12px] font-semibold text-loss hover:bg-loss/5 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Reject all
              </button>
            </div>
          ) : (
            <span className="font-sans text-[11px] text-ink/45">{pending.length}</span>
          )
        }
      >
        {loading ? (
          <div className="h-24 animate-pulse rounded-lg bg-stone/60" />
        ) : pending.length === 0 ? (
          <p className="py-8 text-center font-sans text-[12px] text-ink/45">
            No trades awaiting approval.
            {mode === "manual" && " New proposals will appear here when the engine next generates a book."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left font-sans text-[12px]">
              <thead>
                <tr className="border-b border-stone text-[10px] uppercase tracking-eyebrow text-ink/45">
                  <th className="py-2 pr-2">Stock</th>
                  <th className="px-2">Cadence</th>
                  <th className="px-2 text-right">Shares</th>
                  <th className="px-2 text-right">Entry</th>
                  <th className="px-2 text-right">Live</th>
                  <th className="px-2 text-right">Value</th>
                  <th className="px-2 text-right">Δ vs entry</th>
                  <th className="pl-2 text-right">Decision</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((t) => {
                  const live = data?.priceBySymbol[t.symbol.toUpperCase()] ?? null;
                  const movePct = live != null && t.entry_price > 0 ? ((live - t.entry_price) / t.entry_price) * 100 : null;
                  const rowBusy = busy === t.id;
                  return (
                    <tr key={t.id} className="border-b border-stone/60">
                      <td className="py-2 pr-2">
                        <Link href={`/stocks/${t.symbol}`} className="font-sans text-[11px] font-bold uppercase tracking-wide text-forest hover:underline">
                          {t.symbol}
                        </Link>
                        <div className="max-w-[160px] truncate font-sans text-[10px] text-ink/45">{t.company_name || t.sector}</div>
                      </td>
                      <td className="px-2"><CadenceTag cadence={t.cadence} /></td>
                      <td className="px-2 text-right tabular-nums">{formatNumber(t.shares)}</td>
                      <td className="px-2 text-right tabular-nums">{formatNaira(t.entry_price)}</td>
                      <td className="px-2 text-right tabular-nums">{live == null ? "—" : formatNaira(live)}</td>
                      <td className="px-2 text-right tabular-nums">{formatNaira(t.amount_ngn)}</td>
                      <td className={`px-2 text-right tabular-nums ${movePct == null ? "text-ink/40" : toneClass(movePct)}`}>
                        {movePct == null ? "—" : pct(movePct)}
                      </td>
                      <td className="pl-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => act("approve", t.id)}
                            disabled={!!busy}
                            title="Approve — execute this trade now"
                            className="inline-flex items-center gap-1 rounded-md bg-fresh/90 px-2 py-1 font-sans text-[11px] font-semibold text-forest hover:bg-fresh disabled:opacity-50"
                          >
                            {rowBusy ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Approve
                          </button>
                          <button
                            onClick={() => act("reject", t.id)}
                            disabled={!!busy}
                            title="Reject — discard this proposal"
                            className="inline-flex items-center gap-1 rounded-md border border-loss/40 px-2 py-1 font-sans text-[11px] font-semibold text-loss hover:bg-loss/5 disabled:opacity-50"
                          >
                            <X className="h-3 w-3" /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {msg && <p className="mt-3 font-sans text-[12px] text-ink/70">{msg}</p>}
      </Panel>
    </div>
  );
}
