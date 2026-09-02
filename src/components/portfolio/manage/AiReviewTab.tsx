"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, RefreshCw, AlertTriangle, Wallet } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { AiMarkdown } from "@/components/ui/AiMarkdown";
import { formatNaira, formatTimestamp } from "@/lib/format";
import type { ManageData } from "./useManageData";
import type { ReviewSnapshot } from "@/lib/ai/portfolio-review";
import type { AiPortfolioReview } from "@/lib/db/ai-reviews";

type State =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "ready"; review: AiPortfolioReview }
  | { kind: "error"; message: string; code?: string };

export function AiReviewTab({ id, data }: { id: string; data: ManageData }) {
  const { portfolio, valued, totals, lastUpdated } = data;
  const [state, setState] = useState<State>({ kind: "loading" });
  const [generating, setGenerating] = useState(false);
  const [cash, setCash] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/portfolios/${id}/ai-review`, { cache: "no-store" });
      const body = await res.json();
      if (body.ok && body.review) {
        setState({ kind: "ready", review: body.review });
        setCash(String(body.review.cash_available ?? ""));
      } else setState({ kind: "empty" });
    } catch {
      setState({ kind: "error", message: "Could not load the review." });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Build the analyst-facing snapshot from the same numbers shown in the UI.
  const snapshot: ReviewSnapshot | null = useMemo(() => {
    if (!portfolio) return null;
    const held = valued.filter((p) => p.units > 0);
    const mv = totals.marketValue;
    const positions = held.map((p) => ({
      symbol: p.symbol,
      name: p.companyName,
      sector: p.sector,
      units: p.units,
      avgCost: p.avgCost,
      currentPrice: p.currentPrice,
      marketValue: p.marketValue,
      weightPct: mv > 0 && p.marketValue != null ? (p.marketValue / mv) * 100 : null,
      unrealisedPct: p.unrealisedPct,
      dayChangePct: p.dayChangePct,
    }));
    const bySector = new Map<string, number>();
    for (const p of held) {
      if (p.marketValue == null) continue;
      bySector.set(p.sector || "Unclassified", (bySector.get(p.sector || "Unclassified") ?? 0) + p.marketValue);
    }
    const sectorAllocation = [...bySector.entries()]
      .map(([sector, val]) => ({ sector, pct: mv > 0 ? (val / mv) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);
    return {
      name: portfolio.name,
      mandateNotes: portfolio.mandate_notes,
      benchmark: portfolio.benchmark_symbol,
      baseCurrency: portfolio.base_currency,
      totals: {
        marketValue: totals.marketValue,
        costBasis: totals.costBasis,
        unrealisedPnl: totals.unrealisedPnl,
        unrealisedPct: totals.unrealisedPct,
        realisedPnl: totals.realisedPnl,
        dividends: totals.dividends,
      },
      positions,
      sectorAllocation,
      lastUpdated,
    };
  }, [portfolio, valued, totals, lastUpdated]);

  async function generate() {
    if (!snapshot) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/portfolios/${id}/ai-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cashAvailable: Number(cash) || 0, snapshot }),
      });
      const body = await res.json();
      if (body.ok && body.review) setState({ kind: "ready", review: body.review });
      else setState({ kind: "error", message: body.error ?? "Generation failed.", code: body.errorCode });
    } catch {
      setState({ kind: "error", message: "Could not reach the server." });
    } finally {
      setGenerating(false);
    }
  }

  const cashNum = Number(cash) || 0;

  const controls = (label: string) => (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="mb-1 flex items-center gap-1 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
          <Wallet className="h-3 w-3" /> Cash available to trade (₦)
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={cash}
          onChange={(e) => setCash(e.target.value)}
          placeholder="e.g. 5,000,000"
          className="w-52 rounded-lg border border-stone bg-surface px-3 py-2 font-mono text-[13px] tabular-nums outline-none focus:border-fresh"
        />
        {cashNum > 0 && (
          <span className="mt-1 block font-sans text-[10px] text-ink/45">{formatNaira(cashNum)} to deploy</span>
        )}
      </label>
      <button
        onClick={generate}
        disabled={generating || !snapshot}
        className="inline-flex items-center gap-2 rounded-lg bg-fresh px-4 py-2 font-sans text-sm font-semibold text-forest hover:brightness-95 disabled:opacity-50"
      >
        {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {generating ? "Running deep review…" : label}
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <Panel
        title="AI portfolio review"
        subtitle="Claude analyses your holdings + the live NGX opportunity set and proposes optimisation ideas"
      >
        {state.kind === "loading" && (
          <div className="space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-stone" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-stone" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-stone" />
          </div>
        )}

        {state.kind === "empty" && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Sparkles className="h-8 w-8 text-fresh" />
            <div>
              <p className="font-serif text-lg text-forest">Deep-review this portfolio</p>
              <p className="mx-auto mt-1 max-w-md font-sans text-[13px] text-ink/55">
                Claude reviews concentration, sector tilt, momentum and P&amp;L against your
                mandate, then proposes names to trim or exit and names to add — sized to the
                cash you have to deploy plus any proceeds from the trims.
              </p>
            </div>
            {controls("Generate review")}
          </div>
        )}

        {state.kind === "error" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-4 dark:bg-amber-950/30">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
              <p className="font-sans text-[13px] text-amber-800 dark:text-amber-200">{state.message}</p>
            </div>
            {state.code !== "NO_CREDENTIALS" && controls("Try again")}
          </div>
        )}

        {state.kind === "ready" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone pb-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                <span>Generated {formatTimestamp(state.review.created_at)} WAT</span>
                <span>Cash modelled {formatNaira(Number(state.review.cash_available))}</span>
                <span>Model {state.review.model}</span>
              </div>
            </div>
            {controls("Regenerate")}
            <AiMarkdown content={state.review.content} />
          </div>
        )}
      </Panel>

      <div className="brb-callout py-2">
        <p className="font-sans text-[11px] leading-relaxed text-ink/55">
          Internal decision-support — AI-generated optimisation <em>ideas</em> from your portfolio&apos;s
          own figures and live NGX data, for the analyst&apos;s judgement. Not investment advice, not a
          recommendation to any client, and not an order. Validate every figure, then route any resulting
          trades through the <strong>Rebalancing</strong> tab for PFM/IC approval. Prices are delayed up to
          20 minutes during NGX hours; past performance does not indicate future results.
        </p>
      </div>
    </div>
  );
}
