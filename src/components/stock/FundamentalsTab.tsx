"use client";

import { useNgx } from "@/hooks/useNgx";
import { Panel, TileBody } from "@/components/ui/Tile";
import { FilingExtractor } from "./FilingExtractor";
import { formatNaira, formatNairaCompact, formatPercent } from "@/lib/format";
import type { CompanyDetail } from "@/lib/ngx/types";

// The full statement set (/financials) requires the Business plan. When it's not
// available we still surface the headline ratios that the detail endpoint
// exposes, so the tab is never empty.
export function FundamentalsTab({
  symbol,
  detail,
}: {
  symbol: string;
  detail: CompanyDetail | null;
}) {
  const query = useNgx<unknown>(`companies/${symbol}/financials`);

  const pe =
    detail?.current_price != null && detail?.ttm_eps
      ? detail.current_price / detail.ttm_eps
      : null;

  return (
    <div className="space-y-4">
      {detail && (
        <div className="brb-card p-4">
          <p className="brb-eyebrow mb-3">
            <span className="brb-eyebrow-num">R</span>Headline ratios (trailing)
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Ratio label="P/E" value={pe != null ? `${pe.toFixed(1)}×` : "—"} />
            <Ratio label="P/B" value={detail.pb_ratio != null ? `${detail.pb_ratio.toFixed(2)}×` : "—"} />
            <Ratio label="Div yield" value={detail.dividend_yield != null ? formatPercent(detail.dividend_yield) : "—"} />
            <Ratio label="Debt/Equity" value={detail.debt_to_equity?.toFixed(2) ?? "—"} />
            <Ratio label="Current ratio" value={detail.current_ratio?.toFixed(2) ?? "—"} />
            <Ratio label="TTM EPS" value={formatNaira(detail.ttm_eps)} />
            <Ratio label="Equity" value={formatNairaCompact(detail.latest_equity)} />
            <Ratio label="TTM dividends" value={formatNairaCompact(detail.ttm_dividends)} />
          </div>
        </div>
      )}

      <Panel
        title="Financial statements"
        subtitle="Income statement · balance sheet · cash flow · ratios"
      >
        <TileBody query={query}>
          {(data) => (
            <pre className="max-h-[50vh] overflow-auto rounded-lg bg-sand/70 p-3 font-mono text-[11px] text-ink/70">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </TileBody>
      </Panel>

      {/* Works on the Starter plan: reads the official filing PDFs directly. */}
      <FilingExtractor symbol={symbol} />
    </div>
  );
}

function Ratio({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone bg-surface px-3.5 py-3 shadow-card">
      <p className="font-sans text-[9.5px] font-semibold uppercase tracking-eyebrow text-ink/40">
        {label}
      </p>
      <p className="mt-1.5 font-serif text-base font-semibold text-forest tabular-nums">
        {value}
      </p>
    </div>
  );
}
