"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/ui/Tile";
import { Delta } from "@/components/ui/Delta";
import { ForecastDisclaimer } from "./ForecastDisclaimer";
import { formatNaira, formatNumber, formatPercent } from "@/lib/format";
import {
  projectFundamental,
  sensitivityGrid,
  type FundamentalAssumptions,
} from "@/lib/forecast/fundamental";
import type { CompanyDetail } from "@/lib/ngx/types";

export function FundamentalScenarioTab({ detail }: { detail: CompanyDetail | null }) {
  const ttmEps = detail?.ttm_eps ?? null;
  const price = detail?.current_price ?? null;
  const basePe = ttmEps && ttmEps !== 0 && price ? price / ttmEps : 12;

  const [growth, setGrowth] = useState(12);
  const [margin, setMargin] = useState(0);
  const [exitPe, setExitPe] = useState(Number(basePe.toFixed(1)));
  const [years, setYears] = useState(3);
  const [payout, setPayout] = useState(40);

  const assumptions: FundamentalAssumptions = {
    ttmEps: ttmEps ?? 0,
    currentPrice: price ?? 0,
    revenueGrowthPct: growth,
    marginDeltaPct: margin,
    exitPe,
    years,
    payoutRatioPct: payout,
  };

  const result = useMemo(() => projectFundamental(assumptions), [assumptions]);

  const growthAxis = [growth - 10, growth - 5, growth, growth + 5, growth + 10];
  const peAxis = [exitPe - 4, exitPe - 2, exitPe, exitPe + 2, exitPe + 4].map((v) =>
    Math.max(1, Number(v.toFixed(1)))
  );
  const grid = useMemo(
    () => sensitivityGrid(assumptions, growthAxis, peAxis),
    [assumptions, growth, exitPe]
  );

  if (!ttmEps || !price) {
    return (
      <Panel title="Fundamental scenario" subtitle="Implied price from assumptions">
        <p className="py-6 text-center font-sans text-[13px] text-ink/55">
          Trailing EPS is unavailable for this company, so an earnings-based
          scenario can&apos;t be built.
        </p>
      </Panel>
    );
  }

  // Colour a sensitivity cell by implied return vs current price.
  const cellTone = (val: number) => {
    const ret = (val - price) / price;
    const a = Math.min(0.8, Math.abs(ret) * 1.2 + 0.08);
    return ret >= 0 ? `rgba(138,200,115,${a})` : `rgba(192,57,43,${a})`;
  };

  return (
    <div className="space-y-4">
      <ForecastDisclaimer />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Inputs */}
        <Panel title="Assumptions" subtitle="Analyst inputs">
          <div className="space-y-3">
            <Slider label="Revenue growth" value={growth} onChange={setGrowth} min={-20} max={40} suffix="%/yr" />
            <Slider label="Margin change" value={margin} onChange={setMargin} min={-10} max={10} suffix="pp/yr" />
            <Slider label="Exit P/E" value={exitPe} onChange={setExitPe} min={2} max={40} step={0.5} suffix="×" />
            <Slider label="Horizon" value={years} onChange={setYears} min={1} max={7} suffix="yr" />
            <Slider label="Payout ratio" value={payout} onChange={setPayout} min={0} max={100} suffix="%" />
          </div>
        </Panel>

        {/* Outputs */}
        <Panel title="Implied outcome" subtitle={`${years}-year scenario`} className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Out label="Implied price" value={formatNaira(result.impliedPrice)} strong />
            <Out label="Total return" value={<Delta value={result.priceReturnPct} showArrow={false} />} />
            <Out label="Price CAGR" value={<Delta value={result.priceCagrPct} showArrow={false} />} />
            <Out label="Projected EPS" value={formatNaira(result.projectedEps)} />
            <Out label="Fwd P/E (now)" value={`${result.impliedForwardPe.toFixed(1)}×`} />
            <Out label="Terminal DPS" value={formatNaira(result.projectedDps)} />
          </div>
          <p className="mt-3 font-sans text-[11px] text-ink/55">
            Implied price = projected EPS × exit P/E. Projected EPS compounds
            trailing EPS ({formatNaira(ttmEps)}) at revenue growth plus the margin
            kicker over {years} year{years > 1 ? "s" : ""}.
          </p>
        </Panel>
      </div>

      {/* Sensitivity grid */}
      <Panel title="Sensitivity — exit P/E × growth" subtitle="Implied price (₦)">
        <div className="overflow-x-auto">
          <table className="w-full text-center font-sans text-[12px]">
            <thead>
              <tr>
                <th className="p-1.5 text-left font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                  P/E \ Growth
                </th>
                {grid.growthAxis.map((g) => (
                  <th key={g} className="p-1.5 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                    {g.toFixed(0)}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.peAxis.map((pe, i) => (
                <tr key={pe}>
                  <td className="p-1.5 text-left font-semibold text-forest">{pe.toFixed(1)}×</td>
                  {grid.cells[i].map((val, j) => (
                    <td
                      key={j}
                      style={{ backgroundColor: cellTone(val) }}
                      className="p-1.5 tabular-nums text-ink"
                    >
                      {formatNumber(val, 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 font-sans text-[10px] text-ink/45">
          Shaded vs current price {formatNaira(price)} — green above, red below.
        </p>
      </Panel>

      <ForecastDisclaimer compact />
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="font-sans text-[11px] uppercase tracking-eyebrow text-ink/55">{label}</label>
        <span className="font-serif text-sm font-semibold text-forest tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-fresh"
      />
    </div>
  );
}

function Out({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-stone bg-surface px-3.5 py-3 shadow-card">
      <p className="font-sans text-[9.5px] font-semibold uppercase tracking-eyebrow text-ink/40">{label}</p>
      <p className={`mt-0.5 font-serif font-semibold tabular-nums text-forest ${strong ? "text-lg" : "text-base"}`}>
        {value}
      </p>
    </div>
  );
}
