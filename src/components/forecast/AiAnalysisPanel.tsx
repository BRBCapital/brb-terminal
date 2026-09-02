"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { AiMarkdown } from "@/components/ui/AiMarkdown";
import { formatTimestamp } from "@/lib/format";
import type { AnalysisKind, AiStockAnalysis } from "@/lib/db/ai-stock-analyses";

type State =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "ready"; analysis: AiStockAnalysis }
  | { kind: "error"; message: string; code?: string };

// Reusable Claude-analysis panel for a stock: GETs any cached result on mount,
// generates/regenerates on demand, renders markdown. Used by the dividend
// forecast, sector momentum and buy/sell signal features.
export function AiAnalysisPanel({
  symbol,
  analysisKind,
  title,
  subtitle,
  cta,
  emptyBlurb,
}: {
  symbol: string;
  analysisKind: AnalysisKind;
  title: string;
  subtitle: string;
  cta: string;
  emptyBlurb: string;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const url = `/api/stocks/${symbol}/analysis/${analysisKind}`;

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
      title={title}
      subtitle={subtitle}
      right={state.kind === "ready" ? button("Regenerate") : undefined}
    >
      {state.kind === "loading" && (
        <div className="space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-stone" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-stone" />
        </div>
      )}

      {state.kind === "empty" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Sparkles className="h-7 w-7 text-fresh" />
          <p className="max-w-md font-sans text-[13px] text-ink/55">{emptyBlurb}</p>
          {button(cta)}
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
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-stone pb-2 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
            <span>Generated {formatTimestamp(state.analysis.created_at)} WAT</span>
            <span>Model {state.analysis.model}</span>
          </div>
          <AiMarkdown content={state.analysis.content} />
        </div>
      )}
    </Panel>
  );
}
