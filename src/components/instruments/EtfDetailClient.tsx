"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useNgx } from "@/hooks/useNgx";
import { useIsDark } from "@/hooks/useIsDark";
import { Delta } from "@/components/ui/Delta";
import { Panel, TileBody } from "@/components/ui/Tile";
import { Freshness } from "@/components/ui/Freshness";
import { ComplianceNote } from "@/components/ui/ComplianceNote";
import { formatNaira, formatNumber, formatCompactNumber } from "@/lib/format";
import type { EtfRow } from "@/lib/ngx/types";

interface EtfDetail extends EtfRow {
  fund_sponsor: string | null;
  trustee: string | null;
  custodian: string | null;
  website: string | null;
  latest_date: string | null;
}
interface EtfChart {
  data: Array<{ date: string; close: number }>;
}

export function EtfDetailClient({ symbol }: { symbol: string }) {
  const detailQ = useNgx<EtfDetail>(`etfs/${symbol}`, { refetchInterval: 3 * 60_000 });
  const chartQ = useNgx<EtfChart>(`etfs/${symbol}/chart`, { query: { period: "MAX" } });
  const d = detailQ.data?.ok ? detailQ.data.data : null;
  const isDark = useIsDark();

  return (
    <div className="space-y-4">
      <Link href="/instruments" className="inline-flex items-center gap-1 font-sans text-[11px] uppercase tracking-eyebrow text-forest-soft hover:text-forest">
        <ArrowLeft className="h-3 w-3" /> Bonds & ETFs
      </Link>

      <div className="brb-card p-5">
        {d ? (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-2xl font-bold text-forest">{d.symbol}</h1>
              <p className="font-sans text-sm text-ink/60">{d.name}</p>
              <p className="mt-0.5 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                {d.fund_manager} · tracks {d.index_tracked ?? "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-serif text-3xl font-bold text-forest tabular-nums">{formatNaira(d.current_price)}</p>
              <Delta value={d.price_change_percent} className="justify-end" />
              <div className="mt-1"><Freshness updatedAt={d.latest_date ?? d.stats_date} /></div>
            </div>
          </div>
        ) : (
          <div className="h-16 animate-pulse rounded bg-stone" />
        )}
      </div>

      {d && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="52-week range" value={`${formatNumber(d.low_52wk ?? 0, 0)}–${formatNumber(d.high_52wk ?? 0, 0)}`} />
          <Stat label="YTD" value={<Delta value={d.change_ytd_percent} showArrow={false} />} />
          <Stat label="Volume" value={formatCompactNumber(d.volume)} />
          <Stat label="Avg vol (3m)" value={formatCompactNumber(d.avg_vol_3m)} />
        </div>
      )}

      <Panel title="Price" subtitle="Daily close">
        <TileBody query={chartQ} isEmpty={(c) => !c?.data?.length}>
          {(chart) => (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart.data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#1A1A1A80" }} minTickGap={44} tickLine={false} axisLine={{ stroke: "#E8E6E0" }} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "#1A1A1A80" }} width={48} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatNumber(v, 0)} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E8E6E0" }} formatter={(v: any) => [formatNaira(Number(v)), "Close"]} />
                  <Line dataKey="close" stroke={isDark ? "#8AC873" : "#052A22"} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </TileBody>
      </Panel>

      <ComplianceNote />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone bg-surface px-3.5 py-3 shadow-card">
      <p className="font-sans text-[9.5px] font-semibold uppercase tracking-eyebrow text-ink/40">{label}</p>
      <p className="mt-1.5 font-serif text-base font-semibold text-forest tabular-nums">{value}</p>
    </div>
  );
}
