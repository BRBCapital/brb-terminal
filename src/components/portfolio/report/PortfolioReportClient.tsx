"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import { useManageData } from "@/components/portfolio/manage/useManageData";
import { AiMarkdown } from "@/components/ui/AiMarkdown";
import { PrintButton, PrintHeader } from "@/components/ui/PrintButton";
import { formatNaira, formatNairaCompact, formatDate } from "@/lib/format";
import { Delta } from "@/components/ui/Delta";
import type { ReviewSnapshot } from "@/lib/ai/portfolio-review";

export function PortfolioReportClient({ id }: { id: string }) {
  const data = useManageData(id);
  const { portfolio, valued, totals, lastUpdated } = data;
  const [content, setContent] = useState<string | null>(null);
  const [model, setModel] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!snapshot || generating) return;
    setGenerating(true);
    setError(null);
    setContent(null);
    setModel("");

    let report = "";
    let failed: string | null = null;
    try {
      const res = await fetch(`/api/portfolios/${id}/analysis-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });

      // Auth/validation failures come back as plain JSON, not a stream.
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok || !res.body || ct.includes("application/json")) {
        let msg = "Could not generate the report.";
        try {
          const body = await res.json();
          msg = body.error ?? msg;
        } catch {
          /* keep default */
        }
        failed = msg;
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let ev: { type: string; text?: string; model?: string; error?: string };
            try {
              ev = JSON.parse(line);
            } catch {
              continue;
            }
            if (ev.type === "delta" && ev.text) {
              report += ev.text;
              setContent(report);
            } else if (ev.type === "done") {
              setModel(ev.model ?? "");
            } else if (ev.type === "error") {
              failed = ev.error ?? "Could not generate the report.";
            }
          }
        }
      }
    } catch {
      failed = "Could not reach the server.";
    } finally {
      setGenerating(false);
      if (failed) {
        setError(failed);
        if (!report) setContent(null);
      }
    }
  }

  if (portfolio === undefined) return <div className="h-40 animate-pulse rounded-xl bg-stone" />;
  if (portfolio === null) {
    return (
      <div className="brb-card p-8 text-center">
        <p className="font-serif text-lg text-forest">Portfolio not found</p>
        <Link href="/portfolios" className="mt-2 inline-block text-forest-soft underline">
          Back to portfolios
        </Link>
      </div>
    );
  }

  const generatedOn = formatDate(new Date().toISOString());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/portfolios/${id}/manage`}
          className="inline-flex items-center gap-1 font-sans text-[11px] uppercase tracking-eyebrow text-forest-soft hover:text-forest"
        >
          <ArrowLeft className="h-3 w-3" /> Back to manage
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={generate}
            disabled={!snapshot || generating}
            className="inline-flex items-center gap-2 rounded-lg bg-fresh px-4 py-2 font-sans text-sm font-semibold text-forest hover:brightness-95 disabled:opacity-50"
          >
            {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Fable is writing the report…" : content ? "Regenerate" : "Generate analysis report"}
          </button>
          {content && !generating && <PrintButton label="Save as PDF" />}
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-3 font-sans text-[12px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200 print:hidden">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Report document */}
      <div className="brb-card p-6 print:border-0 print:p-0 print:shadow-none">
        <PrintHeader title="Portfolio Analysis Report" />

        {/* Masthead */}
        <div className="mb-4 border-b border-stone pb-4">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-eyebrow text-forest-soft">
            Portfolio Analysis Report
          </p>
          <h1 className="font-serif text-2xl font-bold text-forest">{portfolio.name}</h1>
          <p className="mt-0.5 font-sans text-[11px] text-ink/55">
            Benchmark {portfolio.benchmark_symbol} · Base {portfolio.base_currency} ·{" "}
            {snapshot?.positions.length ?? 0} holdings · Generated {generatedOn}
            {model ? ` · ${model}` : ""}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Market value" value={formatNairaCompact(totals.marketValue)} />
            <Stat label="Cost basis" value={formatNairaCompact(totals.costBasis)} />
            <Stat
              label="Unrealised P&L"
              value={formatNaira(totals.unrealisedPnl)}
              extra={<Delta value={totals.unrealisedPct} showArrow={false} className="text-[11px]" />}
            />
            <Stat label="Realised P&L" value={formatNaira(totals.realisedPnl)} />
          </div>
        </div>

        {content ? (
          <AiMarkdown content={content} />
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center print:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fresh/15">
              <Sparkles className="h-6 w-6 text-fresh" />
            </span>
            <p className="max-w-md font-sans text-[13px] leading-relaxed text-ink/55">
              Fable will write a formal analysis of <span className="font-semibold text-forest">{portfolio.name}</span> —
              diagnosis, a holdings review, sector &amp; concentration, ideas to trim and add, key risks and a prioritised
              recommendation — using only your figures and live NGX data. Then save it as a PDF.
            </p>
          </div>
        )}

        {/* Compliance footer (prints with the report) */}
        {content && (
          <div className="mt-6 border-t border-stone pt-3">
            <p className="font-sans text-[10px] leading-relaxed text-ink/50">
              Internal decision-support — AI-generated analysis from this portfolio&apos;s own figures and live NGX data,
              for the analyst&apos;s and Investment Committee&apos;s judgement. Not investment advice, not a recommendation
              to any client, and not an order. Any resulting trades require PM/IC approval via the Rebalancing workflow.
              Prices are delayed up to 20 minutes during NGX hours; past performance does not indicate future results.
              BRB Capital Group — Inclusive Wealth. Beyond Borders.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone bg-surface px-3.5 py-3 shadow-card print:border-stone/70 print:bg-transparent print:shadow-none">
      <p className="font-sans text-[9px] font-semibold uppercase tracking-eyebrow text-ink/40">{label}</p>
      <p className="mt-0.5 font-serif text-base font-semibold tabular-nums text-forest">{value}</p>
      {extra}
    </div>
  );
}
