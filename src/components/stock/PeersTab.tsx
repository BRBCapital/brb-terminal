"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useNgx } from "@/hooks/useNgx";
import { Panel, TileBody } from "@/components/ui/Tile";
import { Delta } from "@/components/ui/Delta";
import { TickerBadge } from "@/components/ui/TickerBadge";
import { formatNaira, formatNairaCompact } from "@/lib/format";
import type { CompanyListRow, Paginated } from "@/lib/ngx/types";

// Compare the company against its sector peers on performance and size. Peers
// are filtered client-side from the (cached) full company list.
export function PeersTab({
  symbol,
  sector,
}: {
  symbol: string;
  sector: string | null;
}) {
  const router = useRouter();
  const query = useNgx<Paginated<CompanyListRow>>("companies", {
    query: { limit: 300 },
  });

  const peers = useMemo(() => {
    if (!query.data?.ok || !sector) return [];
    return query.data.data.data
      .filter((c) => c.sector === sector)
      .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0));
  }, [query.data, sector]);

  return (
    <Panel
      title="Peer comparison"
      subtitle={sector ? `${sector} · ${peers.length} companies` : "Sector peers"}
    >
      <TileBody query={query} isEmpty={() => peers.length === 0}>
        {() => (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left font-sans text-[13px]">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                  <th className="py-1.5 pr-2 font-medium">Company</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Price</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Day</th>
                  <th className="py-1.5 pr-2 text-right font-medium">YTD</th>
                  <th className="py-1.5 pr-2 text-right font-medium">52W</th>
                  <th className="py-1.5 text-right font-medium">Mkt cap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone">
                {peers.map((p) => {
                  const isSelf = p.symbol === symbol;
                  return (
                    <tr
                      key={p.symbol}
                      onClick={() => !isSelf && router.push(`/stocks/${p.symbol}`)}
                      className={
                        isSelf
                          ? "bg-fresh/10"
                          : "cursor-pointer hover:bg-sand/70"
                      }
                    >
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-2">
                          <TickerBadge symbol={p.symbol} logoUrl={p.logo_url} size={22} />
                          <div className="min-w-0">
                            <p className="font-semibold text-forest">
                              {p.symbol}
                              {isSelf && (
                                <span className="ml-1 text-[9px] uppercase tracking-eyebrow text-fresh">
                                  this
                                </span>
                              )}
                            </p>
                            <p className="truncate text-[10px] text-ink/45">{p.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {formatNaira(p.price)}
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <Delta value={p.price_change_percent} showArrow={false} className="text-[12px]" />
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <Delta value={p.change_ytd_percent} showArrow={false} className="text-[12px]" />
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <Delta value={p.change_52w_percent} showArrow={false} className="text-[12px]" />
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-ink/70">
                        {formatNairaCompact(p.market_cap)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </TileBody>
    </Panel>
  );
}
