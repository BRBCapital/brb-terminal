"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FolderOpen, ChevronRight, Layers, PieChart } from "lucide-react";
import { fetchPortfolios } from "@/lib/portfolio/api";
import { formatDate } from "@/lib/format";
import type { PortfolioSummary } from "@/lib/db/portfolios";

export function PortfolioList() {
  const [portfolios, setPortfolios] = useState<PortfolioSummary[] | null>(null);

  useEffect(() => {
    fetchPortfolios().then(setPortfolios);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-sans text-[11px] uppercase tracking-eyebrow text-ink/45">
          {portfolios === null
            ? "Loading…"
            : `${portfolios.length} ${portfolios.length === 1 ? "portfolio" : "portfolios"}`}
        </p>
        <Link
          href="/portfolios/new"
          className="inline-flex items-center gap-2 rounded-lg bg-fresh px-4 py-2 font-sans text-sm font-semibold text-forest shadow-sm transition hover:brightness-95"
        >
          <Plus className="h-4 w-4" /> New portfolio
        </Link>
      </div>

      {portfolios === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-xl bg-stone" />
          ))}
        </div>
      ) : portfolios.length === 0 ? (
        <div className="brb-card flex flex-col items-center gap-2 p-12 text-center">
          <FolderOpen className="h-8 w-8 text-ink/30" />
          <p className="font-serif text-lg text-forest">No portfolios yet</p>
          <p className="font-sans text-[13px] text-ink/55">
            Build a model portfolio from the screener or company search.
          </p>
          <Link
            href="/portfolios/new"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-fresh px-4 py-2 font-sans text-sm font-semibold text-forest hover:brightness-95"
          >
            <Plus className="h-4 w-4" /> Create your first portfolio
          </Link>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {portfolios.map((p) => (
            <li key={p.id}>
              <Link
                href={`/portfolios/${p.id}`}
                className="group brb-card brb-card-interactive relative flex items-center gap-4 overflow-hidden p-4 pl-5"
              >
                {/* Accent rail */}
                <span className="absolute inset-y-0 left-0 w-1 bg-fresh/70 transition-colors group-hover:bg-fresh" />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-serif text-lg font-semibold text-forest">
                      {p.name}
                    </p>
                    <span className="hidden shrink-0 rounded bg-sand px-1.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-eyebrow text-ink/55 sm:inline">
                      {p.base_currency || "NGN"}
                    </span>
                  </div>
                  {p.mandate_notes ? (
                    <p className="mt-0.5 line-clamp-1 font-sans text-[12px] text-ink/55">
                      {p.mandate_notes}
                    </p>
                  ) : (
                    <p className="mt-0.5 font-sans text-[12px] italic text-ink/35">No mandate note</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[11px] text-ink/55">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3 w-3 text-ink/35" />
                      {Number(p.holdings_count) || 0} {Number(p.holdings_count) === 1 ? "holding" : "holdings"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <PieChart className="h-3 w-3 text-ink/35" />
                      {Number(p.sector_count) || 0} {Number(p.sector_count) === 1 ? "sector" : "sectors"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="font-semibold uppercase tracking-eyebrow text-ink/40">Bench</span>
                      {p.benchmark_symbol}
                    </span>
                  </div>
                </div>

                <div className="hidden shrink-0 text-right font-sans text-[10px] uppercase tracking-eyebrow text-ink/40 sm:block">
                  <p>Updated</p>
                  <p className="text-ink/55">{formatDate(p.updated_at)}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink/30 transition-transform group-hover:translate-x-0.5 group-hover:text-forest" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
