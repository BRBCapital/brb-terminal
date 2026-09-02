"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import { PrintButton, PrintHeader } from "@/components/ui/PrintButton";
import { AiMarkdown } from "@/components/ui/AiMarkdown";
import { formatNaira, formatNairaCompact, formatDate } from "@/lib/format";
import { Delta } from "@/components/ui/Delta";
import { toneClass, signedCompact, pct, CadenceTag } from "./ui";
import { formatMonth } from "./ProfilesTab";
import type { OverviewData, OverviewPosition } from "@/lib/engine/overview";
import type { StrategyPortfolio } from "@/lib/db/strategy";

interface Detail {
  overview: OverviewData;
  portfolios: StrategyPortfolio[];
}

export function EngineReportClient({ period }: { period: string }) {
  const isYear = period.length === 4;
  const label = isYear ? period : formatMonth(period);

  const [data, setData] = useState<Detail | null | undefined>(undefined);
  const [content, setContent] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const body = await (await fetch(`/api/engine/profiles/${period}`, { cache: "no-store" })).json();
      setData(body.ok ? { overview: body.overview, portfolios: body.portfolios } : null);
    })();
  }, [period]);

  async function generate() {
    if (generating) return;
    setGenerating(true);
    setError(null);
    setContent(null);
    setModel("");
    let report = "";
    let failed: string | null = null;
    try {
      const res = await fetch(`/api/engine/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok || !res.body || ct.includes("application/json")) {
        let msg = "Could not generate the report.";
        try {
          const b = await res.json();
          msg = b.error ?? msg;
        } catch {
          /* keep */
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

  const rows = useMemo(() => {
    if (!data) return [] as (OverviewPosition & { status: "open" | "closed" })[];
    const open = data.overview.positions.map((p) => ({ ...p, status: "open" as const }));
    const closed = data.overview.closed.map((p) => ({ ...p, status: "closed" as const }));
    return [...open, ...closed].sort((a, b) => (a.opened_on < b.opened_on ? 1 : -1));
  }, [data]);

  if (data === undefined) return <div className="h-40 animate-pulse rounded-xl bg-stone" />;
  if (!data) {
    return (
      <div className="brb-card p-8 text-center">
        <p className="font-serif text-lg text-forest">No trades for {label}</p>
        <Link href="/engine" className="mt-2 inline-block text-forest-soft underline">Back to the engine</Link>
      </div>
    );
  }

  const t = data.overview.totals;
  const generatedOn = formatDate(new Date().toISOString());

  return (
    <div className="space-y-4">
      {/* Controls (not printed) */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/engine" className="inline-flex items-center gap-1 font-sans text-[11px] uppercase tracking-eyebrow text-forest-soft hover:text-forest">
          <ArrowLeft className="h-3 w-3" /> Back to engine
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-fresh px-4 py-2 font-sans text-sm font-semibold text-forest hover:brightness-95 disabled:opacity-50"
          >
            {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Fable is writing the report…" : content ? "Regenerate analysis" : "Generate AI performance report"}
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
        <PrintHeader title={`Strategies Engine — ${isYear ? "Annual" : "Monthly"} Performance`} />

        {/* Masthead */}
        <div className="mb-4 border-b border-stone pb-4">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-eyebrow text-forest-soft">
            Alternative Strategies Engine · {isYear ? "Annual" : "Monthly"} Performance Report
          </p>
          <h1 className="font-serif text-2xl font-bold text-forest">{label}</h1>
          <p className="mt-0.5 font-sans text-[11px] text-ink/55">
            Simulated paper-trading · {t.closed_count + t.open_count} positions · Generated {generatedOn}
            {model ? ` · ${model}` : ""}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <RStat label="Net P&L" value={signedCompact(t.total_pnl)} valueClass={toneClass(t.total_pnl)} extra={<Delta value={t.return_pct} showArrow={false} className="text-[11px]" />} />
            <RStat label="Realised P&L" value={signedCompact(t.realized)} valueClass={toneClass(t.realized)} />
            <RStat label="Unrealised P&L" value={signedCompact(t.unrealized)} valueClass={toneClass(t.unrealized)} />
            <RStat label="Win rate" value={t.win_rate == null ? "—" : `${t.win_rate.toFixed(0)}%`} sub={`${t.closed_count} closed`} />
            <RStat label="Deployed" value={formatNairaCompact(t.deployed)} sub={`of ${formatNairaCompact(t.capital)}`} />
            <RStat label="Positions" value={`${t.open_count} / ${t.closed_count}`} sub="open / closed" />
            <RStat label="Max drawdown" value={data.overview.max_drawdown > 0 ? `−${formatNairaCompact(data.overview.max_drawdown)}` : "—"} />
            <RStat label="Sharpe (ann.)" value={data.overview.sharpe == null ? "—" : data.overview.sharpe.toFixed(2)} />
          </div>
        </div>

        {/* AI performance analysis — the lead of the report */}
        {content ? (
          <div className="mb-5">
            <AiMarkdown content={content} />
          </div>
        ) : (
          <div className="mb-5 flex flex-col items-center gap-3 rounded-xl border border-dashed border-stone bg-sand/30 py-10 text-center print:hidden dark:bg-surface">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-fresh/15">
              <Sparkles className="h-5 w-5 text-fresh" />
            </span>
            <p className="max-w-md font-sans text-[13px] leading-relaxed text-ink/55">
              Fable will write a detailed {isYear ? "annual" : "monthly"} performance review of{" "}
              <span className="font-semibold text-forest">{label}</span> — executive summary, cadence
              attribution, risk &amp; drawdown, notable trades and outlook — grounded only in the figures below.
              Then save it as a PDF.
            </p>
          </div>
        )}

        {/* Per-cadence */}
        <h2 className="font-serif text-lg font-semibold text-forest">By cadence</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-stone text-left font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                <th className="py-1.5 pr-3">Cadence</th>
                <th className="px-3 py-1.5 text-right">Trades</th>
                <th className="px-3 py-1.5 text-right">Win rate</th>
                <th className="px-3 py-1.5 text-right">Avg return</th>
                <th className="px-3 py-1.5 text-right">Realised</th>
                <th className="px-3 py-1.5 text-right">Unrealised</th>
              </tr>
            </thead>
            <tbody>
              {data.overview.per_cadence
                .filter((c) => c.open_count + c.closed_count > 0)
                .map((c) => (
                  <tr key={c.cadence} className="border-b border-stone/60">
                    <td className="py-2 pr-3"><CadenceTag cadence={c.cadence} /></td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink/70">{c.open_count + c.closed_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink/70">{c.win_rate == null ? "—" : `${c.win_rate.toFixed(0)}%`}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${toneClass(c.avg_return_pct)}`}>{c.avg_return_pct == null ? "—" : pct(c.avg_return_pct)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${toneClass(c.realized)}`}>{signedCompact(c.realized)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${toneClass(c.unrealized)}`}>{signedCompact(c.unrealized)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Trades */}
        <h2 className="mt-5 font-serif text-lg font-semibold text-forest">Trades taken</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-stone text-left font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                <th className="py-1.5 pr-3">Stock</th>
                <th className="px-3 py-1.5">Cadence</th>
                <th className="px-3 py-1.5">Opened</th>
                <th className="px-3 py-1.5 text-right">Entry</th>
                <th className="px-3 py-1.5 text-right">Mark / close</th>
                <th className="px-3 py-1.5 text-right">Value</th>
                <th className="px-3 py-1.5 text-right">P&L</th>
                <th className="px-3 py-1.5 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-stone/60">
                  <td className="py-2 pr-3">
                    <span className="font-sans text-[11px] font-bold uppercase text-forest">{r.symbol}</span>
                    <span className="ml-1.5 text-[9px] uppercase tracking-eyebrow text-ink/40">{r.status}</span>
                  </td>
                  <td className="px-3 py-2"><CadenceTag cadence={r.cadence} /></td>
                  <td className="px-3 py-2 tabular-nums text-ink/55">{r.opened_on}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink/70">{formatNaira(r.entry_price)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink/70">{r.current_price == null ? "—" : formatNaira(r.current_price)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink/70">{formatNairaCompact(r.amount_ngn)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${toneClass(r.unrealized)}`}>{signedCompact(r.unrealized)}</td>
                  <td className="px-3 py-2 text-right"><Delta value={r.unrealized_pct} showArrow={false} className="text-[11px]" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Compliance footer */}
        <div className="mt-6 border-t border-stone pt-3">
          <p className="font-sans text-[10px] leading-relaxed text-ink/50">
            Simulated / illustrative. The Alternative Strategies Engine paper-trades only — it places no real
            orders and holds no client assets. Positions are AI-selected and risk-sized by transparent rules; this
            report reflects marked simulated performance and AI-generated commentary, not realised client returns.
            Not investment advice, not a recommendation, and not an offer. Prices are delayed up to 20 minutes
            during NGX hours; past performance does not indicate future results. BRB Capital Group — Inclusive
            Wealth. Beyond Borders.
          </p>
        </div>
      </div>
    </div>
  );
}

function RStat({
  label,
  value,
  valueClass,
  sub,
  extra,
}: {
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-stone bg-surface px-3.5 py-3 shadow-card print:bg-transparent print:shadow-none">
      <p className="font-sans text-[9px] font-semibold uppercase tracking-eyebrow text-ink/40">{label}</p>
      <p className={`mt-1 font-serif text-base font-semibold tabular-nums text-forest ${valueClass ?? ""}`}>{value}</p>
      {sub && <p className="font-sans text-[10px] text-ink/45">{sub}</p>}
      {extra}
    </div>
  );
}
