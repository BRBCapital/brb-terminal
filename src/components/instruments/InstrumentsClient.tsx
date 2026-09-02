"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useNgx } from "@/hooks/useNgx";
import { Delta } from "@/components/ui/Delta";
import { TileBody } from "@/components/ui/Tile";
import { CsvExportButton } from "@/components/ui/ExportButtons";
import { formatNaira, formatCompactNumber, formatDate, formatPercent } from "@/lib/format";
import type { BondRow, EtfRow, Paginated } from "@/lib/ngx/types";

const TABS = ["Bonds", "ETFs"] as const;
type Tab = (typeof TABS)[number];

export function InstrumentsClient() {
  const [tab, setTab] = useState<Tab>("Bonds");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-stone">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "-mb-px border-b-2 px-3 py-2 font-sans text-[12px] font-semibold uppercase tracking-eyebrow transition-colors",
              tab === t ? "border-fresh text-forest" : "border-transparent text-ink/45 hover:text-forest"
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Bonds" ? <BondsTab /> : <EtfsTab />}
    </div>
  );
}

function BondsTab() {
  const query = useNgx<Paginated<BondRow>>("bonds", { query: { limit: 300 } });
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const rows = query.data?.ok ? query.data.data.data : [];
  const types = useMemo(() => [...new Set(rows.map((r) => r.type).filter(Boolean))].sort(), [rows]);
  const filtered = rows.filter((r) => {
    if (type && r.type !== type) return false;
    const t = search.trim().toLowerCase();
    return !t || r.name.toLowerCase().includes(t) || r.issuer.toLowerCase().includes(t);
  });

  return (
    <div className="brb-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search bond or issuer…"
          className="min-w-48 flex-1 rounded-lg border border-stone bg-surface px-3 py-1.5 font-sans text-sm outline-none focus:border-fresh"
        />
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-stone bg-surface px-3 py-1.5 font-sans text-sm capitalize outline-none focus:border-fresh">
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t} className="capitalize">{t}</option>
          ))}
        </select>
        <span className="ml-auto font-sans text-[11px] uppercase tracking-eyebrow text-ink/45">{filtered.length} of {rows.length}</span>
        <CsvExportButton rows={filtered} filename="ngx-bonds" columns={[
          { key: "name", label: "Name" }, { key: "issuer", label: "Issuer" }, { key: "type", label: "Type" },
          { key: "coupon", label: "Coupon %" }, { key: "maturity_date", label: "Maturity" }, { key: "isin", label: "ISIN" },
        ]} />
      </div>
      <TileBody query={query} isEmpty={() => rows.length === 0}>
        {() => (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-left font-sans text-[13px]">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                  <th className="px-3 py-2 font-medium">Bond</th>
                  <th className="px-3 py-2 font-medium">Issuer</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 text-right font-medium">Coupon</th>
                  <th className="px-3 py-2 text-right font-medium">Maturity</th>
                  <th className="px-3 py-2 text-right font-medium">Open price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-sand/70">
                    <td className="px-3 py-2 font-semibold text-forest">{b.name}</td>
                    <td className="px-3 py-2 text-[12px] text-ink/70">{b.issuer}</td>
                    <td className="px-3 py-2 capitalize text-[12px] text-ink/60">{b.type}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.coupon != null ? `${b.coupon}%` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink/70">{formatDate(b.maturity_date)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNaira(b.open_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TileBody>
    </div>
  );
}

function EtfsTab() {
  const router = useRouter();
  const query = useNgx<Paginated<EtfRow>>("etfs", { query: { limit: 100 } });
  const [search, setSearch] = useState("");
  const rows = query.data?.ok ? query.data.data.data : [];
  const filtered = rows.filter((r) => {
    const t = search.trim().toLowerCase();
    return !t || r.symbol.toLowerCase().includes(t) || r.name.toLowerCase().includes(t);
  });

  return (
    <div className="brb-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone p-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ETF…" className="min-w-48 flex-1 rounded-lg border border-stone bg-surface px-3 py-1.5 font-sans text-sm outline-none focus:border-fresh" />
        <span className="ml-auto font-sans text-[11px] uppercase tracking-eyebrow text-ink/45">{filtered.length} of {rows.length}</span>
        <CsvExportButton rows={filtered} filename="ngx-etfs" columns={[
          { key: "symbol", label: "Symbol" }, { key: "name", label: "Name" }, { key: "fund_manager", label: "Manager" },
          { key: "index_tracked", label: "Index" }, { key: "current_price", label: "Price" }, { key: "change_ytd_percent", label: "YTD %" },
        ]} />
      </div>
      <TileBody query={query} isEmpty={() => rows.length === 0}>
        {() => (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-left font-sans text-[13px]">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                  <th className="px-3 py-2 font-medium">ETF</th>
                  <th className="px-3 py-2 font-medium">Tracks</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                  <th className="px-3 py-2 text-right font-medium">Day</th>
                  <th className="px-3 py-2 text-right font-medium">YTD</th>
                  <th className="px-3 py-2 text-right font-medium">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone">
                {filtered.map((e) => (
                  <tr key={e.id} onClick={() => router.push(`/etfs/${e.symbol}`)} className="cursor-pointer hover:bg-sand/70">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-forest">{e.symbol}</p>
                      <p className="truncate text-[10px] text-ink/45">{e.name}</p>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-ink/60">{e.index_tracked ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNaira(e.current_price)}</td>
                    <td className="px-3 py-2 text-right"><Delta value={e.price_change_percent} showArrow={false} className="text-[12px]" /></td>
                    <td className="px-3 py-2 text-right"><Delta value={e.change_ytd_percent} showArrow={false} className="text-[12px]" /></td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink/60">{formatCompactNumber(e.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TileBody>
    </div>
  );
}
