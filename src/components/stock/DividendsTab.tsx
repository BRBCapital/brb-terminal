"use client";

import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { useNgx } from "@/hooks/useNgx";
import { Panel, TileBody } from "@/components/ui/Tile";
import { formatNaira, formatNairaCompact, formatPercent, formatDate } from "@/lib/format";
import type {
  CompanyDividends,
  UpcomingDividends,
} from "@/lib/ngx/types";

export function DividendsTab({
  symbol,
  reportedYield,
  ttmDividends,
}: {
  symbol: string;
  reportedYield: number | null;
  ttmDividends: number | null;
}) {
  const query = useNgx<CompanyDividends>(`companies/${symbol}/dividends`);
  const upcomingQ = useNgx<UpcomingDividends>("dividends/upcoming");

  const upcoming = useMemo(() => {
    if (!upcomingQ.data?.ok) return [];
    return upcomingQ.data.data.dividends.filter((d) => d.symbol === symbol);
  }, [upcomingQ.data, symbol]);

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div className="brb-callout flex items-start gap-2 rounded-r-lg bg-fresh/10 py-3">
          <CalendarClock className="mt-0.5 h-4 w-4 text-forest" />
          <div>
            <p className="font-sans text-[13px] font-semibold text-forest">
              Upcoming ex-dividend
            </p>
            {upcoming.map((u) => (
              <p key={u.ex_dividend_date} className="font-sans text-[12px] text-ink/70">
                {u.type} {formatNaira(u.dividend)} · ex-date{" "}
                {formatDate(u.ex_dividend_date)} · pay {formatDate(u.payment_date)}
                {u.yield != null ? ` · yield ${formatPercent(u.yield)}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}

      <Panel title="Dividend history" subtitle="Ex-date · amount · type · yield">
        <TileBody query={query} isEmpty={(d) => !d?.dividends?.length}>
          {(d) => {
            // Prefer the API's reported yield over a self-computed sum — the
            // history lists some FY payouts twice (Annual + 12M), which would
            // double-count. The latest per-share payment comes from row 0.
            const latest = d.dividends[0];
            return (
              <div>
                <div className="mb-3 flex flex-wrap gap-4 font-sans text-[12px]">
                  <span className="text-ink/55">
                    Payments on record:{" "}
                    <span className="font-semibold text-forest">{d.count}</span>
                  </span>
                  {latest && (
                    <span className="text-ink/55">
                      Latest:{" "}
                      <span className="font-semibold text-forest">
                        {formatNaira(latest.dividend)} ({latest.type})
                      </span>
                    </span>
                  )}
                  {reportedYield != null && (
                    <span className="text-ink/55">
                      Dividend yield (reported):{" "}
                      <span className="font-semibold text-forest">
                        {formatPercent(reportedYield)}
                      </span>
                    </span>
                  )}
                  {ttmDividends != null && (
                    <span className="text-ink/55">
                      Total TTM paid:{" "}
                      <span className="font-semibold text-forest">
                        {formatNairaCompact(ttmDividends)}
                      </span>
                    </span>
                  )}
                </div>
                <div className="max-h-[50vh] overflow-auto">
                  <table className="w-full text-left font-sans text-[13px]">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                        <th className="py-1.5 pr-2 font-medium">Ex-date</th>
                        <th className="py-1.5 pr-2 font-medium">Type</th>
                        <th className="py-1.5 pr-2 text-right font-medium">Amount</th>
                        <th className="py-1.5 pr-2 text-right font-medium">Yield</th>
                        <th className="py-1.5 text-right font-medium">Pay date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone">
                      {d.dividends.map((row, i) => (
                        <tr key={`${row.ex_dividend_date}-${i}`}>
                          <td className="py-1.5 pr-2 tabular-nums">
                            {formatDate(row.ex_dividend_date)}
                          </td>
                          <td className="py-1.5 pr-2 text-ink/60">{row.type}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">
                            {formatNaira(row.dividend)}
                          </td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-ink/60">
                            {row.yield != null ? formatPercent(row.yield) : "—"}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-ink/60">
                            {formatDate(row.payment_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }}
        </TileBody>
      </Panel>
    </div>
  );
}
