"use client";

import { useNgx } from "@/hooks/useNgx";
import { Delta } from "@/components/ui/Delta";
import { Panel, TileBody } from "@/components/ui/Tile";
import { TickerBadge } from "@/components/ui/TickerBadge";
import { formatNaira } from "@/lib/format";
import type { MarketMovers, MoverRow } from "@/lib/ngx/types";

function Row({ row }: { row: MoverRow }) {
  return (
    <li className="flex items-center gap-2 py-1.5">
      <TickerBadge symbol={row.symbol} logoUrl={row.logo_url} size={24} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-[13px] font-semibold text-forest">
          {row.symbol}
        </p>
        <p className="truncate font-sans text-[10px] text-ink/45">
          {row.company_name}
        </p>
      </div>
      <div className="text-right">
        <p className="font-sans text-[13px] font-semibold text-ink tabular-nums">
          {formatNaira(row.todays_close)}
        </p>
        <Delta value={row.change_percent} className="text-[11px]" />
      </div>
    </li>
  );
}

export function MoversTile() {
  const query = useNgx<MarketMovers>("market/movers", {
    query: { limit: 5 },
    refetchInterval: 2 * 60_000,
  });

  return (
    <Panel title="Top movers" subtitle="Biggest gainers & losers today">
      <TileBody query={query}>
        {(d) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 brb-bullet font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest-soft">
                Gainers
              </p>
              <ul className="divide-y divide-stone">
                {(d.top_gainers ?? []).map((r) => (
                  <Row key={r.symbol} row={r} />
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 brb-bullet font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-loss">
                Losers
              </p>
              <ul className="divide-y divide-stone">
                {(d.top_losers ?? []).map((r) => (
                  <Row key={r.symbol} row={r} />
                ))}
              </ul>
            </div>
          </div>
        )}
      </TileBody>
    </Panel>
  );
}
