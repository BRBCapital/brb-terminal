"use client";

import { useMemo, useState } from "react";
import { Trash2, Plus, Sparkles, Download, AlertTriangle } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { CompanySearch } from "@/components/search/CompanySearch";
import { useNgx } from "@/hooks/useNgx";
import { fetchProxy } from "@/lib/ngx/browser";
import {
  addTransactionReq,
  bulkTransactionsReq,
  deleteTransactionReq,
} from "@/lib/portfolio/api";
import { formatNaira, formatNumber, formatDate } from "@/lib/format";
import { CsvExportButton } from "@/components/ui/ExportButtons";
import type { ManageData } from "./useManageData";
import type { TxKind, TransactionInput } from "@/lib/db/transactions";
import type { CompanyDividends } from "@/lib/ngx/types";

interface HolidaysPayload {
  holidays: Array<{ date: string; name: string }>;
}

// Format a Date as YYYY-MM-DD in LOCAL time. Using toISOString() here would
// convert to UTC and, in WAT (UTC+1), roll back to the previous day just after
// local midnight — mislabelling the trade date.
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Nearest trading day on/before a date, skipping weekends (holidays refined via
// the warning below once loaded).
function nearestTradingDay(from: Date): string {
  const d = new Date(from);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return toLocalISODate(d);
}

const TODAY = nearestTradingDay(new Date());

export function TransactionsTab({
  id,
  data,
}: {
  id: string;
  data: ManageData;
}) {
  const { transactions, portfolio, positions, quotes, reloadTx } = data;
  const [kind, setKind] = useState<TxKind>("buy");
  const [symbol, setSymbol] = useState("");
  const [date, setDate] = useState(TODAY);
  const [units, setUnits] = useState("");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [fees, setFees] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const holidaysQ = useNgx<HolidaysPayload>("market/holidays");
  const holidayMap = useMemo(() => {
    const m = new Map<string, string>();
    if (holidaysQ.data?.ok) holidaysQ.data.data.holidays.forEach((h) => m.set(h.date, h.name));
    return m;
  }, [holidaysQ.data]);

  function nonTradingReason(dateStr: string): string | null {
    if (!dateStr) return null;
    const day = new Date(dateStr + "T00:00:00").getDay();
    if (day === 0 || day === 6) return "a weekend — the NGX is closed";
    const holiday = holidayMap.get(dateStr);
    if (holiday) return `an NGX holiday (${holiday})`;
    return null;
  }
  const dateWarning = nonTradingReason(date);

  async function pickSymbol(sym: string) {
    setSymbol(sym);
    // Prefill price with the current quote when adding a buy/sell.
    const q = quotes[sym];
    if (q?.price != null && (kind === "buy" || kind === "sell")) {
      setPrice(String(q.price));
    } else {
      const res = await fetchProxy<{ current_price: number | null }>(`companies/${sym}`);
      if (res.ok && res.data.current_price != null && kind !== "dividend") {
        setPrice(String(res.data.current_price));
      }
    }
  }

  async function submit() {
    setError(null);
    setInfo(null);
    if (!symbol) {
      setError("Pick a stock.");
      return;
    }
    const input: TransactionInput = {
      symbol,
      kind,
      trade_date: date,
      units: Number(units) || 0,
      price: Number(price) || 0,
      amount: Number(amount) || 0,
      fees: Number(fees) || 0,
      notes,
    };
    setBusy(true);
    const res = await addTransactionReq(id, input);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Failed to add.");
      return;
    }
    setSymbol("");
    setUnits("");
    setPrice("");
    setAmount("");
    setFees("");
    setNotes("");
    await reloadTx();
  }

  async function initFromModel() {
    if (!portfolio) return;
    const seedDate = portfolio.created_at?.slice(0, 10) ?? TODAY;
    let seeds: TransactionInput[] = [];
    const isUnits = portfolio.holdings.some((h) => h.mode === "units");
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
      const totalStr = window.prompt(
        "Total amount invested (₦) to translate model weights into units:",
        "10000000"
      );
      const total = Number(totalStr);
      if (!(total > 0)) return;
      seeds = portfolio.holdings.map((h) => ({
        symbol: h.symbol,
        kind: "buy" as const,
        trade_date: seedDate,
        units: h.entry_price > 0 ? ((h.weight ?? 0) / 100) * total / h.entry_price : 0,
        price: h.entry_price,
        notes: "Initialized from model weights",
      }));
    }
    setBusy(true);
    const res = await bulkTransactionsReq(id, seeds);
    setBusy(false);
    if (res.ok) {
      setInfo(`Seeded ${res.count} opening buys from the model.`);
      await reloadTx();
    } else {
      setError(res.error ?? "Init failed.");
    }
  }

  // Suggest dividend income for open positions from each stock's payout history,
  // for ex-dates on/after the position's first buy that aren't already recorded.
  async function suggestDividends() {
    setBusy(true);
    setError(null);
    setInfo(null);
    const seeds: TransactionInput[] = [];
    for (const pos of positions) {
      if (pos.units <= 0 || !pos.firstDate) continue;
      const res = await fetchProxy<CompanyDividends>(`companies/${pos.symbol}/dividends`);
      if (!res.ok) continue;
      for (const d of res.data.dividends) {
        if (d.ex_dividend_date < pos.firstDate) continue;
        const already = transactions.some(
          (t) =>
            t.symbol === pos.symbol &&
            t.kind === "dividend" &&
            t.trade_date === d.ex_dividend_date
        );
        if (already) continue;
        seeds.push({
          symbol: pos.symbol,
          kind: "dividend",
          trade_date: d.ex_dividend_date,
          amount: (d.dividend ?? 0) * pos.units,
          notes: `${d.type} dividend ${formatNaira(d.dividend)}/sh × ${formatNumber(pos.units)}`,
        });
      }
    }
    if (!seeds.length) {
      setBusy(false);
      setInfo("No new dividends to add for current positions.");
      return;
    }
    const ok = window.confirm(
      `Add ${seeds.length} dividend receipt(s) inferred from payout history?`
    );
    if (!ok) {
      setBusy(false);
      return;
    }
    const res = await bulkTransactionsReq(id, seeds);
    setBusy(false);
    if (res.ok) {
      setInfo(`Added ${res.count} dividend receipt(s).`);
      await reloadTx();
    }
  }

  return (
    <div className="space-y-4">
      {/* Add form */}
      <Panel title="Record a transaction" subtitle="Buy · sell · dividend received">
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["buy", "sell", "dividend"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={
                  kind === k
                    ? "rounded-lg bg-forest px-3 py-1.5 font-sans text-[12px] font-semibold uppercase tracking-eyebrow text-[#F5F2EC]"
                    : "rounded-lg border border-stone px-3 py-1.5 font-sans text-[12px] font-semibold uppercase tracking-eyebrow text-ink/50 hover:bg-sand"
                }
              >
                {k}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                Stock {symbol && <span className="text-forest">· {symbol}</span>}
              </label>
              <CompanySearch onSelect={pickSymbol} clearOnSelect placeholder="Search ticker…" />
            </div>
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full rounded-lg border px-2 py-1.5 font-sans text-sm outline-none focus:border-fresh ${
                  dateWarning ? "border-amber-400" : "border-stone"
                }`}
              />
              {dateWarning && (
                <p className="mt-1 flex items-start gap-1 font-sans text-[10px] text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {date} is {dateWarning}.
                </p>
              )}
            </Field>
            {kind !== "dividend" ? (
              <>
                <Field label="Units">
                  <NumInput value={units} onChange={setUnits} />
                </Field>
                <Field label="Price (₦)">
                  <NumInput value={price} onChange={setPrice} />
                </Field>
                <Field label="Fees (₦)">
                  <NumInput value={fees} onChange={setFees} />
                </Field>
              </>
            ) : (
              <Field label="Amount (₦)">
                <NumInput value={amount} onChange={setAmount} />
              </Field>
            )}
          </div>

          {error && <p className="font-sans text-[12px] text-loss">{error}</p>}
          {info && <p className="font-sans text-[12px] text-forest-soft">{info}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={submit}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg bg-fresh px-4 py-2 font-sans text-sm font-semibold text-forest hover:brightness-95 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Add transaction
            </button>
            {transactions.length === 0 && portfolio && portfolio.holdings.length > 0 && (
              <button
                onClick={initFromModel}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg border border-stone px-4 py-2 font-sans text-sm font-semibold text-forest hover:bg-sand disabled:opacity-40"
              >
                <Download className="h-4 w-4" /> Initialize from model
              </button>
            )}
            {positions.some((p) => p.units > 0) && (
              <button
                onClick={suggestDividends}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg border border-stone px-4 py-2 font-sans text-sm font-semibold text-forest-soft hover:bg-sand disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" /> Suggest dividends
              </button>
            )}
          </div>
        </div>
      </Panel>

      {/* Ledger */}
      <Panel
        title="Ledger"
        subtitle={`${transactions.length} transactions`}
        right={
          <CsvExportButton
            rows={transactions}
            filename="transactions"
            columns={[
              { key: "trade_date", label: "Date" },
              { key: "symbol", label: "Symbol" },
              { key: "kind", label: "Type" },
              { key: "units", label: "Units" },
              { key: "price", label: "Price (NGN)" },
              { key: "fees", label: "Fees (NGN)" },
              { key: "amount", label: "Amount (NGN)" },
              { key: "notes", label: "Notes" },
            ]}
          />
        }
      >
        {transactions.length === 0 ? (
          <p className="py-6 text-center font-sans text-[13px] text-ink/55">
            No transactions yet.
          </p>
        ) : (
          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full text-left font-sans text-[13px]">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                  <th className="py-1.5 pr-2 font-medium">Date</th>
                  <th className="py-1.5 pr-2 font-medium">Stock</th>
                  <th className="py-1.5 pr-2 font-medium">Type</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Units</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Price/Amt</th>
                  <th className="py-1.5 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone">
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="py-1.5 pr-2 tabular-nums">{formatDate(t.trade_date)}</td>
                    <td className="py-1.5 pr-2 font-semibold text-forest">{t.symbol}</td>
                    <td className="py-1.5 pr-2">
                      <span
                        className={
                          t.kind === "buy"
                            ? "text-forest-soft"
                            : t.kind === "sell"
                            ? "text-loss"
                            : "text-ink/60"
                        }
                      >
                        {t.kind}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {t.kind === "dividend" ? "—" : formatNumber(t.units)}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {t.kind === "dividend"
                        ? formatNaira(t.amount)
                        : formatNaira(t.price)}
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        onClick={async () => {
                          await deleteTransactionReq(id, t.id);
                          await reloadTx();
                        }}
                        className="text-ink/30 hover:text-loss"
                        aria-label="Delete transaction"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
        {label}
      </label>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-stone px-2 py-1.5 text-right font-sans text-sm tabular-nums outline-none focus:border-fresh"
    />
  );
}
