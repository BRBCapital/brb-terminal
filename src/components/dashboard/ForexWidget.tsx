"use client";

import { useNgx } from "@/hooks/useNgx";
import { Delta } from "@/components/ui/Delta";
import { Panel, TileBody } from "@/components/ui/Tile";
import { Freshness } from "@/components/ui/Freshness";
import { formatNumber } from "@/lib/format";
import type { ForexCurrent } from "@/lib/ngx/types";

// /forex/current returns `rate` already as NGN-per-foreign-unit, so we display
// it directly as "₦ per USD" (no inversion needed here — unlike /forex/history).
export function ForexWidget() {
  const query = useNgx<ForexCurrent>("forex/current", {
    refetchInterval: 5 * 60_000,
  });

  return (
    <Panel title="FX · ₦ per unit" subtitle="Naira exchange rates">
      <TileBody query={query} isEmpty={(d) => !d?.rates?.length}>
        {(d, result) => {
          // Analysts care about USD/GBP/EUR first; the API returns them
          // alphabetically. Pin the majors to the top, keep the rest after.
          const PRIORITY = ["USD", "GBP", "EUR"];
          const rates = [...d.rates].sort((a, b) => {
            const ai = PRIORITY.indexOf(a.currency);
            const bi = PRIORITY.indexOf(b.currency);
            if (ai === -1 && bi === -1) return a.currency.localeCompare(b.currency);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          });
          return (
          <div>
            <ul className="divide-y divide-stone">
              {rates.map((r) => (
                <li
                  key={r.currency}
                  className="flex items-center justify-between py-2"
                >
                  <span className="font-sans text-sm font-semibold text-forest">
                    {r.currency}/NGN
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-serif text-base font-semibold text-ink tabular-nums">
                      ₦{formatNumber(r.rate, 2)}
                    </span>
                    <Delta value={r.daily_change_percent} className="text-xs" />
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2">
              <Freshness
                updatedAt={d.date}
                cached={result.cached}
                fetchedAt={result.fetchedAt}
                label="Rates as of"
              />
            </div>
          </div>
          );
        }}
      </TileBody>
    </Panel>
  );
}
