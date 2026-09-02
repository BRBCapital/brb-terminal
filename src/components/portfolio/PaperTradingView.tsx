"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, FlaskConical, X, Briefcase, ArrowRight, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { Delta } from "@/components/ui/Delta";
import { ComplianceNote } from "@/components/ui/ComplianceNote";
import { fetchProxy } from "@/lib/ngx/browser";
import { formatNaira, formatNairaCompact, formatDate } from "@/lib/format";
import type { CompanyDetail } from "@/lib/ngx/types";
import type { PaperTrade } from "@/lib/db/paper-trades";

const HORIZON_LABEL: Record<string, string> = {
  intraday: "Intraday",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export function PaperTradingView() {
  const [trades, setTrades] = useState<PaperTrade[] | null>(null);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [closing, setClosing] = useState<string | null>(null);

  // Convert-to-portfolio flow.
  const [convertOpen, setConvertOpen] = useState(false);
  const [convName, setConvName] = useState("");
  const [convBusy, setConvBusy] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);
  const [convResult, setConvResult] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/paper-trades", { cache: "no-store" });
    if (!res.ok) {
      setTrades([]);
      return;
    }
    const body = await res.json();
    const list: PaperTrade[] = body.ok ? body.trades : [];
    setTrades(list);
    // Live prices for open positions.
    const openSyms = [...new Set(list.filter((t) => t.status === "open").map((t) => t.symbol))];
    const entries = await Promise.all(
      openSyms.map(async (sym) => {
        const r = await fetchProxy<CompanyDetail>(`companies/${sym}`);
        return [sym, r.ok ? r.data.current_price : null] as const;
      })
    );
    setPrices(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function closeTrade(id: string) {
    setClosing(id);
    try {
      await fetch(`/api/paper-trades/${id}/close`, { method: "POST" });
      await load();
    } finally {
      setClosing(null);
    }
  }

  async function deleteClosed(id: string) {
    // Optimistic: drop it locally, then persist.
    setTrades((prev) => (prev ?? []).filter((t) => t.id !== id));
    await fetch(`/api/paper-trades/${id}`, { method: "DELETE" });
  }

  async function clearAllClosed() {
    const n = trades?.filter((t) => t.status === "closed").length ?? 0;
    if (n === 0) return;
    if (!window.confirm(`Clear all ${n} closed position${n === 1 ? "" : "s"}? This can't be undone.`)) return;
    setTrades((prev) => (prev ?? []).filter((t) => t.status !== "closed"));
    await fetch("/api/paper-trades", { method: "DELETE" });
  }

  function openConvert() {
    const today = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    setConvName(`Paper Book — ${today}`);
    setConvError(null);
    setConvResult(null);
    setConvertOpen(true);
  }

  async function convert() {
    if (convBusy) return;
    if (!convName.trim()) {
      setConvError("Give the portfolio a name.");
      return;
    }
    setConvBusy(true);
    setConvError(null);
    try {
      const res = await fetch("/api/paper-trades/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: convName.trim() }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setConvError(body.error ?? "Couldn't create the portfolio.");
        return;
      }
      setConvResult({ id: body.portfolio.id, name: body.portfolio.name });
    } finally {
      setConvBusy(false);
    }
  }

  if (trades === null) {
    return <div className="h-40 animate-pulse rounded-xl bg-stone" />;
  }

  const open = trades.filter((t) => t.status === "open");
  const closed = trades.filter((t) => t.status === "closed");

  // Aggregates.
  let investedOpen = 0;
  let unrealised = 0;
  let priced = 0;
  for (const t of open) {
    investedOpen += t.amount_ngn;
    const px = prices[t.symbol];
    if (px != null) {
      unrealised += (px - t.entry_price) * t.shares;
      priced += 1;
    }
  }
  const realised = closed.reduce(
    (a, t) => a + (t.close_price != null ? (t.close_price - t.entry_price) * t.shares : 0),
    0
  );

  if (trades.length === 0) {
    return (
      <Panel title="Paper trading" subtitle="Simulated positions saved from the AI builder">
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <FlaskConical className="h-8 w-8 text-ink/30" />
          <p className="font-serif text-lg text-forest">No paper trades yet</p>
          <p className="max-w-md font-sans text-[13px] text-ink/55">
            Build a portfolio in the <span className="font-semibold">AI Builder</span> tab, then save any
            pick as a paper trade to track its profit here and close it when you sell.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Paper trading"
        subtitle="Simulated positions — live P&L, close when you sell"
        right={
          <div className="flex items-center gap-2">
            {open.length > 0 && (
              <button
                onClick={openConvert}
                title="Create a portfolio from your open paper trades"
                className="inline-flex items-center gap-1 rounded-md bg-forest px-2.5 py-1 font-sans text-[11px] font-semibold text-[#F5F2EC] hover:bg-forest/90"
              >
                <Briefcase className="h-3.5 w-3.5" /> Convert to portfolio
              </button>
            )}
            <button
              onClick={load}
              title="Refresh prices"
              className="inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1 font-sans text-[11px] text-forest hover:bg-sand"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Open positions" value={String(open.length)} />
          <Stat label="Invested (open)" value={formatNairaCompact(investedOpen)} />
          <Stat
            label={`Unrealised P&L${priced < open.length ? " *" : ""}`}
            value={formatNaira(unrealised)}
            tone={unrealised}
          />
          <Stat label="Realised P&L" value={formatNaira(realised)} tone={realised} />
        </div>
        {priced < open.length && (
          <p className="mt-2 font-sans text-[10px] text-ink/40">* Some live prices unavailable; excluded from unrealised P&amp;L.</p>
        )}
      </Panel>

      {convertOpen && (
        <Panel
          title="Convert to portfolio"
          subtitle={`Snapshot your ${open.length} open position${open.length === 1 ? "" : "s"} into a tracked model portfolio`}
          right={
            <button
              onClick={() => setConvertOpen(false)}
              className="text-ink/40 hover:text-loss"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          }
        >
          {convResult ? (
            <div className="flex flex-col items-start gap-2 py-2">
              <p className="font-sans text-[13px] text-ink/70">
                Created <span className="font-semibold text-forest">{convResult.name}</span> with your
                open positions as units-based holdings (entry prices carried over).
              </p>
              <Link
                href={`/portfolios/${convResult.id}/manage`}
                className="inline-flex items-center gap-1 rounded-md bg-forest px-3 py-1.5 font-sans text-[12px] font-semibold text-[#F5F2EC] hover:bg-forest/90"
              >
                Open portfolio <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block max-w-md">
                <span className="mb-1 block font-sans text-[9px] uppercase tracking-eyebrow text-ink/45">
                  Portfolio name
                </span>
                <input
                  value={convName}
                  onChange={(e) => setConvName(e.target.value)}
                  className="w-full rounded-md border border-stone bg-surface px-2.5 py-1.5 font-sans text-[13px] text-ink"
                />
              </label>
              <p className="max-w-lg font-sans text-[11px] text-ink/50">
                Each open trade becomes a units-mode holding using the shares and entry price you
                recorded. Multiple trades in the same stock are merged (summed shares, weighted-average
                entry). This creates a model portfolio — your paper trades stay open here.
              </p>
              {convError && <p className="font-sans text-[11px] text-loss">{convError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={convert}
                  disabled={convBusy}
                  className="inline-flex items-center gap-1 rounded-md bg-forest px-3 py-1.5 font-sans text-[12px] font-semibold text-[#F5F2EC] hover:bg-forest/90 disabled:opacity-50"
                >
                  {convBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Briefcase className="h-3.5 w-3.5" />}
                  Create portfolio
                </button>
                <button
                  onClick={() => setConvertOpen(false)}
                  className="rounded-md border border-stone px-3 py-1.5 font-sans text-[12px] text-ink/60 hover:bg-sand"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Panel>
      )}

      {open.length > 0 && (
        <Panel title="Open positions" subtitle="Prices delayed up to 20 minutes during NGX hours">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-[12.5px]">
              <thead>
                <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                  <th className="py-1.5 pr-2 font-medium">Stock</th>
                  <th className="py-1.5 pr-2 font-medium">Horizon</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Entry</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Now</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Shares</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Invested</th>
                  <th className="py-1.5 pr-2 text-right font-medium">P&L</th>
                  <th className="py-1.5 pl-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone">
                {open.map((t) => {
                  const px = prices[t.symbol] ?? null;
                  const pnl = px != null ? (px - t.entry_price) * t.shares : null;
                  const pnlPct = px != null && t.entry_price > 0 ? ((px - t.entry_price) / t.entry_price) * 100 : null;
                  return (
                    <tr key={t.id} className="hover:bg-sand/50">
                      <td className="py-2 pr-2">
                        <p className="font-semibold text-forest">{t.symbol}</p>
                        <p className="text-[10px] text-ink/40">opened {formatDate(t.opened_at)}</p>
                      </td>
                      <td className="py-2 pr-2">
                        <span className="rounded bg-sand px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-eyebrow text-ink/60">
                          {HORIZON_LABEL[t.horizon] ?? t.horizon}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatNaira(t.entry_price)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{px != null ? formatNaira(px) : "—"}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{t.shares.toLocaleString()}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatNairaCompact(t.amount_ngn)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {pnl != null ? (
                          <div>
                            <span className={pnl >= 0 ? "font-semibold text-forest" : "font-semibold text-loss"}>
                              {pnl >= 0 ? "+" : ""}
                              {formatNairaCompact(pnl)}
                            </span>
                            <Delta value={pnlPct} showArrow={false} className="justify-end text-[10px]" />
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <button
                          onClick={() => closeTrade(t.id)}
                          disabled={closing === t.id}
                          className="inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1 font-sans text-[11px] font-semibold text-loss hover:bg-loss/10 disabled:opacity-50"
                        >
                          {closing === t.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {closed.length > 0 && (
        <Panel
          title="Closed positions"
          subtitle="Realised results"
          right={
            <button
              onClick={clearAllClosed}
              title="Delete all closed positions"
              className="inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1 font-sans text-[11px] font-semibold text-loss hover:bg-loss/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-[12.5px]">
              <thead>
                <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                  <th className="py-1.5 pr-2 font-medium">Stock</th>
                  <th className="py-1.5 pr-2 font-medium">Horizon</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Entry</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Close</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Shares</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Realised P&L</th>
                  <th className="py-1.5 pl-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone">
                {closed.map((t) => {
                  const pnl = t.close_price != null ? (t.close_price - t.entry_price) * t.shares : 0;
                  const pnlPct = t.close_price != null && t.entry_price > 0 ? ((t.close_price - t.entry_price) / t.entry_price) * 100 : null;
                  return (
                    <tr key={t.id} className="hover:bg-sand/50">
                      <td className="py-2 pr-2 font-semibold text-forest">{t.symbol}</td>
                      <td className="py-2 pr-2 text-ink/60">{HORIZON_LABEL[t.horizon] ?? t.horizon}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatNaira(t.entry_price)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{t.close_price != null ? formatNaira(t.close_price) : "—"}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{t.shares.toLocaleString()}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        <span className={pnl >= 0 ? "font-semibold text-forest" : "font-semibold text-loss"}>
                          {pnl >= 0 ? "+" : ""}
                          {formatNaira(pnl)}
                        </span>
                        <Delta value={pnlPct} showArrow={false} className="justify-end text-[10px]" />
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <button
                          onClick={() => deleteClosed(t.id)}
                          title="Delete this position"
                          aria-label={`Delete closed ${t.symbol} position`}
                          className="text-ink/30 hover:text-loss"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <ComplianceNote>
        Paper trades are a simulation for internal analysis only — no orders are placed. Prices are
        delayed up to 20 minutes during NGX hours. Past performance does not indicate future results;
        not investment advice.
      </ComplianceNote>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  const color = tone == null ? "text-forest" : tone >= 0 ? "text-forest" : "text-loss";
  return (
    <div className="rounded-xl border border-stone bg-surface px-3.5 py-3 shadow-card">
      <p className="font-sans text-[9.5px] font-semibold uppercase tracking-eyebrow text-ink/40">{label}</p>
      <p className={`mt-0.5 font-serif text-base font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
