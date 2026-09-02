"use client";

import { useMemo } from "react";
import { useNgx } from "@/hooks/useNgx";
import { Panel, TileBody } from "@/components/ui/Tile";
import { formatPercent, formatNairaCompact } from "@/lib/format";
import { deriveSectors, type DerivedSector } from "@/lib/ngx/derived";
import type { CompanyListRow, Paginated, SectorRotation } from "@/lib/ngx/types";

// Map a percentage change to a background tint: green (Fresh) for gains, brand
// red for losses, intensity scaled by magnitude (capped at ±5% for contrast).
function tint(change: number): string {
  const capped = Math.max(-5, Math.min(5, change));
  const alpha = Math.min(0.85, 0.12 + (Math.abs(capped) / 5) * 0.73);
  if (change >= 0) return `rgba(138, 200, 115, ${alpha})`; // #8AC873
  return `rgba(192, 57, 43, ${alpha})`; // #C0392B
}

export function SectorHeatmap() {
  const query = useNgx<SectorRotation>("market/sectors", {
    refetchInterval: 5 * 60_000,
  });

  // When the Growth-tier endpoint is plan-gated, derive sector aggregates from
  // the per-company list (available on Starter) — exact data, equal-weighted.
  const planGated =
    query.data != null && !query.data.ok && query.data.error.code === "PLAN_REQUIRED";
  const companiesQ = useNgx<Paginated<CompanyListRow>>("companies", {
    query: { limit: 300 },
    enabled: planGated,
  });
  const derived = useMemo<DerivedSector[] | null>(() => {
    if (!planGated || !companiesQ.data?.ok) return null;
    return deriveSectors(companiesQ.data.data.data);
  }, [planGated, companiesQ.data]);

  const subtitle = derived
    ? "1-day change · derived from constituents (equal-weighted)"
    : "1-day change · size shows breadth";

  return (
    <Panel title="Sector performance" subtitle={subtitle}>
      {derived ? (
        <SectorGrid sectors={derived} derived />
      ) : (
        <TileBody query={query} isEmpty={(d) => !d?.sectors?.length}>
          {(d) => (
            <SectorGrid
              sectors={d.sectors}
              footer={
                <>
                  <span>Leading 1d: {d.summary.top_sector_1d}</span>
                  <span>Leading 7d: {d.summary.top_sector_7d}</span>
                </>
              }
            />
          )}
        </TileBody>
      )}
    </Panel>
  );
}

function SectorGrid({
  sectors,
  derived = false,
  footer,
}: {
  sectors: Array<DerivedSector | SectorRotation["sectors"][number]>;
  derived?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[...sectors]
          .sort((a, b) => (b.change_1d ?? 0) - (a.change_1d ?? 0))
          .map((s) => {
            const dark = Math.abs(s.change_1d ?? 0) > 2.5;
            return (
              <div
                key={s.sector}
                style={{ backgroundColor: tint(s.change_1d ?? 0) }}
                className="rounded-lg p-2.5"
                title={`${s.sector} · 7d ${formatPercent(s.change_7d)} · 52w ${formatPercent(
                  s.change_52w
                )} · mcap ${formatNairaCompact(s.total_market_cap)}`}
              >
                <p
                  className={`truncate font-sans text-[11px] font-semibold ${
                    dark ? "text-white" : "text-forest"
                  }`}
                >
                  {s.sector}
                </p>
                <p
                  className={`font-serif text-base font-bold tabular-nums ${
                    dark ? "text-white" : "text-ink"
                  }`}
                >
                  {formatPercent(s.change_1d)}
                </p>
                <p
                  className={`font-sans text-[10px] tabular-nums ${
                    dark ? "text-white/80" : "text-ink/50"
                  }`}
                >
                  {s.breadth?.advancers ?? 0}▲ {s.breadth?.decliners ?? 0}▼ · {s.company_count} co.
                </p>
              </div>
            );
          })}
      </div>
      <div className="mt-3 flex items-center gap-4 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
        {footer}
        {derived && (
          <span>
            Derived locally from company-level data — equal-weighted sector means.
          </span>
        )}
      </div>
    </div>
  );
}
