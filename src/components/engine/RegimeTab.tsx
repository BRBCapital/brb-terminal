"use client";

import { useCallback, useEffect, useState } from "react";
import { Radar, RefreshCw, Eye, TrendingUp, Users, Activity, Coins } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { BacktestPanel } from "./BacktestPanel";
import type { RegimeState } from "@/lib/engine/regime";

interface RegimeComponents { trend: number; breadth: number; volatility: number; fx: number }
interface Current {
  score: number; state: RegimeState; exposure_mult: number;
  components: RegimeComponents; drivers: string[]; narrative: string;
}
interface HistRow { date: string; score: number; state: RegimeState; exposure_mult: number }
interface Payload {
  ok: boolean; live: boolean; shadow: boolean; dwell: number; date: string;
  current: Current; effective: { state: RegimeState; exposure_mult: number }; history: HistRow[];
}

const STATE: Record<RegimeState, { label: string; cls: string; dot: string }> = {
  RISK_ON: { label: "Risk-on", cls: "bg-fresh/20 text-forest ring-fresh/30", dot: "bg-fresh" },
  NEUTRAL: { label: "Neutral", cls: "bg-sand text-forest ring-stone", dot: "bg-forest-soft" },
  RISK_OFF: { label: "Risk-off", cls: "bg-amber-400/20 text-amber-700 ring-amber-300/40 dark:text-amber-300", dot: "bg-amber-500" },
  CRISIS: { label: "Crisis", cls: "bg-loss/15 text-loss ring-loss/30", dot: "bg-loss" },
};

function barTone(v: number) {
  return v >= 0.6 ? "bg-fresh" : v >= 0.4 ? "bg-amber-400" : "bg-loss";
}

function ScoreHistory({ rows }: { rows: HistRow[] }) {
  if (rows.length < 2) return <p className="py-6 text-center font-sans text-[12px] text-ink/40">History builds as daily snapshots accumulate.</p>;
  const w = 100, h = 34;
  const x = (i: number) => (i / (rows.length - 1)) * w;
  const y = (s: number) => h - s * h;
  const line = rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(r.score).toFixed(2)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-24 w-full" role="img" aria-label="Risk-on score history">
      {/* threshold bands: risk-off < .4, neutral .4-.6, risk-on > .6 */}
      <rect x="0" y={y(0.4)} width={w} height={h - y(0.4)} className="fill-loss/10" />
      <rect x="0" y={y(0.6)} width={w} height={y(0.4) - y(0.6)} className="fill-amber-400/10" />
      <rect x="0" y="0" width={w} height={y(0.6)} className="fill-fresh/10" />
      <path d={`${line} L${w} ${h} L0 ${h} Z`} className="fill-forest/10" />
      <path d={line} className="stroke-forest" fill="none" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function RegimeTab() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/engine/regime", { cache: "no-store" });
      const body = await res.json();
      if (body.ok) { setData(body as Payload); setErr(null); }
      else setErr(body.error ?? "Could not evaluate the regime.");
    } catch {
      setErr("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const c = data?.current;
  const meta = c ? STATE[c.state] : STATE.NEUTRAL;

  return (
    <div className="space-y-4">
      {/* Mode banner */}
      {data?.live ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-fresh/40 bg-fresh/[0.07] p-3">
          <Radar className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
          <p className="font-sans text-[12px] leading-relaxed text-ink/70">
            <strong className="text-forest">Live — scaling allocation.</strong> The regime sizes how much the engine deploys and
            gates entries. <strong>De-risking is automatic</strong>; opening against a risk-off regime is routed to{" "}
            <strong>Approvals</strong>; CRISIS halts new entries. Effective state{" "}
            <strong>{data.effective.state.replace("_", "-").toLowerCase()}</strong> @ {Math.round(data.effective.exposure_mult * 100)}% exposure
            {data.effective.state !== c?.state && <> (held by {data.dwell}-day dwell)</>}.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-xl border border-forest-soft/30 bg-fresh/[0.05] p-3">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-forest-soft" />
          <p className="font-sans text-[12px] leading-relaxed text-ink/70">
            <strong className="text-forest">Shadow mode.</strong> The regime engine observes the live NGX and shows the risk-on
            score and the exposure it <em>would</em> apply — but it does <strong>not</strong> change allocation. Turn on
            <strong> Regime layer</strong> in Settings to let it scale sizing (automatic de-risking, human-approved re-risking).
          </p>
        </div>
      )}

      {err && <p className="rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-3 font-sans text-[12px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{err}</p>}

      {loading && !data ? (
        <div className="h-40 animate-pulse rounded-xl bg-stone/60" />
      ) : c ? (
        <>
          {/* Headline state + score + shadow exposure */}
          <div className="brb-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-forest to-forest-soft text-fresh shadow-card">
                  <Radar className="h-5 w-5" />
                </span>
                <div>
                  <p className="brb-eyebrow">Market regime · {data?.date}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-[13px] font-semibold ring-1 ${meta.cls}`}>
                      <span className={`h-2 w-2 rounded-full ${meta.dot}`} /> {meta.label}
                    </span>
                    <span className="font-serif text-2xl font-bold tabular-nums text-forest">{Math.round(c.score * 100)}<span className="text-sm text-ink/40">/100</span></span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/40">{data?.live ? "Exposure applied" : "Shadow exposure"}</p>
                <p className="font-serif text-2xl font-bold tabular-nums text-forest">{Math.round((data?.live ? data.effective.exposure_mult : c.exposure_mult) * 100)}%</p>
                <p className="font-sans text-[10px] text-ink/45">of base capital {data?.live ? "deployed" : "it would deploy"}</p>
              </div>
            </div>
            <p className="mt-4 rounded-lg border border-stone bg-sand/40 p-3 font-sans text-[12.5px] leading-relaxed text-ink/75 dark:bg-surface">
              {c.narrative}
            </p>
          </div>

          {/* Component breakdown */}
          <Panel title="Regime components" subtitle="Four economically-motivated signals · higher = more risk-on">
            <div className="space-y-3">
              {([
                ["Trend", c.components.trend, TrendingUp, "ASI multi-horizon momentum"],
                ["Breadth", c.components.breadth, Users, "Participation · adv/dec + names in uptrends"],
                ["Volatility", c.components.volatility, Activity, "Calm markets score higher"],
                ["FX stress", c.components.fx, Coins, "NGN stability vs USD"],
              ] as const).map(([label, val, Icon, hint]) => (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-sans text-[12px] font-medium text-forest">
                      <Icon className="h-3.5 w-3.5 text-forest-soft" /> {label}
                    </span>
                    <span className="font-sans text-[12px] tabular-nums text-ink/60">{Math.round(val * 100)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-stone">
                    <div className={`h-full rounded-full ${barTone(val)}`} style={{ width: `${Math.max(3, val * 100)}%` }} />
                  </div>
                  <p className="mt-0.5 font-sans text-[10px] text-ink/40">{hint}</p>
                </div>
              ))}
            </div>
          </Panel>

          {/* History */}
          <Panel
            title="Risk-on score history"
            subtitle="Daily snapshots (green = risk-on, amber = neutral, red = risk-off)"
            right={
              <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 rounded-md border border-stone px-2.5 py-1 font-sans text-[12px] text-forest hover:bg-sand disabled:opacity-50">
                {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
              </button>
            }
          >
            <ScoreHistory rows={data?.history ?? []} />
          </Panel>

          {/* Walk-forward validation */}
          <BacktestPanel />

          <div className="brb-callout py-2">
            <p className="font-sans text-[11px] leading-relaxed text-ink/55">
              Regime scores are computed deterministically from live NGX market data (index trend, breadth, dispersion, FX) —
              the AI does not set them. Simulated / illustrative · not investment advice. Proxy inputs will be replaced by
              full index-history trend &amp; realised-vol in the validation phase.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
