"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useNgx } from "@/hooks/useNgx";
import { TickerBadge } from "@/components/ui/TickerBadge";
import type { CompanyIdentifiers } from "@/lib/ngx/types";

// Ticker/name lookup backed by the lightweight, cached identifiers list.
// Filters client-side (only ~150 names) and routes to the research page.
export function CompanySearch({
  autoFocus = false,
  placeholder = "Search ticker or company…",
  onSelect,
  clearOnSelect = false,
  basePath = "/stocks",
}: {
  autoFocus?: boolean;
  placeholder?: string;
  // When provided, called with the picked symbol instead of navigating.
  onSelect?: (symbol: string, name: string) => void;
  clearOnSelect?: boolean;
  // Route prefix when navigating (default the research page).
  basePath?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const query = useNgx<CompanyIdentifiers>("companies/identifiers");
  const all = query.data?.ok ? query.data.data.data : [];

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return all
      .filter(
        (c) =>
          c.symbol.toLowerCase().includes(term) ||
          c.name.toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [q, all]);

  function go(symbol: string, name = "") {
    if (onSelect) {
      onSelect(symbol, name);
      if (clearOnSelect) setQ("");
      setOpen(false);
      return;
    }
    setQ("");
    setOpen(false);
    router.push(`${basePath}/${symbol}`);
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="flex items-center gap-2 rounded-lg border border-stone bg-surface px-3 py-2 focus-within:border-fresh">
        <Search className="h-4 w-4 shrink-0 text-ink/40" />
        <input
          autoFocus={autoFocus}
          value={q}
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && matches[active]) {
              go(matches[active].symbol, matches[active].name);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="w-full bg-transparent font-sans text-sm text-ink outline-none placeholder:text-ink/40"
        />
      </div>
      {open && matches.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-stone bg-surface shadow-card">
          {matches.map((c, i) => (
            <li key={c.symbol}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(c.symbol, c.name)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left ${
                  i === active ? "bg-sand" : "bg-surface"
                }`}
              >
                <TickerBadge symbol={c.symbol} logoUrl={c.logo_url ?? undefined} size={22} />
                <span className="font-sans text-[13px] font-semibold text-forest">
                  {c.symbol}
                </span>
                <span className="truncate font-sans text-[11px] text-ink/50">
                  {c.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
