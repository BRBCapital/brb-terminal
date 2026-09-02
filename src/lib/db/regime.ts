import "server-only";
import { query, queryOne } from "./client";
import type { RegimeSnapshot, RegimeState } from "@/lib/engine/regime";

export interface RegimeRow {
  date: string;
  score: number;
  state: RegimeState;
  exposure_mult: number;
  trend: number;
  breadth: number;
  volatility: number;
  fx: number;
  narrative: string;
  drivers: string[];
}

function coerce(r: Record<string, unknown>): RegimeRow {
  let detail: { narrative?: string; drivers?: string[] } = {};
  try {
    detail = r.detail ? JSON.parse(String(r.detail)) : {};
  } catch {
    /* ignore */
  }
  return {
    date: String(r.date),
    score: Number(r.score),
    state: String(r.state) as RegimeState,
    exposure_mult: Number(r.exposure_mult),
    trend: Number(r.trend),
    breadth: Number(r.breadth),
    volatility: Number(r.volatility),
    fx: Number(r.fx),
    narrative: detail.narrative ?? "",
    drivers: detail.drivers ?? [],
  };
}

// One snapshot per WAT date; the latest evaluation of the day wins.
export async function upsertRegimeSnapshot(dateStr: string, s: RegimeSnapshot): Promise<void> {
  await query(
    `INSERT INTO strategy_regime (date, score, state, exposure_mult, trend, breadth, volatility, fx, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (date) DO UPDATE SET
       score = EXCLUDED.score, state = EXCLUDED.state, exposure_mult = EXCLUDED.exposure_mult,
       trend = EXCLUDED.trend, breadth = EXCLUDED.breadth, volatility = EXCLUDED.volatility,
       fx = EXCLUDED.fx, detail = EXCLUDED.detail, created_at = now()`,
    [
      dateStr,
      s.score,
      s.state,
      s.exposure_mult,
      s.components.trend,
      s.components.breadth,
      s.components.volatility,
      s.components.fx,
      JSON.stringify({ narrative: s.narrative, drivers: s.drivers, inputs: s.inputs }),
    ]
  );
}

export async function getLatestRegime(): Promise<RegimeRow | null> {
  const r = await queryOne<Record<string, unknown>>(`SELECT * FROM strategy_regime ORDER BY date DESC LIMIT 1`);
  return r ? coerce(r) : null;
}

export async function listRegime(days = 60): Promise<RegimeRow[]> {
  const rows = await query<Record<string, unknown>>(`SELECT * FROM strategy_regime ORDER BY date DESC LIMIT $1`, [days]);
  return rows.map(coerce).reverse(); // oldest → newest for charting
}
