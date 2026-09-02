import "server-only";
import { ngxFetch } from "@/lib/ngx/client";
import type { IndexChart, IndexSummary } from "@/lib/ngx/types";
import { computeRegime, exposureMultFor, resolveEffectiveState, type RegimeInputs, type RegimeState } from "./regime";

// ── Walk-forward regime backtest ──────────────────────────────────────────
// Replays the regime decision over the REAL NGX All-Share index history and
// compares two equity curves on the index's own returns:
//   • baseline  — always fully invested (buy & hold the market)
//   • overlay   — invested at the regime's exposure, decided from data up to the
//                 PRIOR day (no look-ahead); un-deployed capital earns 0.
// Honest simplifications (stated in the UI): breadth is neutral historically
// (live regime also uses breadth), cash earns 0, and it runs at the index level.

export interface CurveStats {
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  sharpe: number;
}
export interface BacktestResult {
  from: string;
  to: string;
  tradingDays: number;
  dwell: number;
  baseline: CurveStats;
  overlay: CurveStats;
  ddReductionPct: number; // how much the overlay cut the worst drawdown
  returnCapturePct: number; // overlay total return as % of baseline (upside kept)
  pctDeRisked: number; // share of days the overlay was below full exposure
  equity: { date: string; base: number; overlay: number; exposure: number }[];
  windows: { label: string; from: string; to: string; base: CurveStats; overlay: CurveStats }[];
  note: string;
}

// ── pure math (unit-tested) ────────────────────────────────────────────────
export function curveStats(returns: number[]): CurveStats & { equity: number[] } {
  let eq = 1, peak = 1, maxDD = 0;
  const equity: number[] = [];
  for (const r of returns) {
    eq *= 1 + r;
    equity.push(eq);
    peak = Math.max(peak, eq);
    if (peak > 0) maxDD = Math.max(maxDD, (peak - eq) / peak);
  }
  const n = returns.length || 1;
  const mean = returns.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(returns.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  return {
    totalReturn: eq - 1,
    cagr: returns.length > 0 ? Math.pow(eq, 252 / returns.length) - 1 : 0,
    maxDrawdown: maxDD,
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(252) : 0,
    equity,
  };
}

const pctRet = (px: number[], i: number, k: number) =>
  i - k >= 0 && px[i - k] > 0 ? ((px[i] - px[i - k]) / px[i - k]) * 100 : 0;

interface Series {
  dates: string[];
  value: number[]; // index level
  dailyPct: number[]; // daily % change
}

function inputsAt(s: Series, i: number, fxByDate: Record<string, number>): RegimeInputs {
  const trailing = s.dailyPct.slice(Math.max(0, i - 19), i + 1);
  const avgAbsDailyPct = trailing.length ? trailing.reduce((a, b) => a + Math.abs(b), 0) / trailing.length : 1.2;
  return {
    asiTodayPct: s.dailyPct[i] ?? 0,
    asi7dPct: pctRet(s.value, i, 5),
    asiYtdPct: pctRet(s.value, i, 120), // long-horizon momentum proxy
    advancers: 50, // breadth unavailable historically → neutral
    decliners: 50,
    pctPositive1m: 0.5,
    pctUpperRange: 0.5,
    avgAbsDailyPct,
    dispersionPct: 1.8,
    fxDailyPct: fxByDate[s.dates[i]] ?? 0,
  };
}

const WARMUP = 120;

export function runBacktest(series: Series, fxByDate: Record<string, number>, dwell: number): BacktestResult {
  const n = series.dates.length;
  const start = Math.min(WARMUP, Math.max(0, n - 30));

  // Decide exposure each day from data up to that day; apply to the NEXT day.
  const exposureByDay: number[] = new Array(n).fill(1);
  const stateHistory: RegimeState[] = [];
  for (let i = start; i < n; i++) {
    const snap = computeRegime(inputsAt(series, i, fxByDate));
    const eff = resolveEffectiveState(snap.state, stateHistory, dwell);
    stateHistory.push(eff);
    exposureByDay[i] = eff === "CRISIS" ? 0 : exposureMultFor(eff, snap.score);
  }

  const dates: string[] = [];
  const baseRets: number[] = [];
  const ovlRets: number[] = [];
  for (let i = start + 1; i < n; i++) {
    const r = (series.dailyPct[i] ?? 0) / 100;
    dates.push(series.dates[i]);
    baseRets.push(r);
    ovlRets.push(exposureByDay[i - 1] * r); // exposure from the prior close (no look-ahead)
  }

  const base = curveStats(baseRets);
  const ovl = curveStats(ovlRets);

  // Down-sample the equity curves for charting (~180 points).
  const step = Math.max(1, Math.floor(dates.length / 180));
  const equity = [];
  for (let i = 0; i < dates.length; i += step) {
    equity.push({ date: dates[i], base: round(base.equity[i]), overlay: round(ovl.equity[i]), exposure: exposureByDay[start + i] });
  }

  // Focus windows: the FX-reset bear markets.
  const windows = [
    windowStats("2016 FX float", "2016-01-01", "2016-12-31", series, exposureByDay, start),
    windowStats("2020 COVID crash", "2020-02-01", "2020-06-30", series, exposureByDay, start),
    windowStats("2023 FX unification", "2023-05-01", "2024-03-31", series, exposureByDay, start),
  ].filter(Boolean) as BacktestResult["windows"];

  const pctDeRisked = dates.length ? exposureByDay.slice(start, n - 1).filter((e) => e < 0.999).length / dates.length : 0;

  return {
    from: dates[0] ?? "",
    to: dates[dates.length - 1] ?? "",
    tradingDays: dates.length,
    dwell,
    baseline: strip(base),
    overlay: strip(ovl),
    ddReductionPct: base.maxDrawdown > 0 ? (base.maxDrawdown - ovl.maxDrawdown) / base.maxDrawdown : 0,
    returnCapturePct: Math.abs(base.totalReturn) > 1e-9 ? ovl.totalReturn / base.totalReturn : 0,
    pctDeRisked,
    equity,
    windows,
    note: "Index-level replay on real NGX All-Share history. Exposure decided from data up to the prior day (no look-ahead); un-deployed capital earns 0%. Breadth is neutral historically (the live regime also uses breadth). Illustrative, not a promise of future results.",
  };
}

function windowStats(label: string, from: string, to: string, s: Series, exposureByDay: number[], start: number) {
  const base: number[] = [];
  const ovl: number[] = [];
  for (let i = start + 1; i < s.dates.length; i++) {
    if (s.dates[i] < from || s.dates[i] > to) continue;
    const r = (s.dailyPct[i] ?? 0) / 100;
    base.push(r);
    ovl.push(exposureByDay[i - 1] * r);
  }
  if (base.length < 5) return null;
  return { label, from, to, base: strip(curveStats(base)), overlay: strip(curveStats(ovl)) };
}

const round = (x: number) => Math.round(x * 10000) / 10000;
const strip = (c: CurveStats & { equity?: number[] }): CurveStats => ({ totalReturn: c.totalReturn, cagr: c.cagr, maxDrawdown: c.maxDrawdown, sharpe: c.sharpe });

// ── live data assembly ──────────────────────────────────────────────────────
function parseFxHistory(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const rows = Array.isArray(raw) ? raw : ((raw as { data?: unknown[] })?.data ?? (raw as { rates?: unknown[] })?.rates ?? []);
  if (!Array.isArray(rows)) return out;
  for (const r of rows as Record<string, unknown>[]) {
    const date = String(r.date ?? r.day ?? "").slice(0, 10);
    const chg = Number(r.daily_change_percent ?? r.change_percent ?? 0);
    if (date && isFinite(chg)) out[date] = chg;
  }
  return out;
}

export async function gatherBacktest(years: number, dwell: number): Promise<BacktestResult> {
  // Find the All-Share index symbol/id.
  const idxList = await ngxFetch<IndexSummary[]>({ path: "indices" });
  let idxSym = "ASI";
  if (idxList.ok && Array.isArray(idxList.data)) {
    const asi = idxList.data.find((x) => /all.?share|ASI/i.test(x.index_name) || /ASI/i.test(x.symbol));
    if (asi?.symbol) idxSym = asi.symbol;
  }

  const [chartRes, fxRes] = await Promise.all([
    ngxFetch<IndexChart>({ path: `indices/${idxSym}/chart`, query: `period=${years >= 10 ? "MAX" : years + "Y"}` }),
    ngxFetch<unknown>({ path: "forex/history", query: "currency=USD" }),
  ]);
  if (!chartRes.ok || !chartRes.data?.data?.length) {
    throw new Error("Index history unavailable from the market API.");
  }

  const rows = [...chartRes.data.data].sort((a, b) => (a.date < b.date ? -1 : 1));
  const cutoff = years >= 100 ? "0000" : `${new Date().getUTCFullYear() - years}-01-01`;
  const kept = rows.filter((r) => r.date >= cutoff && r.index_value > 0);
  const series: Series = {
    dates: kept.map((r) => r.date),
    value: kept.map((r) => r.index_value),
    dailyPct: kept.map((r) => Number(r.daily_change_percent ?? 0)),
  };
  const fxByDate = fxRes.ok ? parseFxHistory(fxRes.data) : {};
  return runBacktest(series, fxByDate, dwell);
}
