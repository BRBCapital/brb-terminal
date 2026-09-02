// Shared portfolio validation — used by both the API (trust boundary) and the
// builder UI (live feedback). Dependency-free so it runs on server and client.

import type { HoldingInput, PortfolioInput } from "@/lib/db/portfolios";

export interface ConcentrationThresholds {
  singleStockMaxPct: number; // default 10
  sectorMaxPct: number; // default 30
}

export const DEFAULT_THRESHOLDS: ConcentrationThresholds = {
  singleStockMaxPct: 10,
  sectorMaxPct: 30,
};

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

// Effective weights: for weight-mode use the stated weights; for units-mode
// derive market-value weights from units × entry price.
export function effectiveWeights(
  holdings: HoldingInput[]
): Array<{ symbol: string; sector: string; pct: number }> {
  const isUnits = holdings.some((h) => h.mode === "units");
  if (isUnits) {
    const values = holdings.map((h) => (h.units ?? 0) * (h.entry_price ?? 0));
    const total = values.reduce((a, b) => a + b, 0);
    return holdings.map((h, i) => ({
      symbol: h.symbol,
      sector: h.sector ?? "",
      pct: total > 0 ? (values[i] / total) * 100 : 0,
    }));
  }
  return holdings.map((h) => ({
    symbol: h.symbol,
    sector: h.sector ?? "",
    pct: h.weight ?? 0,
  }));
}

export function validatePortfolio(
  input: PortfolioInput,
  thresholds: ConcentrationThresholds = DEFAULT_THRESHOLDS
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!input.name || !input.name.trim()) {
    issues.push({ level: "error", message: "Portfolio needs a name." });
  }
  if (!input.holdings.length) {
    issues.push({ level: "error", message: "Add at least one holding." });
    return issues;
  }

  const dupes = input.holdings
    .map((h) => h.symbol.toUpperCase())
    .filter((s, i, arr) => arr.indexOf(s) !== i);
  if (dupes.length) {
    issues.push({
      level: "error",
      message: `Duplicate holding: ${[...new Set(dupes)].join(", ")}.`,
    });
  }

  for (const h of input.holdings) {
    if (!(h.entry_price > 0)) {
      issues.push({
        level: "error",
        message: `${h.symbol}: entry price must be greater than zero.`,
      });
    }
    if (h.mode === "weight" && !(Number(h.weight) > 0)) {
      issues.push({
        level: "error",
        message: `${h.symbol}: weight must be greater than zero.`,
      });
    }
    if (h.mode === "units" && !(Number(h.units) > 0)) {
      issues.push({
        level: "error",
        message: `${h.symbol}: units must be greater than zero.`,
      });
    }
  }

  // All holdings must share one mode — effectiveWeights values units-mode rows
  // by units×price and weight-mode rows by their stated weight, so a mix would
  // silently zero the weight-mode holdings.
  const modes = new Set(input.holdings.map((h) => h.mode));
  if (modes.size > 1) {
    issues.push({
      level: "error",
      message: "All holdings must use the same mode (either weights or units, not both).",
    });
  }

  const isWeightMode = input.holdings.every((h) => h.mode === "weight");
  if (isWeightMode) {
    const sum = input.holdings.reduce((s, h) => s + (h.weight ?? 0), 0);
    if (Math.abs(sum - 100) > 0.1) {
      issues.push({
        level: "error",
        message: `Weights sum to ${sum.toFixed(1)}% — must total 100%.`,
      });
    }
  }

  // Concentration warnings (non-blocking).
  const weights = effectiveWeights(input.holdings);
  for (const w of weights) {
    if (w.pct > thresholds.singleStockMaxPct) {
      issues.push({
        level: "warning",
        message: `${w.symbol} is ${w.pct.toFixed(1)}% — above the ${thresholds.singleStockMaxPct}% single-stock limit.`,
      });
    }
  }
  const bySector = new Map<string, number>();
  for (const w of weights) {
    if (!w.sector) continue;
    bySector.set(w.sector, (bySector.get(w.sector) ?? 0) + w.pct);
  }
  for (const [sector, pct] of bySector) {
    if (pct > thresholds.sectorMaxPct) {
      issues.push({
        level: "warning",
        message: `${sector} is ${pct.toFixed(1)}% — above the ${thresholds.sectorMaxPct}% sector limit.`,
      });
    }
  }

  return issues;
}
