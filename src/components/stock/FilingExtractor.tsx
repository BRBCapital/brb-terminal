"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Sparkles, RefreshCw, ExternalLink, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { AiMarkdown } from "@/components/ui/AiMarkdown";
import { formatDate, formatTimestamp } from "@/lib/format";
import type { FilingRef } from "@/lib/ai/filing-extract";
import type { AiFiling } from "@/lib/db/ai-filings";

export function FilingExtractor({ symbol }: { symbol: string }) {
  const [filings, setFilings] = useState<FilingRef[] | null>(null);
  const [extractions, setExtractions] = useState<Record<string, AiFiling>>({});
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/filings/${symbol}`, { cache: "no-store" });
    if (!res.ok) {
      setFilings([]);
      return;
    }
    const body = await res.json();
    if (body.ok) {
      setFilings(body.filings);
      const map: Record<string, AiFiling> = {};
      for (const f of body.extractions as AiFiling[]) map[f.document_url] = f;
      setExtractions(map);
    } else setFilings([]);
  }, [symbol]);

  useEffect(() => {
    load();
  }, [load]);

  async function extract(f: FilingRef, force = false) {
    setBusyUrl(f.document_url);
    setError(null);
    try {
      const res = await fetch(`/api/filings/${symbol}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentUrl: f.document_url, title: f.title, force }),
      });
      const body = await res.json();
      if (body.ok && body.filing) {
        setExtractions((m) => ({ ...m, [f.document_url]: body.filing }));
        setOpenUrl(f.document_url);
      } else {
        setError(body.error ?? "Extraction failed.");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusyUrl(null);
    }
  }

  return (
    <Panel
      title="AI statement extraction"
      subtitle="Claude reads the official NGX filing PDF and extracts the statements with page citations"
    >
      {filings === null ? (
        <div className="space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-stone" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-stone" />
        </div>
      ) : filings.length === 0 ? (
        <p className="py-4 text-center font-sans text-[13px] text-ink/55">
          No financial-statement filings found in the recent disclosures for {symbol}.
        </p>
      ) : (
        <div className="space-y-3">
          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-3 font-sans text-[12px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
          <ul className="divide-y divide-stone">
            {filings.map((f) => {
              const done = extractions[f.document_url];
              const open = openUrl === f.document_url;
              const busy = busyUrl === f.document_url;
              return (
                <li key={f.document_url} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-ink/35" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-sans text-[13px] font-medium capitalize text-forest">
                        {f.title}
                      </p>
                      <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/40">
                        {f.submission_type} · disclosed {formatDate(f.disclosed_at)}
                        {done ? ` · extracted ${formatTimestamp(done.created_at)}` : ""}
                      </p>
                    </div>
                    <a
                      href={f.document_url}
                      target="_blank"
                      rel="noreferrer"
                      title="Open the official PDF"
                      className="inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1 font-sans text-[11px] text-forest-soft hover:bg-sand"
                    >
                      <ExternalLink className="h-3 w-3" /> PDF
                    </a>
                    {done ? (
                      <button
                        onClick={() => setOpenUrl(open ? null : f.document_url)}
                        className="inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1 font-sans text-[11px] font-semibold text-forest hover:bg-sand"
                      >
                        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {open ? "Hide" : "View extraction"}
                      </button>
                    ) : (
                      <button
                        onClick={() => extract(f)}
                        disabled={busy || busyUrl !== null}
                        className="inline-flex items-center gap-1 rounded-md bg-fresh px-2.5 py-1 font-sans text-[11px] font-semibold text-forest hover:brightness-95 disabled:opacity-50"
                      >
                        {busy ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        {busy ? "Reading filing…" : "Extract with Claude"}
                      </button>
                    )}
                  </div>

                  {done && open && (
                    <div className="mt-3 rounded-lg border border-stone bg-sand/40 p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone pb-2 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                        <span>Model {done.model}</span>
                        <span>*[p.N]* markers cite source pages</span>
                        <button
                          onClick={() => extract(f, true)}
                          disabled={busyUrl !== null}
                          className="ml-auto text-forest-soft hover:underline disabled:opacity-50"
                        >
                          Re-extract
                        </button>
                      </div>
                      <AiMarkdown content={done.content} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="font-sans text-[10px] leading-relaxed text-ink/45">
            AI-extracted from the official filing — figures are only as reliable
            as the extraction; verify against the linked PDF (page citations
            included) before relying on them. Not investment advice.
          </p>
        </div>
      )}
    </Panel>
  );
}
