"use client";

import { useNgx } from "@/hooks/useNgx";
import { Delta } from "@/components/ui/Delta";
import { Freshness } from "@/components/ui/Freshness";
import { TileBody } from "@/components/ui/Tile";
import {
  formatNairaCompact,
  formatNumber,
  formatCompactNumber,
} from "@/lib/format";
import type { MarketSnapshot } from "@/lib/ngx/types";

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-stone bg-surface px-3.5 py-3 shadow-card">
      <p className="font-sans text-[9.5px] font-semibold uppercase tracking-eyebrow text-ink/40">
        {label}
      </p>
      <p className="mt-1.5 font-serif text-[17px] font-semibold leading-none text-forest tabular-nums">
        {value}
      </p>
      {sub && <div className="mt-1.5 text-[11px]">{sub}</div>}
    </div>
  );
}

export function SnapshotHero() {
  const query = useNgx<MarketSnapshot>("market/snapshot", {
    refetchInterval: 2 * 60_000,
  });

  return (
    <div className="brb-card overflow-hidden">
      <TileBody query={query}>
        {(d, result) => (
          <div className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-forest-soft">
                  <span className="inline-block h-2.5 w-1 rounded-full bg-fresh" />
                  NGX All-Share Index
                </p>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
                  <span className="font-serif text-[42px] font-bold leading-none text-forest tabular-nums">
                    {formatNumber(d.asi, 2)}
                  </span>
                  <Delta value={d.asi_change_percent} className="text-base" />
                  <span className="font-sans text-sm text-ink/50 tabular-nums">
                    {d.asi_change >= 0 ? "+" : ""}
                    {formatNumber(d.asi_change, 2)} pts
                  </span>
                </div>
                <p className="mt-1 font-sans text-xs text-ink/55">
                  YTD{" "}
                  <span className="font-semibold">
                    <Delta value={d.ytd_asi_change_percent} showArrow={false} />
                  </span>
                </p>
              </div>
              <div className="text-right">
                <Freshness
                  updatedAt={d.updated_at}
                  cached={result.cached}
                  fetchedAt={result.fetchedAt}
                />
                <p className="mt-1 font-sans text-[10px] uppercase tracking-eyebrow text-ink/40">
                  {d.total_listed_securities} listed securities
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-stone pt-4 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="Deals" value={formatNumber(d.deals)} />
              <Stat label="Volume" value={formatCompactNumber(d.volume)} />
              <Stat
                label="Value traded"
                value={formatNairaCompact(d.value_traded)}
              />
              <Stat
                label="Total market cap"
                value={formatNairaCompact(d.market_cap?.total)}
                sub={
                  <span className="text-ink/45">
                    Eq {formatNairaCompact(d.market_cap?.equity)}
                  </span>
                }
              />
              <Stat
                label="Breadth (A / D / U)"
                value={`${d.breadth?.advancers ?? "—"} / ${d.breadth?.decliners ?? "—"} / ${d.breadth?.unchanged ?? "—"}`}
                sub={
                  <span className="text-ink/45">
                    A/D ratio{" "}
                    {d.breadth?.adv_dec_ratio != null ? d.breadth.adv_dec_ratio.toFixed(2) : "—"}
                  </span>
                }
              />
            </div>
          </div>
        )}
      </TileBody>
    </div>
  );
}
