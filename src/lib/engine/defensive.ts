import "server-only";
import type { CompanyListRow } from "@/lib/ngx/types";
import type { StrategySettings } from "@/lib/db/strategy";
import type { EnginePosition } from "./risk";

// ── Defensive sleeve ──────────────────────────────────────────────────────
// On a RISK_OFF regime the engine rotates OUT of momentum and INTO a defensive
// basket: low-volatility, defensive-sector, liquid names that aren't falling
// knives. Deterministic (no AI in the decision) and unit-tested. This is the
// active de-risk — cash + defensive is the NGX substitute for a short book.

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Defensive-sector tilt (NGX sector strings are upper-cased in the API).
export function sectorDefensiveness(sector: string): number {
  const s = (sector || "").toUpperCase();
  if (/CONSUMER|HEALTH|TELECOM|ICT|COMMUNICATION|UTILIT/.test(s)) return 1.0; // staples, healthcare, telecoms
  // Cyclical / high-beta checked BEFORE the generic "services" rule so that
  // "FINANCIAL SERVICES" is treated as cyclical (0.2), not a defensive service.
  if (/FINANC|BANK|OIL|GAS|INDUSTRIAL|CONSTRUCTION|REAL ESTATE|NATURAL/.test(s)) return 0.2;
  if (/SERVICE|AGRIC/.test(s)) return 0.6;
  if (/CONGLOMERATE/.test(s)) return 0.5;
  return 0.4;
}

function rangePct(r: CompanyListRow): number | null {
  if (r.high_52wk != null && r.low_52wk != null && r.price && r.price > 0 && r.high_52wk > r.low_52wk) {
    return (r.high_52wk - r.low_52wk) / r.price;
  }
  return null;
}

interface Scored {
  row: CompanyListRow;
  score: number;
  rangePct: number;
}

// Pure scoring/selection — unit-tested.
export function scoreDefensive(universe: CompanyListRow[]): Scored[] {
  const priced = universe.filter((r) => (r.price ?? 0) > 0 && (r.volume ?? 0) > 0);
  const vols = priced.map((r) => r.volume ?? 0).sort((a, b) => a - b);
  const medianVol = vols.length ? vols[Math.floor(vols.length / 2)] : 0;

  const scored: Scored[] = [];
  for (const r of priced) {
    const m = r.change_1m_percent ?? 0;
    if (m < -12) continue; // avoid falling knives

    const rp = rangePct(r);
    const lowVol = rp == null ? 0.5 : clamp01(1 - (rp - 0.3) / (2.0 - 0.3));
    const stability = clamp01(1 - Math.abs(m - 1) / 20); // centred on a mild +1% uptrend
    const liquidity = medianVol > 0 ? clamp01((r.volume ?? 0) / (medianVol * 2)) : 0.5;
    const sector = sectorDefensiveness(r.sector);

    const score = 0.35 * sector + 0.3 * lowVol + 0.2 * stability + 0.15 * liquidity;
    scored.push({ row: r, score, rangePct: rp ?? 1.0 });
  }
  return scored.sort((a, b) => b.score - a.score);
}

export function selectDefensiveSleeve(input: {
  universe: CompanyListRow[];
  bucketNgn: number;
  settings: StrategySettings;
  count?: number;
}): { positions: EnginePosition[]; note: string } {
  const count = Math.max(4, Math.min(10, input.count ?? 8));
  const picks = scoreDefensive(input.universe).slice(0, count);
  if (!picks.length) return { positions: [], note: "No defensive names available." };

  // Inverse-volatility weighting: calmer names get a larger share.
  const invVol = picks.map((p) => 1 / Math.max(0.05, p.rangePct));
  const wsum = invVol.reduce((a, b) => a + b, 0) || 1;
  const stopFrac = 1 - (input.settings.stop_loss_pct || 8) / 100;

  const positions: EnginePosition[] = [];
  picks.forEach((p, i) => {
    const price = p.row.price!;
    const alloc = (invVol[i] / wsum) * input.bucketNgn;
    const units = Math.floor(alloc / price);
    if (units <= 0) return;
    positions.push({
      ticker: p.row.symbol.toUpperCase(),
      company_name: p.row.name,
      sector: p.row.sector,
      entry_price: price,
      units,
      amount_ngn: units * price,
      target_price: Math.round(price * 1.06 * 100) / 100, // modest defensive target
      stop_loss: Math.round(price * stopFrac * 100) / 100,
      rationale: `Defensive rotation — low-vol ${p.row.sector || "name"} (risk-off)`,
    });
  });

  return {
    positions,
    note: `Defensive sleeve — ${positions.length} low-volatility / defensive-sector names, inverse-vol weighted (risk-off rotation).`,
  };
}
