// Derived analytics: reconstruct plan-gated aggregates (sector performance,
// breadth, YTD leaders) from the per-company list that IS available on the
// Starter tier. Deterministic and exact for what it measures — but note the
// methodology difference: our sector changes are EQUAL-WEIGHTED means of
// constituent moves, while the API's Growth-tier endpoint may weight
// differently. Every consumer must label derived data as derived.

import type { CompanyListRow } from "./types";

export interface DerivedSector {
  sector: string;
  company_count: number;
  change_1d: number;
  change_7d: number;
  change_52w: number;
  total_market_cap: number;
  breadth: { advancers: number; decliners: number; unchanged: number };
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function deriveSectors(rows: CompanyListRow[]): DerivedSector[] {
  const groups = new Map<string, CompanyListRow[]>();
  for (const r of rows) {
    if (!r.sector) continue;
    const g = groups.get(r.sector) ?? [];
    g.push(r);
    groups.set(r.sector, g);
  }
  const out: DerivedSector[] = [];
  for (const [sector, list] of groups) {
    const d1 = list.map((r) => r.price_change_percent).filter((v): v is number => v != null);
    const d7 = list.map((r) => r.change_7d_percent).filter((v): v is number => v != null);
    const d52 = list.map((r) => r.change_52w_percent).filter((v): v is number => v != null);
    let advancers = 0;
    let decliners = 0;
    let unchanged = 0;
    for (const v of d1) {
      if (v > 0) advancers++;
      else if (v < 0) decliners++;
      else unchanged++;
    }
    out.push({
      sector,
      company_count: list.length,
      change_1d: Number(mean(d1).toFixed(2)),
      change_7d: Number(mean(d7).toFixed(2)),
      change_52w: Number(mean(d52).toFixed(2)),
      total_market_cap: list.reduce((s, r) => s + (r.market_cap ?? 0), 0),
      breadth: { advancers, decliners, unchanged },
    });
  }
  return out.sort((a, b) => b.change_1d - a.change_1d);
}

export interface DerivedBreadth {
  advancers: number;
  decliners: number;
  unchanged: number;
  total: number;
}

export function deriveBreadth(rows: CompanyListRow[]): DerivedBreadth {
  let advancers = 0;
  let decliners = 0;
  let unchanged = 0;
  let total = 0;
  for (const r of rows) {
    const v = r.price_change_percent;
    if (v == null) continue;
    total++;
    if (v > 0) advancers++;
    else if (v < 0) decliners++;
    else unchanged++;
  }
  return { advancers, decliners, unchanged, total };
}

export interface DerivedYtdRow {
  symbol: string;
  company_name: string;
  sector: string;
  current_price: number | null;
  ytd_pct: number;
}

export function deriveYtd(
  rows: CompanyListRow[],
  type: "best" | "worst",
  limit = 8
): DerivedYtdRow[] {
  const withYtd = rows
    .filter((r) => r.change_ytd_percent != null)
    .map((r) => ({
      symbol: r.symbol,
      company_name: r.name,
      sector: r.sector,
      current_price: r.price,
      ytd_pct: r.change_ytd_percent as number,
    }));
  withYtd.sort((a, b) =>
    type === "best" ? b.ytd_pct - a.ytd_pct : a.ytd_pct - b.ytd_pct
  );
  return withYtd.slice(0, limit);
}
