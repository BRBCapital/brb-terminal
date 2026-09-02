"use client";

import { useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNgx } from "@/hooks/useNgx";
import { useIsDark } from "@/hooks/useIsDark";
import { Panel, TileBody } from "@/components/ui/Tile";
import { Delta } from "@/components/ui/Delta";
import { ForecastDisclaimer } from "./ForecastDisclaimer";
import { AiSectorMomentum, type SectorContext } from "./AiSectorMomentum";
import { formatNumber } from "@/lib/format";
import type {
  CompanyDetail,
  SectorRotation,
  IndexChart,
} from "@/lib/ngx/types";

// forex/history?source=USD&target=NGN → { data: [{ rate, rate_date }] } where
// rate is already ₦ per $1 (no inversion needed for this query direction).
interface ForexHistory {
  data: Array<{ rate: number; rate_date: string }>;
}

export function MacroContextTab({ detail }: { detail: CompanyDetail | null }) {
  const sectorsQ = useNgx<SectorRotation>("market/sectors");
  // No/short period returns only ~30 days; request full history and slice.
  const asiQ = useNgx<IndexChart>("indices/ASI/chart", { query: { period: "MAX" } });
  const fxQ = useNgx<ForexHistory>("forex/history", {
    query: { source: "USD", target: "NGN", limit: 180 },
  });

  const isDark = useIsDark();
  const fxStroke = isDark ? "#E4EDE4" : "#0B3B2E";
  const asiStroke = isDark ? "#9FE08A" : "#1A4D40";

  const mySector = detail?.sector ?? null;

  // This stock's own sector momentum + rank, folded into the AI panel header.
  const sectorsData = sectorsQ.data?.ok ? sectorsQ.data.data : null;
  const sectorCtx = useMemo<SectorContext | null>(() => {
    if (!sectorsData?.sectors?.length || !mySector) return null;
    const rows = [...sectorsData.sectors].sort(
      (a, b) => (b.change_7d ?? -Infinity) - (a.change_7d ?? -Infinity)
    );
    const idx = rows.findIndex((s) => s.sector === mySector);
    if (idx < 0) return null;
    const s = rows[idx];
    return {
      change_1d: s.change_1d ?? null,
      change_7d: s.change_7d ?? null,
      change_52w: s.change_52w ?? null,
      rank: idx + 1,
      total: rows.length,
    };
  }, [sectorsData, mySector]);

  return (
    <div className="space-y-4">
      <ForecastDisclaimer />

      {/* AI sector momentum read for this stock */}
      {detail?.symbol && (
        <AiSectorMomentum symbol={detail.symbol} sector={mySector} context={sectorCtx} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* NGN/USD trajectory */}
        <Panel title="NGN / USD trajectory" subtitle="₦ per $1 · last ~6 months">
          <TileBody query={fxQ} isEmpty={(d) => !d?.data?.length}>
            {(payload) => {
              const data = [...payload.data]
                .filter((r) => r.rate > 0)
                .map((r) => ({ date: r.rate_date.slice(0, 10), ngnPerUsd: r.rate }))
                .sort((a, b) => a.date.localeCompare(b.date));
              const first = data[0]?.ngnPerUsd;
              const last = data.at(-1)?.ngnPerUsd;
              const chg = first && last ? ((last - first) / first) * 100 : null;
              return (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-3">
                    <span className="font-serif text-xl font-bold text-forest tabular-nums">
                      ₦{formatNumber(last ?? 0, 2)}
                    </span>
                    <span className="font-sans text-[11px] text-ink/55">
                      period <Delta value={chg} showArrow={false} className="text-[11px]" />
                      {chg != null && chg !== 0 && ` (naira ${chg > 0 ? "weaker" : "stronger"})`}
                    </span>
                  </div>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#1A1A1A80" }} minTickGap={40} tickLine={false} axisLine={{ stroke: "#E8E6E0" }} />
                        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "#1A1A1A80" }} width={44} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatNumber(v, 0)} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E8E6E0" }} formatter={(v: any) => [`₦${formatNumber(Number(v), 2)}`, "₦/$"]} />
                        <Line dataKey="ngnPerUsd" stroke={fxStroke} strokeWidth={1.8} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            }}
          </TileBody>
        </Panel>

        {/* ASI trend */}
        <Panel title="Market regime — NGX All-Share Index" subtitle="1-year trend">
          <TileBody query={asiQ} isEmpty={(d) => !d?.data?.length}>
            {(chart) => {
              // The index chart ignores the period param and returns full history,
              // so slice to ~1 year of trading days client-side.
              const data = chart.data
                .slice(-252)
                .map((p) => ({ date: p.date, value: p.index_value }));
              const first = data[0]?.value;
              const last = data.at(-1)?.value;
              const chg = first && last ? ((last - first) / first) * 100 : null;
              return (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-3">
                    <span className="font-serif text-xl font-bold text-forest tabular-nums">
                      {formatNumber(last ?? 0, 0)}
                    </span>
                    <span className="font-sans text-[11px] text-ink/55">
                      1y <Delta value={chg} showArrow={false} className="text-[11px]" />
                    </span>
                  </div>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#1A1A1A80" }} minTickGap={44} tickLine={false} axisLine={{ stroke: "#E8E6E0" }} />
                        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "#1A1A1A80" }} width={52} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatNumber(v, 0)} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E8E6E0" }} formatter={(v: any) => [formatNumber(Number(v), 2), "ASI"]} />
                        <Line dataKey="value" stroke={asiStroke} strokeWidth={1.8} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            }}
          </TileBody>
        </Panel>
      </div>

      <p className="font-sans text-[11px] leading-relaxed text-ink/55">
        Sector momentum, the index regime, and the naira trajectory frame the
        assumptions behind any single-stock scenario — a bullish price path in a
        weakening sector or depreciating-naira regime carries more risk than the
        bands alone show.
      </p>
      <ForecastDisclaimer compact />
    </div>
  );
}
