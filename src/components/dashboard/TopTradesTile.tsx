"use client";

import { useNgx } from "@/hooks/useNgx";
import { Delta } from "@/components/ui/Delta";
import { Panel, TileBody } from "@/components/ui/Tile";
import { TickerBadge } from "@/components/ui/TickerBadge";
import { formatNaira, formatNairaCompact } from "@/lib/format";
import type { TopTrades } from "@/lib/ngx/types";

export function TopTradesTile() {
  const query = useNgx<TopTrades>("market/top-trades", {
    query: { limit: 8 },
    refetchInterval: 2 * 60_000,
  });

  return (
    <Panel title="Most active" subtitle="Ranked by naira value traded">
      <TileBody query={query} isEmpty={(d) => !d?.data?.length}>
        {(d) => (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                  <th className="py-1.5 pr-2 font-medium">#</th>
                  <th className="py-1.5 pr-2 font-medium">Stock</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Price</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Chg</th>
                  <th className="py-1.5 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone">
                {d.data.map((r) => (
                  <tr key={r.symbol} className="font-sans text-[13px]">
                    <td className="py-1.5 pr-2 text-ink/40 tabular-nums">
                      {r.rank}
                    </td>
                    <td className="py-1.5 pr-2">
                      <div className="flex items-center gap-2">
                        <TickerBadge
                          symbol={r.symbol}
                          logoUrl={r.logo_url}
                          size={22}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-forest">{r.symbol}</p>
                          <p className="truncate text-[10px] text-ink/45">
                            {r.sector}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {formatNaira(r.price)}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      <Delta
                        value={r.price_change_percent}
                        className="text-[12px]"
                        showArrow={false}
                      />
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-ink/70">
                      {formatNairaCompact(r.value_traded)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TileBody>
    </Panel>
  );
}
