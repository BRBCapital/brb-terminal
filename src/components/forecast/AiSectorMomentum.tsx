"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, RefreshCw, AlertTriangle, TrendingUp, Layers } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { AiMarkdown } from "@/components/ui/AiMarkdown";
import { Delta } from "@/components/ui/Delta";
import { formatTimestamp } from "@/lib/format";
import type { AiStockAnalysis } from "@/lib/db/ai-stock-analyses";

// Momentum context for the stock's own sector, when the sector-rotation feed is
// available (it is Growth-plan gated, so this is best-effort).
export interface SectorContext {
  change_1d: number | null;
  change_7d: number | null;
  change_52w: number | null;
  rank: number | null; // 1 = strongest 7d momentum
  total: number | null;
}

type State =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "ready"; analysis: AiStockAnalysis }
  | { kind: "error"; message: string; code?: string };

// Purpose-built panel for the sector-momentum read: a sector-rotation context
// band up top, then Claude's narrative. Replaces the generic markdown panel for
// this feature so the AI read sits on top of the hard momentum numbers.
export function AiSectorMomentum({
  symbol,
  sector,
  context,
}: {
  symbol: string;
  sector: string | null;
  context: SectorContext | null;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const url = `/api/stocks/${symbol}/analysis/sector_momentum`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const body = await res.json();
      if (body.ok && body.analysis) setState({ kind: "ready", analysis: body.analysis });
      else setState({ kind: "empty" });
    } catch {
      setState({ kind: "error", message: "Could not load the analysis." });
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
      if (body.ok && body.analysis) setState({ kind: "ready", analysis: body.analysis });
      else setState({ kind: "error", message: body.error ?? "Generation failed.", code: body.errorCode });
    } catch {
      setState({ kind: "error", message: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  const button = (label: string) => (
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
    <Panel
      title="AI sector momentum"
      subtitle={sector ? `${symbol} · where ${sector} sits in the rotation` : symbol}
      right={state.kind === "ready" ? button("Regenerate") : undefined}
    >
      {/* Sector-rotation context band */}
      <SectorBand sector={sector} context={context} />

      <div className="mt-4">
        {state.kind === "loading" && (
          <div className="space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-stone" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-stone" />
          </div>
        )}

        {state.kind === "empty" && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-stone bg-sand/40 py-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-fresh/15">
              <Sparkles className="h-5 w-5 text-fresh" />
            </span>
            <p className="max-w-md font-sans text-[13px] leading-relaxed text-ink/60">
              Claude reads where {sector ? <span className="font-semibold text-forest">{sector}</span> : "this sector"} sits
              in the current rotation (1&#8209;day / 7&#8209;day / 52&#8209;week) versus the rest of the market, and what
              that momentum implies for {symbol}.
            </p>
            {button("Generate sector momentum read")}
          </div>
        )}

        {state.kind === "error" && (
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-3 font-sans text-[12px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {state.message}
            </p>
            {state.code !== "NO_CREDENTIALS" && button("Try again")}
          </div>
        )}

        {state.kind === "ready" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone pb-2 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
              <span className="inline-flex items-center gap-1 text-forest-soft">
                <Sparkles className="h-3 w-3" /> Claude read
              </span>
              <span>Generated {formatTimestamp(state.analysis.created_at)} WAT</span>
              <span>Model {state.analysis.model}</span>
            </div>
            <AiMarkdown content={state.analysis.content} />
          </div>
        )}
      </div>
    </Panel>
  );
}

// The rotation context header: sector name + this sector's 1d/7d/52w momentum
// and its rank. Degrades to a plain sector label when the feed is unavailable.
function SectorBand({ sector, context }: { sector: string | null; context: SectorContext | null }) {
  const hasStats =
    context != null &&
    (context.change_1d != null || context.change_7d != null || context.change_52w != null);

  return (
    <div className="rounded-xl border border-fresh/25 bg-gradient-to-br from-fresh/10 to-transparent p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-fresh/20 text-forest-soft">
            <Layers className="h-5 w-5" />
          </span>
          <div>
            <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">Sector rotation</p>
            <p className="font-serif text-lg font-bold text-forest">{sector ?? "Sector"}</p>
          </div>
        </div>
        {hasStats && context?.rank != null && context.total != null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/10 px-3 py-1 font-sans text-[11px] font-semibold text-forest-soft">
            <TrendingUp className="h-3.5 w-3.5" />
            #{context.rank} of {context.total} · 7d momentum
          </span>
        )}
      </div>

      {hasStats ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MomentumStat label="1-day" value={context!.change_1d} />
          <MomentumStat label="7-day" value={context!.change_7d} />
          <MomentumStat label="52-week" value={context!.change_52w} />
        </div>
      ) : (
        <p className="mt-2 font-sans text-[11px] text-ink/45">
          Live sector-rotation stats need a higher NGN Market plan tier — the AI read still assesses
          the sector using derived momentum and web context.
        </p>
      )}
    </div>
  );
}

function MomentumStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-stone/70 bg-surface/60 px-3 py-2 text-center">
      <p className="font-sans text-[9px] uppercase tracking-eyebrow text-ink/45">{label}</p>
      <Delta value={value} showArrow={false} className="mt-0.5 justify-center text-[14px] font-semibold" />
    </div>
  );
}
