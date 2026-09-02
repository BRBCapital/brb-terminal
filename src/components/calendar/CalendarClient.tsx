"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Coins,
  Banknote,
  FileText,
  CalendarX2,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { fetchProxy } from "@/lib/ngx/browser";
import type { UpcomingDividends, Paginated, DisclosureRow } from "@/lib/ngx/types";

interface Holiday {
  id: number;
  date: string; // YYYY-MM-DD
  name: string;
}
interface HolidaysResp {
  holidays: Holiday[];
  count: number;
}

type Kind = "ex_div" | "div_pay" | "filing" | "holiday";
type Scope = "all" | "holdings" | "watchlist";

interface CatalystEvent {
  id: string;
  date: string; // YYYY-MM-DD — the calendar date
  kind: Kind;
  symbol?: string;
  company?: string;
  title: string;
  detail?: string;
  category?: string; // disclosure submission_type (trimmed)
  url?: string; // external document (filings)
}

// --- date helpers ---------------------------------------------------------
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function parseYmd(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function daysFromToday(dateStr: string): number {
  return Math.round((parseYmd(dateStr).getTime() - startOfToday().getTime()) / 86_400_000);
}
function relLabel(dateStr: string): string {
  const n = daysFromToday(dateStr);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  return n > 0 ? `in ${n}d` : `${-n}d ago`;
}
function dayHeader(dateStr: string): string {
  return parseYmd(dateStr).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function groupByDate(events: CatalystEvent[]): { date: string; items: CatalystEvent[] }[] {
  const map = new Map<string, CatalystEvent[]>();
  for (const e of events) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date)!.push(e);
  }
  return [...map.entries()].map(([date, items]) => ({ date, items }));
}

const KIND_META: Record<Kind, { label: string; icon: typeof Coins; tint: string }> = {
  ex_div: { label: "Ex-dividend", icon: Coins, tint: "text-fresh" },
  div_pay: { label: "Dividend paid", icon: Banknote, tint: "text-forest-soft" },
  filing: { label: "Filing", icon: FileText, tint: "text-ink/60" },
  holiday: { label: "NGX holiday", icon: CalendarX2, tint: "text-amber-600" },
};

export function CalendarClient() {
  const [dividends, setDividends] = useState<UpcomingDividends["dividends"]>([]);
  const [disclosures, setDisclosures] = useState<DisclosureRow[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [scopeSyms, setScopeSyms] = useState<{ holdings: string[]; watchlist: string[] }>({
    holdings: [],
    watchlist: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const [scope, setScope] = useState<Scope>("all");
  const [kinds, setKinds] = useState<Record<Kind, boolean>>({
    ex_div: true,
    div_pay: true,
    filing: true,
    holiday: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const [div, dis, hol, scopeRes] = await Promise.all([
        fetchProxy<UpcomingDividends>("dividends/upcoming", { limit: 100 }),
        fetchProxy<Paginated<DisclosureRow>>("disclosures", { limit: 100 }),
        fetchProxy<HolidaysResp>("market/holidays"),
        fetch("/api/me/symbols", { headers: { Accept: "application/json" } })
          .then((r) => r.json())
          .catch(() => ({ ok: false })),
      ]);
      if (cancelled) return;
      setDividends(div.ok ? div.data.dividends ?? [] : []);
      setDisclosures(dis.ok ? dis.data.data ?? [] : []);
      setHolidays(hol.ok ? hol.data.holidays ?? [] : []);
      if (scopeRes?.ok) {
        setScopeSyms({ holdings: scopeRes.holdings ?? [], watchlist: scopeRes.watchlist ?? [] });
      }
      if (!div.ok && !dis.ok && !hol.ok) {
        setError("Could not load calendar data from the NGN Market feed.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  // Assemble the unified event list from the three feeds.
  const allEvents = useMemo<CatalystEvent[]>(() => {
    const events: CatalystEvent[] = [];
    // Include the source-array index in every id so React keys stay unique even
    // when the feed has two rows with the same symbol/date/title prefix (the NGX
    // disclosure feed does emit near-duplicate filings).
    dividends.forEach((d, di) => {
      const sym = d.symbol?.toUpperCase();
      const dps = d.dividend != null ? `₦${d.dividend.toLocaleString("en-NG", { maximumFractionDigits: 2 })}` : "";
      const yieldStr = d.yield != null ? ` · yield ${d.yield.toFixed(2)}%` : "";
      if (d.ex_dividend_date) {
        events.push({
          id: `exdiv-${di}-${sym}`,
          date: d.ex_dividend_date,
          kind: "ex_div",
          symbol: sym,
          company: d.company_name,
          title: `${sym} goes ex-dividend`,
          detail: `${dps}/sh ${d.type ?? ""}`.trim() + yieldStr,
        });
      }
      if (d.payment_date) {
        events.push({
          id: `divpay-${di}-${sym}`,
          date: d.payment_date,
          kind: "div_pay",
          symbol: sym,
          company: d.company_name,
          title: `${sym} dividend payment`,
          detail: `${dps}/sh ${d.type ?? ""}`.trim(),
        });
      }
    });
    disclosures.forEach((r, ri) => {
      const sym = r.company_symbol?.toUpperCase();
      events.push({
        id: `fil-${ri}-${sym}`,
        date: (r.disclosed_at || "").slice(0, 10),
        kind: "filing",
        symbol: sym,
        company: r.company_name,
        title: r.title,
        category: (r.submission_type || "Filing").trim(),
        url: r.document_url || undefined,
      });
    });
    holidays.forEach((h, hi) => {
      events.push({
        id: `hol-${hi}-${h.date}`,
        date: h.date,
        kind: "holiday",
        title: h.name,
      });
    });
    return events;
  }, [dividends, disclosures, holidays]);

  const scopeSet = useMemo(() => {
    if (scope === "holdings") return new Set(scopeSyms.holdings);
    if (scope === "watchlist") return new Set(scopeSyms.watchlist);
    return null; // all market
  }, [scope, scopeSyms]);

  // Apply scope + kind filters. Holidays are market-wide — always in scope.
  const filtered = useMemo(() => {
    return allEvents.filter((e) => {
      if (!kinds[e.kind]) return false;
      if (scopeSet && e.kind !== "holiday") {
        return e.symbol ? scopeSet.has(e.symbol) : false;
      }
      return true;
    });
  }, [allEvents, kinds, scopeSet]);

  // Upcoming: forward-dated dividends + holidays, ascending.
  const upcoming = useMemo(() => {
    const rows = filtered
      .filter((e) => e.kind !== "filing" && daysFromToday(e.date) >= 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    return groupByDate(rows);
  }, [filtered]);

  // Recent filings: disclosures, newest first (cap for a tidy page).
  const recentFilings = useMemo(() => {
    const rows = filtered
      .filter((e) => e.kind === "filing")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 60);
    return groupByDate(rows);
  }, [filtered]);

  const upcomingCount = upcoming.reduce((n, g) => n + g.items.length, 0);
  const filingCount = recentFilings.reduce((n, g) => n + g.items.length, 0);
  const scopeEmpty =
    (scope === "holdings" && scopeSyms.holdings.length === 0) ||
    (scope === "watchlist" && scopeSyms.watchlist.length === 0);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ScopeChip active={scope === "all"} onClick={() => setScope("all")} label="All market" />
          <ScopeChip
            active={scope === "holdings"}
            onClick={() => setScope("holdings")}
            label={`My holdings${scopeSyms.holdings.length ? ` (${scopeSyms.holdings.length})` : ""}`}
          />
          <ScopeChip
            active={scope === "watchlist"}
            onClick={() => setScope("watchlist")}
            label={`Watchlists${scopeSyms.watchlist.length ? ` (${scopeSyms.watchlist.length})` : ""}`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(KIND_META) as Kind[]).map((k) => (
            <KindToggle
              key={k}
              kind={k}
              active={kinds[k]}
              onClick={() => setKinds((s) => ({ ...s, [k]: !s[k] }))}
            />
          ))}
          <button
            onClick={() => setNonce((n) => n + 1)}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-stone px-2.5 py-1 font-sans text-[11px] text-forest hover:bg-sand disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-3 font-sans text-[12px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upcoming */}
        <Panel
          title="Upcoming catalysts"
          subtitle="Ex-dividend & payment dates and NGX market holidays, ahead"
          right={<span className="font-sans text-[11px] text-ink/45">{upcomingCount} events</span>}
        >
          {loading ? (
            <Skeleton />
          ) : scopeEmpty ? (
            <EmptyState text={`No ${scope === "holdings" ? "holdings" : "watchlist names"} yet — add some, or switch to “All market”.`} />
          ) : upcomingCount === 0 ? (
            <EmptyState text="No upcoming dividend dates or holidays match these filters." />
          ) : (
            <EventGroups groups={upcoming} />
          )}
        </Panel>

        {/* Recent filings */}
        <Panel
          title="Recent filings"
          subtitle="Latest NGX corporate disclosures — results, corporate actions, AGMs"
          right={<span className="font-sans text-[11px] text-ink/45">{filingCount} filings</span>}
        >
          {loading ? (
            <Skeleton />
          ) : scopeEmpty ? (
            <EmptyState text={`No ${scope === "holdings" ? "holdings" : "watchlist names"} yet — add some, or switch to “All market”.`} />
          ) : filingCount === 0 ? (
            <EmptyState text="No disclosures match these filters." />
          ) : (
            <EventGroups groups={recentFilings} />
          )}
        </Panel>
      </div>

      <p className="brb-callout py-2 font-sans text-[11px] leading-relaxed text-ink/55">
        Catalyst data is sourced from the NGN Market API (dividends, corporate disclosures and the NGX
        holiday calendar) and may be delayed. Dates reflect what the exchange has published; always verify
        against the official filing before acting. For internal analysis — not investment advice.
      </p>
    </div>
  );
}

function EventGroups({ groups }: { groups: { date: string; items: CatalystEvent[] }[] }) {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.date}>
          <div className="mb-1.5 flex items-baseline gap-2">
            <h4 className="font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest">
              {dayHeader(g.date)}
            </h4>
            <span className="font-sans text-[10px] text-ink/40">{relLabel(g.date)}</span>
          </div>
          <ul className="space-y-1.5">
            {g.items.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function EventRow({ e }: { e: CatalystEvent }) {
  const meta = KIND_META[e.kind];
  const Icon = meta.icon;
  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-stone/70 bg-surface px-3 py-2">
      <span className={`mt-0.5 shrink-0 ${meta.tint}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {e.symbol && (
            <Link
              href={`/stocks/${e.symbol}`}
              className="font-sans text-[11px] font-bold uppercase tracking-wide text-forest hover:underline"
            >
              {e.symbol}
            </Link>
          )}
          {e.category && (
            <span className="rounded-full bg-sand px-1.5 py-0.5 font-sans text-[9px] uppercase tracking-eyebrow text-ink/55">
              {e.category}
            </span>
          )}
        </div>
        <p className="truncate font-sans text-[12.5px] text-ink">{e.title}</p>
        {e.detail && <p className="font-sans text-[11px] text-ink/55">{e.detail}</p>}
      </div>
      {e.url && (
        <a
          href={e.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 shrink-0 text-ink/40 hover:text-forest"
          title="Open the official filing (opens NGX document)"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </li>
  );
}

function ScopeChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 font-sans text-[12px] font-medium transition-colors ${
        active
          ? "bg-forest text-[#F5F2EC]"
          : "border border-stone text-forest hover:bg-sand"
      }`}
    >
      {label}
    </button>
  );
}

function KindToggle({ kind, active, onClick }: { kind: Kind; active: boolean; onClick: () => void }) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-sans text-[11px] transition-colors ${
        active ? "border-fresh bg-fresh/[0.08] text-forest" : "border-stone text-ink/45 hover:bg-sand"
      }`}
    >
      <Icon className={`h-3 w-3 ${active ? meta.tint : ""}`} /> {meta.label}
    </button>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-stone/60" />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center px-4 py-8 text-center">
      <p className="max-w-xs font-sans text-[12px] leading-relaxed text-ink/50">{text}</p>
    </div>
  );
}
