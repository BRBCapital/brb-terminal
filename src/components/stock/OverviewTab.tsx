"use client";

import {
  formatNaira,
  formatNairaCompact,
  formatCompactNumber,
  formatNumber,
  formatPercent,
  formatDate,
} from "@/lib/format";
import type { CompanyDetail } from "@/lib/ngx/types";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
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

// 52-week range with the current price marked.
function RangeBar({
  low,
  high,
  current,
}: {
  low: number | null;
  high: number | null;
  current: number | null;
}) {
  if (low == null || high == null || current == null || high <= low) return null;
  const pct = Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
  return (
    <div>
      <div className="flex items-center justify-between font-sans text-[11px] text-ink/55">
        <span>52W low {formatNaira(low)}</span>
        <span>52W high {formatNaira(high)}</span>
      </div>
      <div className="relative mt-1 h-2 rounded-full bg-stone">
        <div
          className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-forest"
          style={{ left: `calc(${pct}% - 2px)` }}
          title={`Current ${formatNaira(current)}`}
        />
      </div>
    </div>
  );
}

export function OverviewTab({
  detail: d,
  loading,
}: {
  detail: CompanyDetail | null;
  loading: boolean;
}) {
  if (loading || !d) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded bg-stone" />
        ))}
      </div>
    );
  }

  const pe =
    d.current_price != null && d.ttm_eps != null && d.ttm_eps !== 0
      ? d.current_price / d.ttm_eps
      : null;

  return (
    <div className="space-y-4">
      <div className="brb-card space-y-4 p-4">
        <RangeBar low={d.low_52wk} high={d.high_52wk} current={d.current_price} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Market cap" value={formatNairaCompact(d.market_cap)} />
          <Stat label="Trailing EPS" value={formatNaira(d.ttm_eps)} />
          <Stat
            label="P/E (ttm)"
            value={pe != null ? `${pe.toFixed(1)}×` : "—"}
          />
          <Stat
            label="P/B"
            value={d.pb_ratio != null ? `${d.pb_ratio.toFixed(2)}×` : "—"}
          />
          <Stat
            label="Dividend yield"
            value={d.dividend_yield != null ? formatPercent(d.dividend_yield) : "—"}
          />
          <Stat
            label="Debt / equity"
            value={d.debt_to_equity != null ? d.debt_to_equity.toFixed(2) : "—"}
          />
          <Stat
            label="Current ratio"
            value={d.current_ratio != null ? d.current_ratio.toFixed(2) : "—"}
          />
          <Stat
            label="Shares out."
            value={formatCompactNumber(d.shares_outstanding)}
          />
          <Stat label="Volume" value={formatCompactNumber(d.volume)} />
          <Stat label="Value traded" value={formatNairaCompact(d.value_traded)} />
          <Stat
            label="Day range"
            value={
              d.day_low != null && d.day_high != null
                ? `${formatNumber(d.day_low, 2)}–${formatNumber(d.day_high, 2)}`
                : "—"
            }
          />
          <Stat label="TTM dividends" value={formatNairaCompact(d.ttm_dividends)} />
        </div>
      </div>

      {d.about && (
        <div className="brb-card p-4">
          <p className="brb-eyebrow mb-2">
            <span className="brb-eyebrow-num">i</span>Business
          </p>
          <p className="whitespace-pre-line font-sans text-[13px] leading-relaxed text-ink/75">
            {d.about}
          </p>
        </div>
      )}

      <div className="brb-card grid grid-cols-1 gap-x-6 gap-y-1 p-4 sm:grid-cols-2">
        <Fact label="Listed" value={formatDate(d.date_listed)} />
        <Fact label="Incorporated" value={formatDate(d.date_incorporated)} />
        <Fact label="Nature of business" value={d.nature_of_business} />
        <Fact label="Website" value={d.website} href={d.website} />
        <Fact label="Address" value={d.address} />
        <Fact label="ISIN" value={d.international_sec_id} />
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null;
  href?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-stone/60 py-1.5 last:border-0">
      <span className="font-sans text-[11px] uppercase tracking-eyebrow text-ink/45">
        {label}
      </span>
      {href ? (
        <a
          href={href.startsWith("http") ? href : `https://${href}`}
          target="_blank"
          rel="noreferrer"
          className="font-sans text-[13px] text-forest-soft underline"
        >
          {value}
        </a>
      ) : (
        <span className="text-right font-sans text-[13px] text-ink/75">{value}</span>
      )}
    </div>
  );
}
