"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2, Scale, AlertTriangle, Save } from "lucide-react";
import { useNgx } from "@/hooks/useNgx";
import { fetchProxy } from "@/lib/ngx/browser";
import { CompanySearch } from "@/components/search/CompanySearch";
import { SectorDonut } from "./SectorDonut";
import { TickerBadge } from "@/components/ui/TickerBadge";
import { Delta } from "@/components/ui/Delta";
import {
  formatNaira,
  formatNumber,
  formatPercent,
  formatNairaCompact,
} from "@/lib/format";
import { computeMetrics, type EnrichedHolding } from "@/lib/portfolio/metrics";
import { validatePortfolio } from "@/lib/portfolio/validate";
import { savePortfolio } from "@/lib/portfolio/api";
import type {
  CompanyDetail,
  ForexCurrent,
  IndexSummary,
  Paginated,
} from "@/lib/ngx/types";
import type {
  HoldingMode,
  PortfolioWithHoldings,
} from "@/lib/db/portfolios";

export function PortfolioBuilder({
  initial,
}: {
  initial?: PortfolioWithHoldings;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const seededRef = useRef(false);

  const [name, setName] = useState(initial?.name ?? "");
  const [notes, setNotes] = useState(initial?.mandate_notes ?? "");
  const [benchmark, setBenchmark] = useState(initial?.benchmark_symbol ?? "ASI");
  const [currency, setCurrency] = useState<"NGN" | "USD">(
    (initial?.base_currency as "NGN" | "USD") ?? "NGN"
  );
  const [mode, setMode] = useState<HoldingMode>(
    (initial?.holdings[0]?.mode as HoldingMode) ?? "weight"
  );
  const [holdings, setHoldings] = useState<EnrichedHolding[]>(
    initial?.holdings.map((h) => ({
      symbol: h.symbol,
      company_name: h.company_name,
      sector: h.sector,
      mode: h.mode,
      weight: h.weight,
      units: h.units,
      entry_price: h.entry_price,
    })) ?? []
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const indicesQ = useNgx<Paginated<IndexSummary>>("indices", {
    query: { limit: 50 },
  });
  const indices = indicesQ.data?.ok ? indicesQ.data.data.data : [];

  const fxQ = useNgx<ForexCurrent>("forex/current");
  const usdRate = useMemo(() => {
    if (!fxQ.data?.ok) return null;
    return fxQ.data.data.rates.find((r) => r.currency === "USD")?.rate ?? null;
  }, [fxQ.data]);

  // Enrich any holding missing live metrics (e.g. loaded from an existing
  // portfolio) so analytics have div yield / EPS / current price.
  useEffect(() => {
    const missing = holdings.filter((h) => h.current_price === undefined);
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      for (const h of missing) {
        const res = await fetchProxy<CompanyDetail>(`companies/${h.symbol}`);
        if (cancelled) return;
        if (res.ok) {
          setHoldings((cur) =>
            cur.map((x) =>
              x.symbol === h.symbol
                ? {
                    ...x,
                    company_name: x.company_name || res.data.name,
                    sector: x.sector || res.data.sector,
                    current_price: res.data.current_price,
                    dividend_yield: res.data.dividend_yield,
                    ttm_eps: res.data.ttm_eps,
                  }
                : x
            )
          );
        } else {
          // Mark as enriched-attempted so we don't loop forever.
          setHoldings((cur) =>
            cur.map((x) =>
              x.symbol === h.symbol ? { ...x, current_price: null } : x
            )
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [holdings]);

  // Seed holdings from a screener push (/portfolios/new?symbols=A,B,C).
  useEffect(() => {
    if (initial || seededRef.current) return;
    const raw = searchParams.get("symbols");
    if (!raw) return;
    seededRef.current = true;
    const syms = raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 30);
    syms.forEach((s) => void addHolding(s, s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, initial]);

  async function addHolding(symbol: string, name: string) {
    if (holdings.some((h) => h.symbol === symbol)) return;
    // Optimistic row; enrichment effect fills metrics + price.
    setHoldings((cur) => [
      ...cur,
      {
        symbol,
        company_name: name,
        sector: "",
        mode,
        weight: mode === "weight" ? 0 : null,
        units: mode === "units" ? 0 : null,
        entry_price: 0,
        current_price: undefined,
      },
    ]);
    const res = await fetchProxy<CompanyDetail>(`companies/${symbol}`);
    if (res.ok) {
      setHoldings((cur) =>
        cur.map((x) =>
          x.symbol === symbol
            ? {
                ...x,
                company_name: res.data.name,
                sector: res.data.sector,
                entry_price: res.data.current_price ?? 0,
                current_price: res.data.current_price,
                dividend_yield: res.data.dividend_yield,
                ttm_eps: res.data.ttm_eps,
              }
            : x
        )
      );
    }
  }

  function update(symbol: string, patch: Partial<EnrichedHolding>) {
    setHoldings((cur) =>
      cur.map((h) => (h.symbol === symbol ? { ...h, ...patch } : h))
    );
  }
  function remove(symbol: string) {
    setHoldings((cur) => cur.filter((h) => h.symbol !== symbol));
  }
  function switchMode(next: HoldingMode) {
    setMode(next);
    setHoldings((cur) =>
      cur.map((h) => ({
        ...h,
        mode: next,
        weight: next === "weight" ? (h.weight ?? 0) : null,
        units: next === "units" ? (h.units ?? 0) : null,
      }))
    );
  }
  function distributeEvenly() {
    if (mode !== "weight" || holdings.length === 0) return;
    const w = Math.round((100 / holdings.length) * 100) / 100;
    setHoldings((cur) => cur.map((h, i) => ({
      ...h,
      // Push rounding remainder onto the first row so the sum is exactly 100.
      weight: i === 0 ? Number((100 - w * (cur.length - 1)).toFixed(2)) : w,
    })));
  }

  const metrics = useMemo(() => computeMetrics(holdings), [holdings]);
  const issues = useMemo(
    () =>
      validatePortfolio({
        name,
        holdings: holdings.map((h) => ({
          symbol: h.symbol,
          sector: h.sector,
          mode: h.mode,
          weight: h.weight,
          units: h.units,
          entry_price: h.entry_price,
        })),
      }),
    [name, holdings]
  );
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  const toDisplay = (naira: number) =>
    currency === "USD" && usdRate ? naira / usdRate : naira;
  const cur = currency === "USD" ? "$" : "₦";

  async function onSave() {
    setSaving(true);
    setSaveError(null);
    const res = await savePortfolio(
      {
        name,
        mandate_notes: notes,
        benchmark_symbol: benchmark,
        base_currency: currency,
        holdings: holdings.map((h) => ({
          symbol: h.symbol,
          company_name: h.company_name,
          sector: h.sector,
          mode: h.mode,
          weight: h.weight,
          units: h.units,
          entry_price: h.entry_price,
        })),
      },
      initial?.id
    );
    setSaving(false);
    if (res.ok && res.portfolio) {
      router.push(`/portfolios/${res.portfolio.id}`);
      router.refresh();
    } else {
      setSaveError(res.error ?? "Save failed.");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Left: mandate + holdings */}
      <div className="space-y-4 lg:col-span-2">
        <div className="brb-card space-y-3 p-4">
          <div>
            <label className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
              Portfolio name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nigeria Core Equity"
              className="w-full rounded-lg border border-stone px-3 py-2 font-sans text-sm outline-none focus:border-fresh"
            />
          </div>
          <div>
            <label className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
              Mandate notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Objective, constraints, risk profile…"
              className="w-full rounded-lg border border-stone px-3 py-2 font-sans text-sm outline-none focus:border-fresh"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                Benchmark
              </label>
              <select
                value={benchmark}
                onChange={(e) => setBenchmark(e.target.value)}
                className="rounded-lg border border-stone px-3 py-1.5 font-sans text-sm outline-none focus:border-fresh"
              >
                <option value="ASI">NGX All-Share Index (ASI)</option>
                {indices
                  .filter((i) => i.symbol !== "ASI")
                  .map((i) => (
                    <option key={i.symbol} value={i.symbol}>
                      {i.index_name} ({i.symbol})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                Currency view
              </label>
              <div className="flex overflow-hidden rounded-lg border border-stone text-sm">
                {(["NGN", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    disabled={c === "USD" && !usdRate}
                    className={
                      currency === c
                        ? "bg-forest px-3 py-1.5 text-[#F5F2EC]"
                        : "bg-surface px-3 py-1.5 text-ink/50 hover:bg-sand disabled:opacity-40"
                    }
                  >
                    {c === "NGN" ? "₦ NGN" : "$ USD"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                Allocation mode
              </label>
              <div className="flex overflow-hidden rounded-lg border border-stone text-sm">
                {(["weight", "units"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={
                      mode === m
                        ? "bg-forest px-3 py-1.5 text-[#F5F2EC]"
                        : "bg-surface px-3 py-1.5 text-ink/50 hover:bg-sand"
                    }
                  >
                    {m === "weight" ? "% Weight" : "# Units"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Add holding */}
        <div className="brb-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-sans text-[12px] font-semibold uppercase tracking-eyebrow text-forest">
              Holdings ({holdings.length})
            </p>
            {mode === "weight" && holdings.length > 0 && (
              <button
                onClick={distributeEvenly}
                className="inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1 font-sans text-[11px] text-forest-soft hover:bg-sand"
              >
                <Scale className="h-3 w-3" /> Even split
              </button>
            )}
          </div>
          <div className="mb-3 max-w-md">
            <CompanySearch
              onSelect={addHolding}
              clearOnSelect
              placeholder="Add a holding — search ticker or name…"
            />
          </div>

          {holdings.length === 0 ? (
            <p className="py-6 text-center font-sans text-[12px] text-ink/40">
              No holdings yet. Search above or start from the{" "}
              <a href="/screener" className="text-forest-soft underline">
                screener
              </a>
              .
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-[13px]">
                <thead>
                  <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                    <th className="py-1.5 pr-2 font-medium">Stock</th>
                    <th className="py-1.5 pr-2 text-right font-medium">
                      Entry ({cur})
                    </th>
                    <th className="py-1.5 pr-2 text-right font-medium">
                      {mode === "weight" ? "Weight %" : "Units"}
                    </th>
                    <th className="py-1.5 pr-2 text-right font-medium">Eff. %</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Yield</th>
                    <th className="py-1.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone">
                  {holdings.map((h) => {
                    const eff =
                      metrics.weights.find((w) => w.symbol === h.symbol)?.pct ?? 0;
                    const over = eff > 10;
                    return (
                      <tr key={h.symbol}>
                        <td className="py-1.5 pr-2">
                          <div className="flex items-center gap-2">
                            <TickerBadge symbol={h.symbol} size={22} />
                            <div className="min-w-0">
                              <p className="font-semibold text-forest">{h.symbol}</p>
                              <p className="truncate text-[10px] text-ink/45">
                                {h.sector || "…"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-1.5 pr-2 text-right">
                          <input
                            type="number"
                            value={
                              currency === "USD" && usdRate
                                ? Number((h.entry_price / usdRate).toFixed(4))
                                : h.entry_price
                            }
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              const naira =
                                currency === "USD" && usdRate ? v * usdRate : v;
                              update(h.symbol, { entry_price: naira });
                            }}
                            className="w-24 rounded border border-stone px-2 py-1 text-right tabular-nums outline-none focus:border-fresh"
                          />
                        </td>
                        <td className="py-1.5 pr-2 text-right">
                          <input
                            type="number"
                            value={
                              mode === "weight"
                                ? h.weight ?? 0
                                : h.units ?? 0
                            }
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              update(
                                h.symbol,
                                mode === "weight"
                                  ? { weight: v }
                                  : { units: v }
                              );
                            }}
                            className="w-20 rounded border border-stone px-2 py-1 text-right tabular-nums outline-none focus:border-fresh"
                          />
                        </td>
                        <td
                          className={`py-1.5 pr-2 text-right tabular-nums ${
                            over ? "font-semibold text-loss" : "text-ink/70"
                          }`}
                        >
                          {formatPercent(eff)}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-ink/60">
                          {h.dividend_yield != null
                            ? formatPercent(h.dividend_yield)
                            : "—"}
                        </td>
                        <td className="py-1.5 text-right">
                          <button
                            onClick={() => remove(h.symbol)}
                            className="text-ink/30 hover:text-loss"
                            aria-label={`Remove ${h.symbol}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right: live analytics + validation + save */}
      <div className="space-y-4">
        <div className="brb-card p-4">
          <p className="mb-3 font-sans text-[12px] font-semibold uppercase tracking-eyebrow text-forest">
            Portfolio metrics
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Metric
              label={mode === "weight" ? "Weight sum" : "Invested"}
              value={
                mode === "weight"
                  ? formatPercent(metrics.weightSum)
                  : `${cur}${formatNumber(
                      toDisplay(metrics.investedValue ?? 0),
                      0
                    )}`
              }
              tone={
                mode === "weight" && Math.abs(metrics.weightSum - 100) > 0.1
                  ? "warn"
                  : "ok"
              }
            />
            <Metric
              label="Holdings"
              value={String(holdings.length)}
            />
            <Metric
              label="Wtd. div yield"
              value={
                metrics.weightedDividendYield != null
                  ? formatPercent(metrics.weightedDividendYield)
                  : "—"
              }
            />
            <Metric
              label="Wtd. P/E"
              value={
                metrics.weightedPE != null
                  ? `${metrics.weightedPE.toFixed(1)}×`
                  : "—"
              }
            />
          </div>
        </div>

        <div className="brb-card p-4">
          <p className="mb-3 font-sans text-[12px] font-semibold uppercase tracking-eyebrow text-forest">
            Sector allocation
          </p>
          <SectorDonut data={metrics.sectorAllocation} />
        </div>

        {/* Validation */}
        {(errors.length > 0 || warnings.length > 0) && (
          <div className="brb-card space-y-2 p-4">
            {errors.map((e, i) => (
              <p key={`e${i}`} className="flex items-start gap-2 font-sans text-[12px] text-loss">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {e.message}
              </p>
            ))}
            {warnings.map((w, i) => (
              <p key={`w${i}`} className="flex items-start gap-2 font-sans text-[12px] text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {w.message}
              </p>
            ))}
          </div>
        )}

        {saveError && (
          <p className="font-sans text-[12px] text-loss">{saveError}</p>
        )}
        <button
          onClick={onSave}
          disabled={saving || errors.length > 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-fresh px-4 py-2.5 font-sans text-sm font-semibold text-forest transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : initial ? "Update portfolio" : "Save portfolio"}
        </button>
        <p className="font-sans text-[10px] leading-relaxed text-ink/45">
          Model portfolio for internal analysis. Concentration thresholds
          (single-stock 10%, sector 30%) are advisory. Not investment advice; past
          performance does not indicate future results.
        </p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-xl border border-stone bg-surface px-3.5 py-3 shadow-card">
      <p className="font-sans text-[9.5px] font-semibold uppercase tracking-eyebrow text-ink/40">
        {label}
      </p>
      <p
        className={`mt-0.5 font-serif text-base font-semibold tabular-nums ${
          tone === "warn" ? "text-loss" : "text-forest"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
