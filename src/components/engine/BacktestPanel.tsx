"use client";

import { useState } from "react";
import { FlaskConical, RefreshCw, TrendingDown, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/ui/Tile";

interface Stats { totalReturn: number; cagr: number; maxDrawdown: number; sharpe: number }
interface Win { label: string; from: string; to: string; base: Stats; overlay: Stats }
interface Result {
  ok: boolean; from: string; to: string; tradingDays: number; dwell: number;
  baseline: Stats; overlay: Stats; ddReductionPct: number; returnCapturePct: number; pctDeRisked: number;
  equity: { date: string; base: number; overlay: number; exposure: number }[]; windows: Win[]; note: string; error?: string;
}

const pct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
const pctAbs = (v: number) => `${(v * 100).toFixed(1)}%`;
const tone = (v: number) => (v > 0 ? "text-forest" : v < 0 ? "text-loss" : "text-ink/60");

function EquityChart({ eq }: { eq: Result["equity"] }) {
  if (eq.length < 2) return null;
  const w = 100, h = 40;
  const all = eq.flatMap((p) => [p.base, p.overlay]).filter((x) => x > 0);
  const lo = Math.min(...all), hi = Math.max(...all);
  const lgLo = Math.log(lo), lgHi = Math.log(hi) || 1;
  const x = (i: number) => (i / (eq.length - 1)) * w;
  const y = (v: number) => h - ((Math.log(Math.max(v, lo)) - lgLo) / (lgHi - lgLo || 1)) * h;
  const path = (key: "base" | "overlay") => eq.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(p[key]).toFixed(2)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="Backtest equity: baseline vs regime overlay (log scale)">
      <path d={path("base")} className="stroke-ink/35" fill="none" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <path d={path("overlay")} className="stroke-forest" fill="none" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function StatCol({ title, s, dim }: { title: string; s: Stats; dim?: boolean }) {
  return (
    <div className={`rounded-xl border border-stone bg-surface p-3 ${dim ? "opacity-90" : ""}`}>
      <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">{title}</p>
      <dl className="mt-1.5 space-y-1 font-sans text-[12px]">
        <div className="flex justify-between"><dt className="text-ink/50">Total return</dt><dd className={`tabular-nums ${tone(s.totalReturn)}`}>{pct(s.totalReturn)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink/50">CAGR</dt><dd className={`tabular-nums ${tone(s.cagr)}`}>{pct(s.cagr)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink/50">Max drawdown</dt><dd className="tabular-nums text-loss">−{pctAbs(s.maxDrawdown)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink/50">Sharpe</dt><dd className="tabular-nums text-ink/80">{s.sharpe.toFixed(2)}</dd></div>
      </dl>
    </div>
  );
}

export function BacktestPanel() {
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [years, setYears] = useState(10);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/engine/backtest?years=${years}`, { cache: "no-store" });
      const body = await res.json();
      if (body.ok) setData(body as Result);
      else setErr(body.error ?? "Backtest failed.");
    } catch {
      setErr("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel
      title="Regime backtest"
      subtitle="Walk-forward replay on real NGX index history — does the regime overlay preserve capital?"
      right={
        <div className="flex items-center gap-2">
          <select value={years} onChange={(e) => setYears(Number(e.target.value))} className="rounded-md border border-stone bg-surface px-2 py-1 font-sans text-[12px] text-forest">
            <option value={5}>5y</option>
            <option value={10}>10y</option>
            <option value={20}>Max</option>
          </select>
          <button onClick={run} disabled={loading} className="inline-flex items-center gap-1.5 rounded-md bg-forest px-3 py-1.5 font-sans text-[12px] font-semibold text-[#F5F2EC] hover:brightness-110 disabled:opacity-50">
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />} {loading ? "Running…" : "Run backtest"}
          </button>
        </div>
      }
    >
      {err && <p className="rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-3 font-sans text-[12px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{err}</p>}

      {!data && !err ? (
        <p className="py-8 text-center font-sans text-[12px] text-ink/45">
          Run a walk-forward backtest of the regime overlay vs. buy-and-hold on the real NGX All-Share history (this fetches index history — a few seconds).
        </p>
      ) : data ? (
        <div className="space-y-4">
          {/* headline verdict */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-fresh/30 bg-fresh/[0.06] p-3">
              <p className="flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-eyebrow text-forest"><TrendingDown className="h-3.5 w-3.5" /> Drawdown cut</p>
              <p className="mt-1 font-serif text-2xl font-bold tabular-nums text-forest">{Math.round(data.ddReductionPct * 100)}%</p>
              <p className="font-sans text-[10px] text-ink/45">worst drawdown reduced vs buy-and-hold</p>
            </div>
            <div className="rounded-xl border border-stone bg-surface p-3">
              <p className="flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45"><ShieldCheck className="h-3.5 w-3.5" /> Upside kept</p>
              <p className="mt-1 font-serif text-2xl font-bold tabular-nums text-forest">{Math.round(data.returnCapturePct * 100)}%</p>
              <p className="font-sans text-[10px] text-ink/45">of buy-and-hold total return</p>
            </div>
            <div className="rounded-xl border border-stone bg-surface p-3">
              <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">Time de-risked</p>
              <p className="mt-1 font-serif text-2xl font-bold tabular-nums text-forest">{Math.round(data.pctDeRisked * 100)}%</p>
              <p className="font-sans text-[10px] text-ink/45">{data.from} → {data.to} · dwell {data.dwell}d</p>
            </div>
          </div>

          {/* equity curve */}
          <div className="rounded-xl border border-stone bg-surface p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-sans text-[11px] font-medium text-forest">Equity (log) — <span className="text-forest">regime overlay</span> vs <span className="text-ink/50">buy &amp; hold</span></span>
            </div>
            <EquityChart eq={data.equity} />
          </div>

          {/* side-by-side stats */}
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCol title="Regime overlay" s={data.overlay} />
            <StatCol title="Buy & hold (baseline)" s={data.baseline} dim />
          </div>

          {/* focus windows */}
          {data.windows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left font-sans text-[12px]">
                <thead>
                  <tr className="border-b border-stone text-[10px] uppercase tracking-eyebrow text-ink/45">
                    <th className="py-2 pr-2">Bear window</th><th className="px-2 text-right">B&amp;H drawdown</th><th className="px-2 text-right">Overlay drawdown</th><th className="pl-2 text-right">Overlay return</th>
                  </tr>
                </thead>
                <tbody>
                  {data.windows.map((w) => (
                    <tr key={w.label} className="border-b border-stone/60">
                      <td className="py-2 pr-2 font-medium text-forest">{w.label}</td>
                      <td className="px-2 text-right tabular-nums text-loss">−{pctAbs(w.base.maxDrawdown)}</td>
                      <td className="px-2 text-right tabular-nums text-loss">−{pctAbs(w.overlay.maxDrawdown)}</td>
                      <td className={`pl-2 text-right tabular-nums ${tone(w.overlay.totalReturn)}`}>{pct(w.overlay.totalReturn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="font-sans text-[10px] leading-relaxed text-ink/45">{data.note}</p>
        </div>
      ) : null}
    </Panel>
  );
}
