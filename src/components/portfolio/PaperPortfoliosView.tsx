"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trash2, Briefcase, Layers } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { Delta } from "@/components/ui/Delta";
import { fetchProxy } from "@/lib/ngx/browser";
import { formatNaira, formatNairaCompact, formatDate } from "@/lib/format";
import type { CompanyDetail } from "@/lib/ngx/types";
import type { PaperPortfolioWithTrades } from "@/lib/db/paper-portfolios";

const HORIZON_LABEL: Record<string, string> = {
  intraday: "Intraday",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export function PaperPortfoliosView() {
  const [portfolios, setPortfolios] = useState<PaperPortfolioWithTrades[] | null>(null);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/paper-portfolios", { cache: "no-store" });
    if (!res.ok) {
      setPortfolios([]);
      return;
    }
    const body = await res.json();
    const list: PaperPortfolioWithTrades[] = body.ok ? body.portfolios : [];
    setPortfolios(list);
    const syms = [...new Set(list.flatMap((p) => p.trades.map((t) => t.symbol)))];
    const entries = await Promise.all(
      syms.map(async (sym) => {
        const r = await fetchProxy<CompanyDetail>(`companies/${sym}`);
        return [sym, r.ok ? r.data.current_price : null] as const;
      })
    );
    setPrices(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Delete via an inline confirm in the card (no fragile native window.confirm).
  // Optimistic, but reverts and surfaces an error if the server rejects it.
  async function remove(id: string) {
    setDeleting(id);
    setError(null);
    const snapshot = portfolios;
    setPortfolios((prev) => (prev ?? []).filter((p) => p.id !== id));
    try {
      const res = await fetch(`/api/paper-portfolios/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setPortfolios(snapshot);
        setError(body.error ?? `Could not delete the portfolio (HTTP ${res.status}).`);
      }
    } catch {
      setPortfolios(snapshot);
      setError("Could not reach the server.");
    } finally {
      setDeleting(null);
    }
  }

  if (portfolios === null) {
    return <div className="h-40 animate-pulse rounded-xl bg-stone" />;
  }

  if (portfolios.length === 0) {
    return (
      <Panel title="Paper trading portfolios" subtitle="AI-built books saved as tracked portfolios">
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Briefcase className="h-8 w-8 text-ink/30" />
          <p className="font-serif text-lg text-forest">No paper trading portfolios yet</p>
          <p className="max-w-md font-sans text-[13px] text-ink/55">
            Build a book in the <span className="font-semibold">AI Builder</span> tab, then click
            <span className="font-semibold"> Save as paper trading portfolio</span>. Each build is
            recorded separately here with live profit &amp; loss.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-sans text-[12px] text-ink/55">
          {portfolios.length} portfolio{portfolios.length === 1 ? "" : "s"} · each recorded separately
        </p>
        <button
          onClick={load}
          title="Refresh prices"
          className="inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1 font-sans text-[11px] text-forest hover:bg-sand"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 font-sans text-[12px] text-loss">
          {error}
        </p>
      )}

      {portfolios.map((p) => (
        <PortfolioCard
          key={p.id}
          p={p}
          prices={prices}
          deleting={deleting === p.id}
          onDelete={() => remove(p.id)}
        />
      ))}

      <div className="brb-callout py-2">
        <p className="font-sans text-[11px] leading-relaxed text-ink/55">
          Paper trading portfolios are a simulation for internal analysis only — no orders are placed.
          Prices are delayed up to 20 minutes during NGX hours. Past performance does not indicate future
          results; not investment advice.
        </p>
      </div>
    </div>
  );
}

function PortfolioCard({
  p,
  prices,
  deleting,
  onDelete,
}: {
  p: PaperPortfolioWithTrades;
  prices: Record<string, number | null>;
  deleting: boolean;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  let invested = 0;
  let current = 0;
  let priced = 0;
  for (const t of p.trades) {
    invested += t.amount_ngn;
    const px = prices[t.symbol];
    if (px != null) {
      current += px * t.shares;
      priced += 1;
    }
  }
  const pnl = priced > 0 ? current - invested * (priced / p.trades.length) : null;
  const pnlPct = pnl != null && invested > 0 ? (pnl / (invested * (priced / p.trades.length))) * 100 : null;

  return (
    <Panel
      title={p.name}
      subtitle={`${HORIZON_LABEL[p.horizon] ?? p.horizon} · ${p.trades.length} position${p.trades.length === 1 ? "" : "s"} · saved ${formatDate(p.created_at)}`}
      right={
        confirming ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="font-sans text-[11px] text-ink/60">Delete?</span>
            <button
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
              disabled={deleting}
              className="inline-flex items-center gap-1 rounded-md bg-loss px-2 py-1 font-sans text-[11px] font-semibold text-white hover:bg-loss/90 disabled:opacity-50"
            >
              {deleting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Confirm
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-md border border-stone px-2 py-1 font-sans text-[11px] text-ink/60 hover:bg-sand"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            disabled={deleting}
            title="Delete this portfolio"
            className="inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1 font-sans text-[11px] font-semibold text-loss hover:bg-loss/10 disabled:opacity-50"
          >
            {deleting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </button>
        )
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Positions" value={String(p.trades.length)} icon={<Layers className="h-3 w-3" />} />
          <Stat label="Invested" value={formatNairaCompact(invested)} />
          <Stat label="Current value" value={priced > 0 ? formatNairaCompact(current) : "—"} />
          <Stat
            label={`Unrealised P&L${priced < p.trades.length ? " *" : ""}`}
            value={pnl != null ? formatNaira(pnl) : "—"}
            tone={pnl ?? undefined}
            delta={pnlPct}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-[12.5px]">
            <thead>
              <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                <th className="py-1.5 pr-2 font-medium">Stock</th>
                <th className="py-1.5 pr-2 text-right font-medium">Entry</th>
                <th className="py-1.5 pr-2 text-right font-medium">Now</th>
                <th className="py-1.5 pr-2 text-right font-medium">Shares</th>
                <th className="py-1.5 pr-2 text-right font-medium">Invested</th>
                <th className="py-1.5 text-right font-medium">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone">
              {p.trades.map((t) => {
                const px = prices[t.symbol] ?? null;
                const rowPnl = px != null ? (px - t.entry_price) * t.shares : null;
                const rowPct = px != null && t.entry_price > 0 ? ((px - t.entry_price) / t.entry_price) * 100 : null;
                return (
                  <tr key={t.id} className="hover:bg-sand/50">
                    <td className="py-2 pr-2">
                      <p className="font-semibold text-forest">{t.symbol}</p>
                      <p className="text-[10px] uppercase tracking-eyebrow text-ink/40">{t.sector}</p>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatNaira(t.entry_price)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{px != null ? formatNaira(px) : "—"}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{t.shares.toLocaleString()}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatNairaCompact(t.amount_ngn)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {rowPnl != null ? (
                        <div>
                          <span className={rowPnl >= 0 ? "font-semibold text-forest" : "font-semibold text-loss"}>
                            {rowPnl >= 0 ? "+" : ""}
                            {formatNairaCompact(rowPnl)}
                          </span>
                          <Delta value={rowPct} showArrow={false} className="justify-end text-[10px]" />
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {priced < p.trades.length && (
          <p className="font-sans text-[10px] text-ink/40">* Some live prices unavailable; excluded from unrealised P&amp;L.</p>
        )}
      </div>
    </Panel>
  );
}

function Stat({
  label,
  value,
  tone,
  delta,
  icon,
}: {
  label: string;
  value: string;
  tone?: number;
  delta?: number | null;
  icon?: React.ReactNode;
}) {
  const color = tone == null ? "text-forest" : tone >= 0 ? "text-forest" : "text-loss";
  return (
    <div className="rounded-xl border border-stone bg-surface px-3.5 py-3 shadow-card">
      <p className="flex items-center gap-1 font-sans text-[9.5px] font-semibold uppercase tracking-eyebrow text-ink/40">
        {icon}
        {label}
      </p>
      <p className={`mt-0.5 font-serif text-base font-semibold tabular-nums ${color}`}>{value}</p>
      {delta != null && <Delta value={delta} showArrow={false} className="text-[10px]" />}
    </div>
  );
}
