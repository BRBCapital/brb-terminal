"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Scale,
  Activity,
  Zap,
  ShieldAlert,
} from "lucide-react";
import { AiMarkdown } from "@/components/ui/AiMarkdown";
import { ForecastDisclaimer } from "./ForecastDisclaimer";
import { formatTimestamp } from "@/lib/format";
import type { AiStockAnalysis } from "@/lib/db/ai-stock-analyses";

interface TradeSignal {
  stance: "BUY" | "HOLD" | "SELL";
  conviction: "Low" | "Medium" | "High";
  horizon: string;
  thesis: string;
  bull_case: string[];
  bear_case: string[];
  valuation_read: string;
  technical_read: string;
  catalysts: string[];
  risks: string[];
  bottom_line: string;
}

type State =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "ready"; analysis: AiStockAnalysis; signal: TradeSignal | null }
  | { kind: "error"; message: string; code?: string };

function parseSignal(content: string): TradeSignal | null {
  try {
    const obj = JSON.parse(content);
    if (obj && typeof obj.stance === "string" && Array.isArray(obj.bull_case)) return obj as TradeSignal;
  } catch {
    /* older cached signals were markdown — fall through */
  }
  return null;
}

// Per-stance visual language. Fixed accent colors read the same in both themes.
const STANCE = {
  BUY: {
    label: "BUY",
    badge: "bg-fresh text-forest",
    tint: "border-fresh/40 bg-fresh/[0.07]",
    text: "text-forest",
    seg: 2,
  },
  HOLD: {
    label: "HOLD",
    badge: "bg-amber-400 text-[#3a2a00]",
    tint: "border-amber-400/40 bg-amber-400/[0.08]",
    text: "text-amber-600 dark:text-amber-400",
    seg: 1,
  },
  SELL: {
    label: "SELL",
    badge: "bg-loss text-white",
    tint: "border-loss/40 bg-loss/[0.06]",
    text: "text-loss",
    seg: 0,
  },
} as const;

export function SignalTab({ symbol }: { symbol: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const url = `/api/stocks/${symbol}/analysis/trade_signal`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const body = await res.json();
      if (body.ok && body.analysis) {
        setState({ kind: "ready", analysis: body.analysis, signal: parseSignal(body.analysis.content) });
      } else setState({ kind: "empty" });
    } catch {
      setState({ kind: "error", message: "Could not load the signal." });
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch(url, { method: "POST" });
      const body = await res.json();
      if (body.ok && body.analysis) {
        setState({ kind: "ready", analysis: body.analysis, signal: parseSignal(body.analysis.content) });
      } else setState({ kind: "error", message: body.error ?? "Generation failed.", code: body.errorCode });
    } catch {
      setState({ kind: "error", message: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  const genButton = (label: string) => (
    <button
      onClick={generate}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg bg-fresh px-4 py-2 font-sans text-sm font-semibold text-forest hover:brightness-95 disabled:opacity-50"
    >
      {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {busy ? "Analysing…" : label}
    </button>
  );

  return (
    <div className="space-y-4">
      <ForecastDisclaimer />

      <section className="brb-card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone px-4 py-3">
          <div>
            <h3 className="font-sans text-[12px] font-semibold uppercase tracking-eyebrow text-forest">
              Buy / Sell signal
            </h3>
            <p className="mt-0.5 font-sans text-[11px] text-ink/50">
              {symbol} · valuation + momentum + technicals, synthesised by Claude
            </p>
          </div>
          {state.kind === "ready" && genButton("Regenerate")}
        </div>

        <div className="p-4 sm:p-5">
          {state.kind === "loading" && (
            <div className="space-y-3">
              <div className="h-28 animate-pulse rounded-xl bg-stone" />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-32 animate-pulse rounded-lg bg-stone" />
                <div className="h-32 animate-pulse rounded-lg bg-stone" />
              </div>
            </div>
          )}

          {state.kind === "empty" && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Sparkles className="h-8 w-8 text-fresh" />
              <div>
                <p className="font-serif text-lg text-forest">Generate a buy / sell signal</p>
                <p className="mx-auto mt-1 max-w-md font-sans text-[13px] text-ink/55">
                  Claude weighs valuation (P/E, P/B, yield, 52-week position), momentum and computed
                  technicals into a <strong>BUY / HOLD / SELL</strong> stance with a conviction level and the
                  full bull &amp; bear case behind it.
                </p>
              </div>
              {genButton("Generate buy/sell signal")}
            </div>
          )}

          {state.kind === "error" && (
            <div className="space-y-3">
              <p className="flex items-start gap-2 rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-3 font-sans text-[12px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {state.message}
              </p>
              {state.code !== "NO_CREDENTIALS" && genButton("Try again")}
            </div>
          )}

          {state.kind === "ready" && (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-sans text-[10px] uppercase tracking-eyebrow text-ink/40">
                <span>Generated {formatTimestamp(state.analysis.created_at)} WAT</span>
                <span>Model {state.analysis.model}</span>
              </div>
              {state.signal ? (
                <SignalView s={state.signal} />
              ) : (
                // Backward-compat: an older cached signal stored as markdown.
                <AiMarkdown content={state.analysis.content} />
              )}
            </div>
          )}
        </div>
      </section>

      <div className="brb-callout py-2">
        <p className="font-sans text-[11px] leading-relaxed text-ink/55">
          Internal decision-support only. This BUY / HOLD / SELL view is Claude&apos;s synthesis of the
          platform&apos;s own figures for the analyst&apos;s judgement — not investment advice, not a
          recommendation to any client, and not an order. It requires the analyst&apos;s and Investment
          Committee&apos;s own assessment. Prices are delayed up to 20 minutes during NGX hours; past
          performance does not indicate future results.
        </p>
      </div>
    </div>
  );
}

function SignalView({ s }: { s: TradeSignal }) {
  const st = STANCE[s.stance] ?? STANCE.HOLD;
  const convLevel = s.conviction === "High" ? 3 : s.conviction === "Medium" ? 2 : 1;

  return (
    <div className="space-y-5">
      {/* Verdict hero */}
      <div className={`rounded-xl border p-5 ${st.tint}`}>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-16 w-24 flex-col items-center justify-center rounded-lg font-serif text-2xl font-extrabold shadow-card ${st.badge}`}
            >
              {st.label}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">Conviction</span>
                <span className="flex gap-1">
                  {[1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-2.5 w-2.5 rounded-full ${
                        i <= convLevel ? "bg-forest dark:bg-fresh" : "bg-stone"
                      }`}
                    />
                  ))}
                </span>
                <span className={`font-sans text-[12px] font-semibold ${st.text}`}>{s.conviction}</span>
              </div>
              <p className="font-sans text-[11px] text-ink/55">
                <span className="uppercase tracking-eyebrow text-ink/45">Horizon</span> · {s.horizon}
              </p>
            </div>
          </div>
          <Gauge active={st.seg} />
        </div>
        <p className="mt-4 border-t border-stone/60 pt-3 font-serif text-[15px] leading-relaxed text-forest">
          {s.thesis}
        </p>
      </div>

      {/* Bull vs bear */}
      <div className="grid gap-3 md:grid-cols-2">
        <CaseCard title="The bull case" tone="up" items={s.bull_case} />
        <CaseCard title="The bear case" tone="down" items={s.bear_case} />
      </div>

      {/* Valuation & technical reads */}
      <div className="grid gap-3 md:grid-cols-2">
        <ReadCard title="Valuation read" icon={<Scale className="h-4 w-4" />} text={s.valuation_read} />
        <ReadCard title="Technical read" icon={<Activity className="h-4 w-4" />} text={s.technical_read} />
      </div>

      {/* Catalysts & risks */}
      <div className="grid gap-3 md:grid-cols-2">
        <ListCard title="Catalysts" icon={<Zap className="h-4 w-4 text-fresh" />} items={s.catalysts} />
        <ListCard title="Risks" icon={<ShieldAlert className="h-4 w-4 text-loss" />} items={s.risks} />
      </div>

      {/* Bottom line */}
      <div className="brb-callout py-3">
        <p className="mb-1 font-sans text-[10px] font-semibold uppercase tracking-eyebrow text-forest-soft">
          Bottom line
        </p>
        <p className="font-sans text-[13.5px] leading-relaxed text-ink/80">{s.bottom_line}</p>
      </div>
    </div>
  );
}

// SELL ← HOLD → BUY meter with the active segment lit.
function Gauge({ active }: { active: number }) {
  const segs = [
    { label: "SELL", on: "bg-loss", text: "text-loss" },
    { label: "HOLD", on: "bg-amber-400", text: "text-amber-600 dark:text-amber-400" },
    { label: "BUY", on: "bg-fresh", text: "text-forest dark:text-fresh" },
  ];
  return (
    <div className="w-full max-w-[220px]">
      <div className="flex overflow-hidden rounded-full border border-stone">
        {segs.map((seg, i) => (
          <div
            key={seg.label}
            className={`h-2.5 flex-1 ${i === active ? seg.on : "bg-stone/60"} ${
              i > 0 ? "border-l border-surface" : ""
            }`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-sans text-[9px] font-semibold uppercase tracking-eyebrow">
        {segs.map((seg, i) => (
          <span key={seg.label} className={i === active ? seg.text : "text-ink/30"}>
            {seg.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function CaseCard({ title, tone, items }: { title: string; tone: "up" | "down"; items: string[] }) {
  const up = tone === "up";
  return (
    <div
      className={`rounded-lg border p-3.5 ${
        up ? "border-fresh/30 bg-fresh/[0.05]" : "border-loss/30 bg-loss/[0.04]"
      }`}
    >
      <p className="mb-2 flex items-center gap-1.5 font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest">
        {up ? <TrendingUp className="h-3.5 w-3.5 text-fresh" /> : <TrendingDown className="h-3.5 w-3.5 text-loss" />}
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 font-sans text-[12.5px] leading-relaxed text-ink/75">
            <span className={`mt-px shrink-0 ${up ? "text-fresh" : "text-loss"}`}>{up ? "▲" : "▼"}</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReadCard({ title, icon, text }: { title: string; icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-lg border border-stone bg-sand/40 p-3.5">
      <p className="mb-1.5 flex items-center gap-1.5 font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest-soft">
        <span className="text-ink/40">{icon}</span>
        {title}
      </p>
      <p className="font-sans text-[12.5px] leading-relaxed text-ink/75">{text}</p>
    </div>
  );
}

function ListCard({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  return (
    <div className="rounded-lg border border-stone bg-sand/40 p-3.5">
      <p className="mb-2 flex items-center gap-1.5 font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest-soft">
        {icon}
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 font-sans text-[12.5px] leading-relaxed text-ink/75">
            <span className="mt-px shrink-0 text-ink/30">·</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
