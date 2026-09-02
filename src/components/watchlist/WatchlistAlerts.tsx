"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, RotateCw, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { formatNaira } from "@/lib/format";
import {
  fetchPriceAlerts,
  createPriceAlertReq,
  deletePriceAlertReq,
  rearmPriceAlertReq,
} from "@/lib/alerts/api";
import type { PriceAlert } from "@/lib/db/price-alerts";

interface SymbolOption {
  symbol: string;
  name: string;
  price: number | null;
}

export function WatchlistAlerts({
  watchlistId,
  symbols,
  focusSymbol,
  onFocusHandled,
}: {
  watchlistId: string;
  symbols: SymbolOption[];
  focusSymbol?: string | null;
  onFocusHandled?: () => void;
}) {
  const [alerts, setAlerts] = useState<PriceAlert[] | null>(null);
  const [sym, setSym] = useState("");
  const [buy, setBuy] = useState("");
  const [sell, setSell] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Scope the panel to THIS watchlist's alerts (the API returns all of the
  // user's alerts across watchlists).
  useEffect(() => {
    fetchPriceAlerts().then((all) =>
      setAlerts(all.filter((a) => a.watchlist_id === watchlistId))
    );
  }, [watchlistId]);

  // A row "Set alert" click pre-selects the symbol and scrolls the form in.
  useEffect(() => {
    if (!focusSymbol) return;
    setSym(focusSymbol);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    onFocusHandled?.();
  }, [focusSymbol, onFocusHandled]);

  const selected = useMemo(
    () => symbols.find((s) => s.symbol === sym) ?? null,
    [symbols, sym]
  );

  async function submit() {
    if (saving) return;
    setError(null);
    if (!sym) {
      setError("Pick a ticker.");
      return;
    }
    const b = buy.trim() ? Number(buy) : null;
    const s = sell.trim() ? Number(sell) : null;
    if (b == null && s == null) {
      setError("Enter a buy price, a sell price, or both.");
      return;
    }
    if ((b != null && !(b > 0)) || (s != null && !(s > 0))) {
      setError("Prices must be positive.");
      return;
    }
    if (b != null && s != null && s <= b) {
      setError("Sell target should be above the buy target.");
      return;
    }
    setSaving(true);
    const res = await createPriceAlertReq({
      symbol: sym,
      company_name: selected?.name ?? "",
      watchlist_id: watchlistId,
      buy_price: b,
      sell_price: s,
    });
    setSaving(false);
    if (!res.ok || !res.alert) {
      setError(res.error ?? "Couldn't save the alert.");
      return;
    }
    setAlerts((prev) => [res.alert!, ...(prev ?? [])]);
    setSym("");
    setBuy("");
    setSell("");
  }

  async function remove(id: string) {
    if (await deletePriceAlertReq(id)) {
      setAlerts((prev) => (prev ?? []).filter((a) => a.id !== id));
    }
  }

  async function rearm(id: string) {
    if (await rearmPriceAlertReq(id)) {
      setAlerts((prev) =>
        (prev ?? []).map((a) =>
          a.id === id ? { ...a, buy_triggered_at: null, sell_triggered_at: null, active: true } : a
        )
      );
    }
  }

  return (
    <Panel
      title="Price alerts"
      subtitle="Notify me at a buy or sell level"
      right={<BellRing className="h-4 w-4 text-forest-soft" />}
    >
      {/* Create form */}
      <div ref={formRef} className="space-y-2 rounded-lg border border-stone bg-sand/40 p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block font-sans text-[9px] uppercase tracking-eyebrow text-ink/45">
              Ticker
            </span>
            <select
              value={sym}
              onChange={(e) => setSym(e.target.value)}
              className="w-full rounded-md border border-stone bg-surface px-2 py-1.5 font-sans text-[13px] text-ink"
            >
              <option value="">Select…</option>
              {symbols.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol}
                  {s.price != null ? ` · ${formatNaira(s.price)}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block font-sans text-[9px] uppercase tracking-eyebrow text-fresh">
                Buy at ≤ ₦
              </span>
              <input
                inputMode="decimal"
                value={buy}
                onChange={(e) => setBuy(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border border-stone bg-surface px-2 py-1.5 font-sans text-[13px] tabular-nums text-ink"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-sans text-[9px] uppercase tracking-eyebrow text-loss">
                Sell at ≥ ₦
              </span>
              <input
                inputMode="decimal"
                value={sell}
                onChange={(e) => setSell(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border border-stone bg-surface px-2 py-1.5 font-sans text-[13px] tabular-nums text-ink"
              />
            </label>
          </div>
        </div>
        {selected?.price != null && (
          <p className="font-sans text-[10px] text-ink/45">
            {selected.symbol} last traded at {formatNaira(selected.price)}.
          </p>
        )}
        {error && <p className="font-sans text-[11px] text-loss">{error}</p>}
        <button
          onClick={submit}
          disabled={saving}
          className="rounded-md bg-forest px-3 py-1.5 font-sans text-[12px] font-semibold text-[#F5F2EC] hover:bg-forest/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Create alert"}
        </button>
      </div>

      {/* Existing alerts */}
      <div className="mt-3">
        {alerts == null ? (
          <div className="h-16 animate-pulse rounded bg-stone" />
        ) : alerts.length === 0 ? (
          <p className="py-4 text-center font-sans text-[12px] text-ink/45">
            No alerts yet. Set a buy or sell level above.
          </p>
        ) : (
          <ul className="divide-y divide-stone">
            {alerts.map((a) => (
              <AlertRow key={a.id} alert={a} onRemove={remove} onRearm={rearm} />
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 font-sans text-[10px] text-ink/40">
        Alerts check the latest available price every few minutes during market hours and notify you
        in the bell. Prices are delayed, not real-time — informational only, not investment advice.
      </p>
    </Panel>
  );
}

function AlertRow({
  alert: a,
  onRemove,
  onRearm,
}: {
  alert: PriceAlert;
  onRemove: (id: string) => void;
  onRearm: (id: string) => void;
}) {
  const fired = a.buy_triggered_at != null || a.sell_triggered_at != null;
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[13px] font-semibold text-forest">{a.symbol}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {a.buy_price != null && (
            <span className="font-sans text-[11px] tabular-nums text-ink/60">
              <span className="text-fresh">Buy ≤</span> {formatNaira(a.buy_price)}
              {a.buy_triggered_at && <span className="ml-1 text-ink/40">✓ hit</span>}
            </span>
          )}
          {a.sell_price != null && (
            <span className="font-sans text-[11px] tabular-nums text-ink/60">
              <span className="text-loss">Sell ≥</span> {formatNaira(a.sell_price)}
              {a.sell_triggered_at && <span className="ml-1 text-ink/40">✓ hit</span>}
            </span>
          )}
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-eyebrow ${
          fired ? "bg-stone text-ink/50" : "bg-fresh/15 text-forest-soft"
        }`}
      >
        {fired ? "Triggered" : "Armed"}
      </span>
      {fired && (
        <button
          onClick={() => onRearm(a.id)}
          className="text-ink/35 hover:text-forest"
          aria-label={`Re-arm ${a.symbol} alert`}
          title="Re-arm"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      )}
      <button
        onClick={() => onRemove(a.id)}
        className="text-ink/30 hover:text-loss"
        aria-label={`Delete ${a.symbol} alert`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
