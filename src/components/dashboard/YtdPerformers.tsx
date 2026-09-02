"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { useNgx } from "@/hooks/useNgx";
import { Delta } from "@/components/ui/Delta";
import { Panel, TileBody } from "@/components/ui/Tile";
import { formatNaira } from "@/lib/format";
import { deriveYtd, type DerivedYtdRow } from "@/lib/ngx/derived";
import type {
  CompanyListRow,
  Paginated,
  YtdPerformers as YtdData,
  YtdRow,
} from "@/lib/ngx/types";

export function YtdPerformers() {
  const [type, setType] = useState<"best" | "worst">("best");
  const query = useNgx<YtdData>("market/ytd-performers", {
    query: { type, limit: 8 },
    refetchInterval: 10 * 60_000,
  });

  // Plan-gated fallback: rank YTD from per-company change_ytd_percent (Starter).
  const planGated =
    query.data != null && !query.data.ok && query.data.error.code === "PLAN_REQUIRED";
  const companiesQ = useNgx<Paginated<CompanyListRow>>("companies", {
    query: { limit: 300 },
    enabled: planGated,
  });
  const derived = useMemo<DerivedYtdRow[] | null>(() => {
    if (!planGated || !companiesQ.data?.ok) return null;
    return deriveYtd(companiesQ.data.data.data, type, 8);
  }, [planGated, companiesQ.data, type]);

  const toggle = (
    <div className="flex overflow-hidden rounded-md border border-stone text-[10px] font-semibold uppercase tracking-eyebrow">
      {(["best", "worst"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setType(t)}
          className={clsx(
            "px-2.5 py-1 transition-colors",
            type === t
              ? "bg-forest text-[#F5F2EC]"
              : "bg-surface text-ink/50 hover:bg-sand"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );

  return (
    <Panel
      title="YTD performers"
      subtitle={derived ? "Year-to-date return · derived from company data" : "Year-to-date return"}
      right={toggle}
    >
      {derived ? (
        <YtdList rows={derived} />
      ) : (
        <TileBody query={query} isEmpty={(d) => !d?.data?.length}>
          {(d) => <YtdList rows={d.data} />}
        </TileBody>
      )}
    </Panel>
  );
}

function YtdList({ rows }: { rows: Array<YtdRow | DerivedYtdRow> }) {
  return (
    <ul className="divide-y divide-stone">
      {rows.map((r, i) => (
        <li key={r.symbol} className="flex items-center gap-2 py-1.5">
          <span className="w-4 font-sans text-[11px] text-ink/35 tabular-nums">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-sans text-[13px] font-semibold text-forest">
              {r.symbol}
            </p>
            <p className="truncate font-sans text-[10px] text-ink/45">{r.sector}</p>
          </div>
          <div className="text-right">
            <p className="font-sans text-[12px] text-ink/70 tabular-nums">
              {formatNaira(r.current_price)}
            </p>
            <Delta value={r.ytd_pct} className="text-[12px]" showArrow={false} />
          </div>
        </li>
      ))}
    </ul>
  );
}
