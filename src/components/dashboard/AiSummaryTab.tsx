"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Activity,
  TrendingUp,
  ArrowLeftRight,
  Target,
  Link2,
  Globe,
  Newspaper,
} from "lucide-react";
import { AiMarkdown } from "@/components/ui/AiMarkdown";
import { formatDate, formatTimestamp } from "@/lib/format";
import type { AiSummary } from "@/lib/db/ai-summaries";

type State =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "ready"; summary: AiSummary }
  | { kind: "error"; message: string; code?: string };

// Split the markdown briefing into its known sections (## Headline, ## Market
// Action, ## Movers & Sectors, ## FX, ## Takeaway, ## Sources). Returns null if
// nothing parses, so we can fall back to plain markdown.
function parseSections(md: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const part of md.split(/^##\s+/m)) {
    if (!part.trim()) continue;
    const nl = part.indexOf("\n");
    const title = (nl === -1 ? part : part.slice(0, nl)).trim().toLowerCase();
    const body = nl === -1 ? "" : part.slice(nl + 1).trim();
    if (title) out[title] = body;
  }
  return Object.keys(out).length ? out : null;
}

export function AiSummaryTab() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [generating, setGenerating] = useState(false);
  const [webContext, setWebContext] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-summary", { cache: "no-store" });
      const body = await res.json();
      if (body.ok && body.summary) setState({ kind: "ready", summary: body.summary });
      else setState({ kind: "empty" });
    } catch {
      setState({ kind: "error", message: "Could not load the summary." });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webContext }),
      });
      const body = await res.json();
      if (body.ok && body.summary) setState({ kind: "ready", summary: body.summary });
      else setState({ kind: "error", message: body.error ?? "Generation failed.", code: body.errorCode });
    } catch {
      setState({ kind: "error", message: "Could not reach the server." });
    } finally {
      setGenerating(false);
    }
  }

  const summary = state.kind === "ready" ? state.summary : null;
  const sections = summary ? parseSections(summary.content) : null;
  const webCited = !!sections?.["sources"];

  return (
    <div className="space-y-4">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="brb-card overflow-hidden p-0">
        <div className="relative bg-gradient-to-br from-forest via-forest to-forest-soft px-5 py-4 text-[#F5F2EC]">
          {/* soft glow accent */}
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-fresh/20 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fresh/20 ring-1 ring-fresh/40">
                <Sparkles className="h-5 w-5 text-fresh" />
              </span>
              <div>
                <p className="font-sans text-[10px] font-semibold uppercase tracking-eyebrow text-fresh/80">
                  AI Market Briefing · Claude
                </p>
                <h2 className="font-serif text-xl font-bold leading-tight text-[#F5F2EC]">
                  NGX Daily Read
                </h2>
                {summary && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <MetaPill>Session {formatDate(summary.trade_date)}</MetaPill>
                    <MetaPill>Generated {formatTimestamp(summary.created_at)} WAT</MetaPill>
                    <MetaPill>{summary.model}</MetaPill>
                    {webCited && (
                      <MetaPill tone="fresh">
                        <Globe className="h-3 w-3" /> Web-cited
                      </MetaPill>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={generate}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-lg bg-fresh px-4 py-2 font-sans text-[13px] font-semibold text-forest transition-all hover:brightness-95 disabled:opacity-50"
              >
                {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Analyzing…" : summary ? "Regenerate" : "Generate briefing"}
              </button>
              <label
                className="flex cursor-pointer items-center gap-1.5 font-sans text-[10.5px] text-[#F5F2EC]/70"
                title="Claude runs up to 3 web searches for Nigerian-market context (policy, corporate events) and cites its sources. NGX figures always come from the API data."
              >
                <input
                  type="checkbox"
                  checked={webContext}
                  onChange={(e) => setWebContext(e.target.checked)}
                  disabled={generating}
                  className="accent-fresh"
                />
                Include web context (cited)
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      {state.kind === "loading" && <LoadingBody />}
      {state.kind === "empty" && <EmptyBody generating={generating} onGenerate={generate} />}
      {state.kind === "error" && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-amber-400/60 bg-amber-50 p-4 dark:bg-amber-950/30">
          <p className="flex items-start gap-2 font-sans text-[13px] text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {state.message}
          </p>
          {state.code !== "NO_CREDENTIALS" && (
            <button
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-fresh px-4 py-2 font-sans text-[13px] font-semibold text-forest hover:brightness-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} /> Try again
            </button>
          )}
        </div>
      )}
      {summary && (sections ? <StructuredBriefing sections={sections} /> : <PlainBriefing content={summary.content} />)}

      {/* ── Compliance ───────────────────────────────────────────────── */}
      <div className="brb-callout py-2">
        <p className="font-sans text-[11px] leading-relaxed text-ink/55">
          AI-generated briefing for internal analytical use — verify figures against the source dashboard before relying on
          them. Descriptive only: not investment advice, a recommendation, or a prediction. Prices are delayed up to 20 minutes
          during NGX hours. Past performance does not indicate future results.
        </p>
      </div>
    </div>
  );
}

// ── Structured layout for the standard 5-section briefing ──────────────
function StructuredBriefing({ sections }: { sections: Record<string, string> }) {
  const headline = sections["headline"]?.replace(/\*\*/g, "").trim();
  const marketAction = sections["market action"];
  const moversSectors = sections["movers & sectors"] ?? sections["movers and sectors"];
  const fx = sections["fx"];
  const takeaway = sections["takeaway"];
  const sources = sections["sources"];

  return (
    <div className="space-y-4">
      {headline && (
        <div className="brb-card border-l-4 border-l-fresh p-5">
          <p className="mb-1 font-sans text-[10px] font-semibold uppercase tracking-eyebrow text-forest-soft">Headline</p>
          <p className="font-serif text-[19px] font-semibold leading-snug text-forest">{headline}</p>
        </div>
      )}

      {marketAction && (
        <SectionCard icon={<Activity className="h-4 w-4" />} title="Market Action" body={marketAction} />
      )}

      {(moversSectors || fx) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {moversSectors && (
            <SectionCard icon={<TrendingUp className="h-4 w-4" />} title="Movers & Sectors" body={moversSectors} />
          )}
          {fx && <SectionCard icon={<ArrowLeftRight className="h-4 w-4" />} title="FX" body={fx} />}
        </div>
      )}

      {takeaway && (
        <div className="rounded-xl border border-fresh/30 bg-fresh/[0.08] p-5">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fresh/20 text-forest-soft">
              <Target className="h-4 w-4" />
            </span>
            <h3 className="font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest-soft">Bottom line</h3>
          </div>
          <div className="[&_p:last-child]:mb-0">
            <AiMarkdown content={takeaway} />
          </div>
        </div>
      )}

      {sources && <SectionCard icon={<Link2 className="h-4 w-4" />} title="Sources" body={sources} muted />}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  body,
  muted,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  muted?: boolean;
}) {
  return (
    <div className="brb-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fresh/15 text-forest-soft">{icon}</span>
        <h3 className="font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest-soft">{title}</h3>
      </div>
      <div className={muted ? "text-[12px] opacity-80" : ""}>
        <AiMarkdown content={body} />
      </div>
    </div>
  );
}

// Fallback: model didn't follow the section format — render raw markdown cleanly.
function PlainBriefing({ content }: { content: string }) {
  return (
    <div className="brb-card p-5">
      <AiMarkdown content={content} />
    </div>
  );
}

function LoadingBody() {
  return (
    <div className="space-y-4">
      <div className="brb-card border-l-4 border-l-fresh p-5">
        <div className="h-3 w-16 animate-pulse rounded bg-stone" />
        <div className="mt-2 h-5 w-3/4 animate-pulse rounded bg-stone" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="brb-card space-y-2 p-4">
          <div className="h-3 w-28 animate-pulse rounded bg-stone" />
          <div className="h-3.5 w-full animate-pulse rounded bg-stone" />
          <div className="h-3.5 w-5/6 animate-pulse rounded bg-stone" />
        </div>
      ))}
    </div>
  );
}

function EmptyBody({ generating, onGenerate }: { generating: boolean; onGenerate: () => void }) {
  return (
    <div className="brb-card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fresh/15">
        <Newspaper className="h-7 w-7 text-fresh" />
      </span>
      <p className="font-serif text-lg text-forest">No briefing yet for today&apos;s session</p>
      <p className="max-w-md font-sans text-[13px] leading-relaxed text-ink/55">
        Claude reads today&apos;s snapshot, movers, sectors and FX and writes a desk-style briefing — headline, market action,
        movers &amp; sectors, FX and a bottom line. One briefing is kept per trading day.
      </p>
      <button
        onClick={onGenerate}
        disabled={generating}
        className="mt-1 inline-flex items-center gap-2 rounded-lg bg-fresh px-5 py-2.5 font-sans text-[13px] font-semibold text-forest transition-all hover:brightness-95 disabled:opacity-50"
      >
        {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {generating ? "Analyzing the market…" : "Generate today's briefing"}
      </button>
    </div>
  );
}

function MetaPill({ children, tone }: { children: ReactNode; tone?: "fresh" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-sans text-[9.5px] font-medium uppercase tracking-eyebrow ${
        tone === "fresh" ? "bg-fresh/25 text-fresh" : "bg-[#F5F2EC]/10 text-[#F5F2EC]/75"
      }`}
    >
      {children}
    </span>
  );
}
