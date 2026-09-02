"use client";

import { useNgx } from "@/hooks/useNgx";
import { Delta } from "@/components/ui/Delta";
import { TileBody } from "@/components/ui/Tile";
import { formatNumber } from "@/lib/format";
import type { IndexSummary, Paginated } from "@/lib/ngx/types";

export function IndicesStrip() {
  // /indices returns a paginated envelope: { data: IndexSummary[], pagination }.
  const query = useNgx<Paginated<IndexSummary>>("indices", {
    query: { limit: 50 },
    refetchInterval: 2 * 60_000,
  });

  return (
    <TileBody query={query} isEmpty={(d) => !d?.data?.length}>
      {(payload) => (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {payload.data.map((idx) => (
            <div
              key={idx.symbol}
              className="brb-card min-w-[9.5rem] shrink-0 px-3 py-2"
              title={idx.index_name}
            >
              <p className="truncate font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                {idx.symbol}
              </p>
              <p className="mt-0.5 font-serif text-base font-semibold text-forest tabular-nums">
                {formatNumber(idx.current_value, 2)}
              </p>
              <Delta value={idx.price_change_percent} className="text-xs" />
            </div>
          ))}
        </div>
      )}
    </TileBody>
  );
}
