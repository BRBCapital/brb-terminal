"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, Trash2, Plus, CalendarClock } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { CompanySearch } from "@/components/search/CompanySearch";
import { fetchProxy } from "@/lib/ngx/browser";
import { addAlertReq, deleteAlertReq } from "@/lib/portfolio/api";
import { formatNaira, formatPercent, formatDate } from "@/lib/format";
import type { ManageData } from "./useManageData";
import type { AlertKind } from "@/lib/db/transactions";
import type { UpcomingDividends, UpcomingDividend } from "@/lib/ngx/types";

const KIND_LABEL: Record<AlertKind, string> = {
  price_above: "Price rises above",
  price_below: "Price falls below",
  pct_move: "Daily move exceeds",
  ex_div: "Upcoming ex-dividend",
};

export function AlertsTab({ id, data }: { id: string; data: ManageData }) {
  const { alerts, quotes, reloadAlerts } = data;
  const [symbol, setSymbol] = useState("");
  const [kind, setKind] = useState<AlertKind>("price_above");
  const [threshold, setThreshold] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingDividend[]>([]);

  useEffect(() => {
    fetchProxy<UpcomingDividends>("dividends/upcoming").then((r) => {
      if (r.ok) setUpcoming(r.data.dividends);
    });
  }, []);

  const heldSymbols = useMemo(
    () => new Set(data.valued.map((v) => v.symbol)),
    [data.valued]
  );
  const exDivForHoldings = useMemo(
    () => upcoming.filter((u) => heldSymbols.has(u.symbol)),
    [upcoming, heldSymbols]
  );

  function evaluate(a: (typeof alerts)[number]): { triggered: boolean; detail: string } {
    const q = quotes[a.symbol];
    const price = q?.price ?? null;
    const prev = q?.prevClose ?? null;
    switch (a.kind) {
      case "price_above":
        return {
          triggered: price != null && a.threshold != null && price >= a.threshold,
          detail: `now ${formatNaira(price)}`,
        };
      case "price_below":
        return {
          triggered: price != null && a.threshold != null && price <= a.threshold,
          detail: `now ${formatNaira(price)}`,
        };
      case "pct_move": {
        const move = price != null && prev != null && prev > 0 ? ((price - prev) / prev) * 100 : null;
        return {
          triggered: move != null && a.threshold != null && Math.abs(move) >= a.threshold,
          detail: move != null ? `day ${formatPercent(move)}` : "—",
        };
      }
      case "ex_div": {
        const u = upcoming.find((x) => x.symbol === a.symbol);
        return {
          triggered: !!u,
          detail: u ? `ex ${formatDate(u.ex_dividend_date)} · ${formatNaira(u.dividend)}` : "none upcoming",
        };
      }
    }
  }

  async function submit() {
    setError(null);
    if (!symbol) {
      setError("Pick a stock.");
      return;
    }
    if (kind !== "ex_div" && !(Number(threshold) > 0)) {
      setError("Enter a threshold greater than zero.");
      return;
    }
    setBusy(true);
    const res = await addAlertReq(id, {
      symbol,
      kind,
      threshold: kind === "ex_div" ? null : Number(threshold),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Failed to add alert.");
      return;
    }
    setSymbol("");
    setThreshold("");
    await reloadAlerts();
  }

  return (
    <div className="space-y-4">
      {exDivForHoldings.length > 0 && (
        <div className="brb-callout flex items-start gap-2 rounded-r-lg bg-fresh/10 py-3">
          <CalendarClock className="mt-0.5 h-4 w-4 text-forest" />
          <div>
            <p className="font-sans text-[12px] font-semibold text-forest">
              Upcoming ex-dividends in your holdings
            </p>
            {exDivForHoldings.map((u) => (
              <p key={u.symbol + u.ex_dividend_date} className="font-sans text-[12px] text-ink/70">
                {u.symbol}: {u.type} {formatNaira(u.dividend)} · ex {formatDate(u.ex_dividend_date)}
                {u.yield != null ? ` · ${formatPercent(u.yield)}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}

      <Panel title="New alert" subtitle="Evaluated against the latest price each load">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
              Stock {symbol && <span className="text-forest">· {symbol}</span>}
            </label>
            <CompanySearch onSelect={(s) => setSymbol(s)} clearOnSelect placeholder="Search ticker…" />
          </div>
          <div>
            <label className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
              Condition
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as AlertKind)}
              className="w-full rounded-lg border border-stone px-2 py-1.5 font-sans text-sm outline-none focus:border-fresh"
            >
              {(Object.keys(KIND_LABEL) as AlertKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
              {kind === "pct_move" ? "Percent (%)" : kind === "ex_div" ? "—" : "Price (₦)"}
            </label>
            <input
              type="number"
              value={threshold}
              disabled={kind === "ex_div"}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full rounded-lg border border-stone px-2 py-1.5 text-right font-sans text-sm tabular-nums outline-none focus:border-fresh disabled:bg-stone/40"
            />
          </div>
        </div>
        {error && <p className="mt-2 font-sans text-[12px] text-loss">{error}</p>}
        <button
          onClick={submit}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-1 rounded-lg bg-fresh px-4 py-2 font-sans text-sm font-semibold text-forest hover:brightness-95 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> Add alert
        </button>
      </Panel>

      <Panel title="Active alerts" subtitle={`${alerts.length} configured`}>
        {alerts.length === 0 ? (
          <p className="py-6 text-center font-sans text-[13px] text-ink/55">
            No alerts yet.
          </p>
        ) : (
          <ul className="divide-y divide-stone">
            {alerts.map((a) => {
              const { triggered, detail } = evaluate(a);
              return (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  {triggered ? (
                    <BellRing className="h-4 w-4 text-fresh" />
                  ) : (
                    <Bell className="h-4 w-4 text-ink/30" />
                  )}
                  <div className="flex-1">
                    <p className="font-sans text-[13px] text-forest">
                      <span className="font-semibold">{a.symbol}</span> ·{" "}
                      {KIND_LABEL[a.kind]}
                      {a.threshold != null
                        ? ` ${a.kind === "pct_move" ? `${a.threshold}%` : formatNaira(a.threshold)}`
                        : ""}
                    </p>
                    <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                      {detail}
                    </p>
                  </div>
                  {triggered && (
                    <span className="rounded-full bg-fresh/20 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-eyebrow text-forest">
                      Triggered
                    </span>
                  )}
                  <button
                    onClick={async () => {
                      await deleteAlertReq(id, a.id);
                      await reloadAlerts();
                    }}
                    className="text-ink/30 hover:text-loss"
                    aria-label="Delete alert"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
