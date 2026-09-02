// Pure portfolio analytics computed from enriched holdings. Shared by the
// builder (live preview) and the portfolio view.

import { effectiveWeights } from "./validate";
import type { HoldingMode } from "@/lib/db/portfolios";

export interface EnrichedHolding {
  symbol: string;
  company_name: string;
  sector: string;
  mode: HoldingMode;
  weight?: number | null;
  units?: number | null;
  entry_price: number;
  // Live enrichment from the company detail endpoint (not persisted).
  current_price?: number | null;
  dividend_yield?: number | null; // percent
  ttm_eps?: number | null;
}

export interface SectorSlice {
  sector: string;
  pct: number;
}

export interface PortfolioMetrics {
  weights: Array<{ symbol: string; sector: string; pct: number }>;
  sectorAllocation: SectorSlice[];
  weightedDividendYield: number | null;
  weightedPE: number | null;
  weightSum: number; // only meaningful in weight mode
  investedValue: number | null; // units mode: Σ units×entry
  isUnitsMode: boolean;
}

export function computeMetrics(holdings: EnrichedHolding[]): PortfolioMetrics {
  const isUnitsMode = holdings.length > 0 && holdings.some((h) => h.mode === "units");
  const weights = effectiveWeights(holdings);
  const byIndex = new Map(weights.map((w, i) => [i, w.pct]));

  // Weighted averages over holdings that have the input metric.
  let dySum = 0;
  let dyW = 0;
  let peSum = 0;
  let peW = 0;
  holdings.forEach((h, i) => {
    const w = (byIndex.get(i) ?? 0) / 100;
    if (h.dividend_yield != null && !Number.isNaN(h.dividend_yield)) {
      dySum += w * h.dividend_yield;
      dyW += w;
    }
    const price = h.current_price ?? h.entry_price;
    // Only positive earners contribute to a weighted P/E — a negative EPS would
    // add a meaningless negative P/E and drag the aggregate below zero.
    if (h.ttm_eps != null && h.ttm_eps > 0 && price != null) {
      peSum += w * (price / h.ttm_eps);
      peW += w;
    }
  });

  const sectorMap = new Map<string, number>();
  for (const w of weights) {
    const key = w.sector || "Unclassified";
    sectorMap.set(key, (sectorMap.get(key) ?? 0) + w.pct);
  }
  const sectorAllocation = [...sectorMap.entries()]
    .map(([sector, pct]) => ({ sector, pct }))
    .sort((a, b) => b.pct - a.pct);

  const weightSum = holdings.reduce((s, h) => s + (h.weight ?? 0), 0);
  const investedValue = isUnitsMode
    ? holdings.reduce((s, h) => s + (h.units ?? 0) * (h.entry_price ?? 0), 0)
    : null;

  return {
    weights,
    sectorAllocation,
    weightedDividendYield: dyW > 0 ? dySum / dyW : null,
    weightedPE: peW > 0 ? peSum / peW : null,
    weightSum,
    investedValue,
    isUnitsMode,
  };
}

// BRB-brand palette for the sector donut — greens first, then neutral accents.
// Mid-tone, distinct hues that read on BOTH the light sand and dark forest
// surfaces — the old palette led with near-black greens (#052A22/#1A4D40) that
// disappeared into the dark donut background.
export const DONUT_COLORS = [
  "#8AC873",
  "#C9A227",
  "#4E9E6B",
  "#B7A57A",
  "#5FB0C9",
  "#D4884B",
  "#6B8F71",
  "#9CAF88",
  "#7C9CBF",
  "#A3C4A8",
  "#C08457",
  "#5C8A72",
  "#8FA0B5",
];
