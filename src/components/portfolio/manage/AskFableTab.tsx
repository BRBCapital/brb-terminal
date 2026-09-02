"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Send, RefreshCw, AlertTriangle, User, FileText } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { AiMarkdown } from "@/components/ui/AiMarkdown";
import type { ManageData } from "./useManageData";
import type { ReviewSnapshot } from "@/lib/ai/portfolio-review";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Analyse this book's concentration and sector tilt.",
  "Which holdings would you consider trimming, and why?",
  "Suggest 2–3 names to add from the NGX universe.",
  "What are the biggest risks in this portfolio right now?",
];

export function AskFableTab({ id, data }: { id: string; data: ManageData }) {
  const { portfolio, valued, totals, lastUpdated } = data;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [toolSymbol, setToolSymbol] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, toolSymbol]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy || !snapshot) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: q }];
    // Add an empty assistant bubble we stream tokens into.
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setToolSymbol(null);

    // Progressively update the trailing (assistant) message.
    const setReply = (content: string) =>
      setMessages((m) => m.map((msg, i) => (i === m.length - 1 ? { ...msg, content } : msg)));

    let reply = "";
    let failed: string | null = null;
    try {
      const res = await fetch(`/api/portfolios/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot, messages: next }),
      });

      // Auth/validation failures come back as plain JSON, not a stream.
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok || !res.body || ct.includes("application/json")) {
        let msg = "Fable could not answer — try again.";
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
            let ev: { type: string; text?: string; symbol?: string; error?: string };
            try {
              ev = JSON.parse(line);
            } catch {
              continue;
            }
            if (ev.type === "delta" && ev.text) {
              reply += ev.text;
              setToolSymbol(null);
              setReply(reply);
            } else if (ev.type === "tool") {
              setToolSymbol(ev.symbol || "");
            } else if (ev.type === "error") {
              failed = ev.error ?? "Fable could not answer — try again.";
            }
            // "done" needs no handling — the reply is already rendered.
          }
        }
      }
    } catch {
      failed = "Could not reach the server.";
    } finally {
      setToolSymbol(null);
      setBusy(false);
      if (failed) {
        setError(failed);
        // Drop the empty/partial assistant bubble on failure.
        if (!reply) setMessages((m) => (m[m.length - 1]?.role === "assistant" && !m[m.length - 1].content ? m.slice(0, -1) : m));
      }
    }
  }

  const heldCount = snapshot?.positions.length ?? 0;

  return (
    <div className="space-y-4">
      <Panel
        title="Ask Fable"
        subtitle="Chat with Fable 5 about this portfolio — grounded in your holdings and live NGX data"
        right={
          <div className="flex items-center gap-2">
            <Link
              href={`/portfolios/${id}/report`}
              className="inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1 font-sans text-[11px] font-semibold text-forest hover:bg-sand"
              title="Generate a PDF analysis report"
            >
              <FileText className="h-3.5 w-3.5" /> PDF report
            </Link>
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([]);
                  setError(null);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1 font-sans text-[11px] text-forest hover:bg-sand"
              >
                <RefreshCw className="h-3.5 w-3.5" /> New chat
              </button>
            )}
          </div>
        }
      >
        {/* Transcript */}
        <div ref={scrollRef} className="max-h-[52vh] min-h-[16rem] space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fresh/15">
                <Sparkles className="h-6 w-6 text-fresh" />
              </span>
              <div>
                <p className="font-serif text-lg text-forest">Ask about “{portfolio?.name}”</p>
                <p className="mx-auto mt-1 max-w-md font-sans text-[13px] leading-relaxed text-ink/55">
                  Fable can analyse this book&apos;s {heldCount} holding{heldCount === 1 ? "" : "s"}, weigh concentration and
                  sector tilt, discuss individual names, and propose ideas to trim, add or rebalance — using only your
                  data and the live NGX universe.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={!snapshot || busy}
                    className="rounded-full border border-stone bg-surface px-3 py-1.5 font-sans text-[12px] text-forest transition-colors hover:border-fresh hover:bg-fresh/[0.06] disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end gap-2">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-forest px-3.5 py-2 font-sans text-[13px] leading-relaxed text-[#F5F2EC]">
                  {m.content}
                </div>
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone text-ink/50">
                  <User className="h-3.5 w-3.5" />
                </span>
              </div>
            ) : m.content ? (
              // Skip the empty placeholder bubble we stream into — the busy
              // indicator below covers the "still thinking" state.
              <div key={i} className="flex gap-2">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fresh/20 text-forest-soft">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-stone bg-surface px-3.5 py-2">
                  <AiMarkdown content={m.content} />
                </div>
              </div>
            ) : null
          )}

          {busy && !messages[messages.length - 1]?.content && (
            <div className="flex gap-2">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fresh/20 text-forest-soft">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              </span>
              <div className="rounded-2xl rounded-tl-sm border border-stone bg-surface px-3.5 py-2.5 font-sans text-[12px] text-ink/50">
                {toolSymbol
                  ? `Pulling ${toolSymbol} fundamentals from NGX…`
                  : "Fable is analysing the book…"}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-2.5 font-sans text-[12px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {/* Composer */}
        <div className="mt-3 flex items-end gap-2 border-t border-stone pt-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={snapshot ? "Ask Fable about this portfolio…" : "Add holdings to chat about this book"}
            disabled={!snapshot || busy}
            className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-stone bg-surface px-3 py-2 font-sans text-[13px] leading-relaxed text-ink outline-none focus:border-fresh disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={!snapshot || busy || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fresh text-forest transition-all hover:brightness-95 disabled:opacity-40"
            title="Send"
          >
            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </Panel>

      <div className="brb-callout py-2">
        <p className="font-sans text-[11px] leading-relaxed text-ink/55">
          Fable reasons over this portfolio&apos;s own figures and live NGX data — it does not invent prices or
          fundamentals. Answers are AI-generated <em>ideas</em> for the analyst&apos;s judgement: not investment advice,
          not a recommendation to any client, and not an order. Validate every figure and route any resulting trades
          through the <strong>Rebalancing</strong> tab for PFM/IC approval. Prices are delayed up to 20 minutes during
          NGX hours; past performance does not indicate future results.
        </p>
      </div>
    </div>
  );
}
