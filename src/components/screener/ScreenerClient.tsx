"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, Save, Trash2, Briefcase } from "lucide-react";
import { useNgx } from "@/hooks/useNgx";
import { Delta } from "@/components/ui/Delta";
import { TickerBadge } from "@/components/ui/TickerBadge";
import { TileBody } from "@/components/ui/Tile";
import { formatNaira, formatNairaCompact, formatCompactNumber } from "@/lib/format";
import { CsvExportButton } from "@/components/ui/ExportButtons";
import { fetchPresets, createPresetReq, deletePresetReq } from "@/lib/watchlist/api";
import type { CompanyListRow, Paginated } from "@/lib/ngx/types";
import type { ScreenPreset } from "@/lib/db/presets";

interface ScreenConfig {
  search: string;
  sector: string;
  band: number;
  sorting: SortingState;
}

const col = createColumnHelper<CompanyListRow>();

const MCAP_BANDS: Array<{ label: string; min: number; max: number }> = [
  { label: "All caps", min: 0, max: Infinity },
  { label: "Large ≥ ₦1T", min: 1e12, max: Infinity },
  { label: "Mid ₦100B–1T", min: 1e11, max: 1e12 },
  { label: "Small < ₦100B", min: 0, max: 1e11 },
];

export function ScreenerClient() {
  const router = useRouter();
  // Only ~150 companies — fetch all once (cached) and filter/sort client-side.
  const query = useNgx<Paginated<CompanyListRow>>("companies", {
    query: { limit: 300 },
  });

  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("");
  const [band, setBand] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "market_cap", desc: true },
  ]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [presets, setPresets] = useState<ScreenPreset[]>([]);

  useEffect(() => {
    fetchPresets().then(setPresets);
  }, []);

  function toggle(symbol: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(symbol)) n.delete(symbol);
      else n.add(symbol);
      return n;
    });
  }

  async function savePreset() {
    const name = window.prompt("Name this screen preset:");
    if (!name?.trim()) return;
    const config: ScreenConfig = { search, sector, band, sorting };
    await createPresetReq(name.trim(), config);
    setPresets(await fetchPresets());
  }

  function applyPreset(p: ScreenPreset) {
    try {
      const c = JSON.parse(p.config) as ScreenConfig;
      setSearch(c.search ?? "");
      setSector(c.sector ?? "");
      setBand(c.band ?? 0);
      if (Array.isArray(c.sorting)) setSorting(c.sorting);
    } catch {
      /* ignore malformed preset */
    }
  }

  function buildPortfolio() {
    const symbols = [...selected];
    if (!symbols.length) return;
    router.push(`/portfolios/new?symbols=${symbols.join(",")}`);
  }

  const rows = query.data?.ok ? query.data.data.data : [];
  const sectors = useMemo(
    () => [...new Set(rows.map((r) => r.sector).filter(Boolean))].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const { min, max } = MCAP_BANDS[band];
    return rows.filter((r) => {
      if (sector && r.sector !== sector) return false;
      const mc = r.market_cap ?? 0;
      if (mc < min || mc >= max) return false;
      if (term) {
        return (
          r.symbol.toLowerCase().includes(term) ||
          r.name.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [rows, search, sector, band]);

  const columns = useMemo(
    () => [
      col.accessor("symbol", {
        header: "Company",
        cell: (c) => (
          <div className="flex items-center gap-2">
            <TickerBadge
              symbol={c.getValue()}
              logoUrl={c.row.original.logo_url}
              size={24}
            />
            <div className="min-w-0">
              <p className="font-semibold text-forest">{c.getValue()}</p>
              <p className="truncate text-[10px] text-ink/45">
                {c.row.original.name}
              </p>
            </div>
          </div>
        ),
      }),
      col.accessor("sector", {
        header: "Sector",
        cell: (c) => <span className="text-[11px] text-ink/60">{c.getValue()}</span>,
      }),
      col.accessor("price", {
        header: "Price",
        cell: (c) => <span className="tabular-nums">{formatNaira(c.getValue())}</span>,
        sortingFn: "basic",
      }),
      col.accessor("price_change_percent", {
        header: "Day",
        cell: (c) => <Delta value={c.getValue()} className="text-[12px]" showArrow={false} />,
      }),
      col.accessor("change_1m_percent", {
        header: "1M",
        cell: (c) => <Delta value={c.getValue()} className="text-[12px]" showArrow={false} />,
      }),
      col.accessor("change_ytd_percent", {
        header: "YTD",
        cell: (c) => <Delta value={c.getValue()} className="text-[12px]" showArrow={false} />,
      }),
      col.accessor("change_52w_percent", {
        header: "52W",
        cell: (c) => <Delta value={c.getValue()} className="text-[12px]" showArrow={false} />,
      }),
      col.accessor("market_cap", {
        header: "Mkt cap",
        cell: (c) => <span className="tabular-nums">{formatNairaCompact(c.getValue())}</span>,
      }),
      col.accessor("volume", {
        header: "Volume",
        cell: (c) => (
          <span className="tabular-nums text-ink/60">
            {formatCompactNumber(c.getValue())}
          </span>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Nulls always sort to the bottom regardless of direction.
    sortDescFirst: true,
  });

  return (
    <div className="brb-card overflow-hidden">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ticker or name…"
          className="min-w-48 flex-1 rounded-lg border border-stone bg-surface px-3 py-1.5 font-sans text-sm outline-none focus:border-fresh"
        />
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="rounded-lg border border-stone bg-surface px-3 py-1.5 font-sans text-sm outline-none focus:border-fresh"
        >
          <option value="">All sectors</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={band}
          onChange={(e) => setBand(Number(e.target.value))}
          className="rounded-lg border border-stone bg-surface px-3 py-1.5 font-sans text-sm outline-none focus:border-fresh"
        >
          {MCAP_BANDS.map((b, i) => (
            <option key={b.label} value={i}>
              {b.label}
            </option>
          ))}
        </select>
        <span className="ml-auto font-sans text-[11px] uppercase tracking-eyebrow text-ink/45">
          {filtered.length} of {rows.length}
        </span>
        <CsvExportButton
          rows={filtered}
          filename="ngx-screen"
          columns={[
            { key: "symbol", label: "Symbol" },
            { key: "name", label: "Company" },
            { key: "sector", label: "Sector" },
            { key: "price", label: "Price (NGN)" },
            { key: "price_change_percent", label: "Day %" },
            { key: "change_1m_percent", label: "1M %" },
            { key: "change_ytd_percent", label: "YTD %" },
            { key: "change_52w_percent", label: "52W %" },
            { key: "market_cap", label: "Market cap (NGN)" },
            { key: "volume", label: "Volume" },
          ]}
        />
      </div>

      {/* Preset toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone px-3 py-2">
        <button
          onClick={savePreset}
          className="inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1 font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest-soft hover:bg-sand"
        >
          <Save className="h-3.5 w-3.5" /> Save preset
        </button>
        {presets.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 rounded-md bg-sand px-2 py-1 font-sans text-[11px] text-forest"
          >
            <button onClick={() => applyPreset(p)} className="font-semibold hover:underline">
              {p.name}
            </button>
            <button
              onClick={async () => {
                await deletePresetReq(p.id);
                setPresets(await fetchPresets());
              }}
              className="text-ink/30 hover:text-loss"
              aria-label={`Delete preset ${p.name}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
        {selected.size > 0 && (
          <button
            onClick={buildPortfolio}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-fresh px-3 py-1 font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest hover:brightness-95"
          >
            <Briefcase className="h-3.5 w-3.5" /> Build portfolio ({selected.size})
          </button>
        )}
      </div>

      <TileBody query={query} isEmpty={() => rows.length === 0}>
        {() => (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-left font-sans text-[13px]">
              <thead className="sticky top-0 z-10 bg-surface">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-stone">
                    <th className="w-8 px-2 py-2">
                      <input
                        type="checkbox"
                        aria-label="Select all filtered"
                        checked={filtered.length > 0 && filtered.every((r) => selected.has(r.symbol))}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked ? new Set(filtered.map((r) => r.symbol)) : new Set()
                          )
                        }
                      />
                    </th>
                    {hg.headers.map((h) => {
                      const sorted = h.column.getIsSorted();
                      return (
                        <th
                          key={h.id}
                          onClick={h.column.getToggleSortingHandler()}
                          className="cursor-pointer select-none px-3 py-2 font-sans text-[10px] font-semibold uppercase tracking-eyebrow text-ink/50 hover:text-forest"
                        >
                          <span className="inline-flex items-center gap-1">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {sorted === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-30" />
                            )}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-stone">
                {table.getRowModel().rows.map((r) => (
                  <tr key={r.id} className="hover:bg-sand/70">
                    <td className="w-8 px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.original.symbol}`}
                        checked={selected.has(r.original.symbol)}
                        onChange={() => toggle(r.original.symbol)}
                      />
                    </td>
                    {r.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        onClick={() => router.push(`/stocks/${r.original.symbol}`)}
                        className="cursor-pointer px-3 py-2"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
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
