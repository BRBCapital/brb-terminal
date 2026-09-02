import "server-only";
import { ngxFetch } from "@/lib/ngx/client";
import type { MarketSnapshot, IndexSummary, ForexCurrent, CompanyListRow, Paginated } from "@/lib/ngx/types";

// ── Market-regime engine ──────────────────────────────────────────────────
// Produces a continuous risk-on score (0..1) and a discrete state from four
// economically-motivated components: TREND, BREADTH, VOLATILITY, FX stress.
// PHASE 1 = SHADOW MODE: computed and displayed only; `exposure_mult` is what it
// WOULD apply to deployed capital, but nothing here changes allocation yet.

export type RegimeState = "RISK_ON" | "NEUTRAL" | "RISK_OFF" | "CRISIS";

export interface RegimeInputs {
  asiTodayPct: number; // ASI daily % change
  asi7dPct: number; // ASI 7-day % change
  asiYtdPct: number; // ASI YTD % change
  advancers: number;
  decliners: number;
  pctPositive1m: number; // fraction of names with positive 1-month return (0..1)
  pctUpperRange: number; // fraction of names in the upper half of their 52wk range (0..1)
  avgAbsDailyPct: number; // mean |daily move| across the universe — a vol proxy
  dispersionPct: number; // stdev of daily moves — a vol proxy
  fxDailyPct: number; // NGN vs USD daily %; + = NGN depreciation (stress)
}

export interface RegimeSnapshot {
  score: number; // 0..1
  state: RegimeState;
  exposure_mult: number; // 0..1 shadow multiplier
  components: { trend: number; breadth: number; volatility: number; fx: number };
  drivers: string[]; // human-readable driver list
  narrative: string;
  inputs: RegimeInputs;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const to01 = (t: number) => (t + 1) / 2; // map tanh(-1..1) → 0..1
const tanh = (x: number) => Math.tanh(x);

// Pure, deterministic scoring — unit-tested. The LLM never sets these numbers.
export function computeRegime(i: RegimeInputs): RegimeSnapshot {
  // TREND — blended multi-horizon ASI momentum (YTD dominant, then weekly/daily).
  const trend = clamp01(
    0.5 * to01(tanh(i.asiYtdPct / 15)) + 0.3 * to01(tanh(i.asi7dPct / 5)) + 0.2 * to01(tanh(i.asiTodayPct / 2))
  );

  // BREADTH — participation. adv/dec ratio + share of names in uptrends.
  const adr = i.decliners > 0 ? i.advancers / i.decliners : i.advancers > 0 ? 3 : 1;
  const adrScore = adr / (adr + 1); // 1→0.5, 2→0.67, 0.5→0.33
  const breadth = clamp01(0.4 * adrScore + 0.3 * clamp01(i.pctPositive1m) + 0.3 * clamp01(i.pctUpperRange));

  // VOLATILITY — calmer = more risk-on. avg |move| ~1% calm, ~3.5%+ turbulent.
  const volFromAvg = clamp01(1 - (i.avgAbsDailyPct - 1.0) / (3.5 - 1.0));
  const volFromDisp = clamp01(1 - (i.dispersionPct - 1.5) / (5.0 - 1.5));
  const volatility = clamp01(0.6 * volFromAvg + 0.4 * volFromDisp);

  // FX — NGN stress. Stable/appreciating ≈ 1; depreciation drags toward 0.
  const fx = clamp01(1 - Math.max(0, i.fxDailyPct) / 3);

  // Composite risk-on score.
  const score = clamp01(0.35 * trend + 0.3 * breadth + 0.15 * volatility + 0.2 * fx);

  // Hard overrides for the tail state.
  const fxShock = i.fxDailyPct > 2.5;
  const volBlowout = i.avgAbsDailyPct > 4;
  let state: RegimeState;
  if (fxShock || volBlowout || score < 0.2) state = "CRISIS";
  else if (score < 0.4) state = "RISK_OFF";
  else if (score < 0.6) state = "NEUTRAL";
  else state = "RISK_ON";

  // Exposure multiplier (fraction of base capital to deploy).
  const exposure_mult = exposureMultFor(state, score);

  // Driver narrative.
  const drivers: string[] = [];
  drivers.push(`ASI ${i.asiYtdPct >= 0 ? "+" : ""}${i.asiYtdPct.toFixed(1)}% YTD, ${i.asi7dPct >= 0 ? "+" : ""}${i.asi7dPct.toFixed(1)}% 7d`);
  drivers.push(`breadth ${(i.pctPositive1m * 100).toFixed(0)}% up (adv/dec ${adr.toFixed(2)})`);
  drivers.push(`avg move ${i.avgAbsDailyPct.toFixed(1)}%`);
  drivers.push(`NGN ${i.fxDailyPct >= 0 ? "-" : "+"}${Math.abs(i.fxDailyPct).toFixed(2)}%`);
  const parts: Array<[string, number]> = [
    ["trend", trend],
    ["breadth", breadth],
    ["volatility", volatility],
    ["fx", fx],
  ];
  const worst = parts.sort((a, b) => a[1] - b[1])[0][0];
  const label =
    state === "RISK_ON" ? "constructive — full participation" : state === "NEUTRAL" ? "mixed — normal exposure" : state === "RISK_OFF" ? `defensive — ${worst} weakest` : `crisis — ${fxShock ? "FX shock" : volBlowout ? "volatility blowout" : "broad breakdown"}`;
  const narrative = `${drivers.join("; ")}. Regime ${state} (${(score * 100).toFixed(0)}/100) — ${label}.`;

  return { score: Math.round(score * 1000) / 1000, state, exposure_mult, components: { trend: r3(trend), breadth: r3(breadth), volatility: r3(volatility), fx: r3(fx) }, drivers, narrative, inputs: i };
}
const r3 = (x: number) => Math.round(x * 1000) / 1000;

// Fraction of base capital to deploy for a given state/score. Higher states and
// higher scores deploy more; CRISIS is floored hard.
export function exposureMultFor(state: RegimeState, score: number): number {
  const mult =
    state === "CRISIS" ? 0.1 : state === "RISK_OFF" ? clamp01(0.2 + score * 0.5) : state === "NEUTRAL" ? clamp01(0.45 + score * 0.5) : clamp01(0.75 + score * 0.3);
  return Math.round(clamp01(mult) * 100) / 100;
}

export const isDefensive = (s: RegimeState) => s === "RISK_OFF" || s === "CRISIS";

// Hysteresis: de-risk immediately, but only re-risk after `dwell` consecutive
// non-defensive days. `recentStates` are prior snapshots (oldest→newest).
export function resolveEffectiveState(today: RegimeState, recentStates: RegimeState[], dwell: number): RegimeState {
  if (isDefensive(today)) return today; // fast de-risk — never wait to reduce risk
  const d = Math.max(0, Math.floor(dwell));
  if (d === 0) return today; // no hysteresis
  const window = recentStates.slice(-d);
  return window.some(isDefensive) ? "RISK_OFF" : today; // stay cautious until confirmed
}

// ── Live data gathering ───────────────────────────────────────────────────
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

export async function gatherRegimeInputs(): Promise<RegimeInputs> {
  const [snapRes, idxRes, fxRes, coRes] = await Promise.all([
    ngxFetch<MarketSnapshot>({ path: "market/snapshot" }),
    ngxFetch<IndexSummary[]>({ path: "indices" }),
    ngxFetch<ForexCurrent>({ path: "forex/current" }),
    ngxFetch<Paginated<CompanyListRow>>({ path: "companies", query: "limit=300" }),
  ]);

  const snap = snapRes.ok ? snapRes.data : null;
  const asiIdx = idxRes.ok ? (Array.isArray(idxRes.data) ? idxRes.data : []).find((x) => /all.?share|ASI|NGX/i.test(x.index_name) || /ASI/i.test(x.symbol)) : null;
  const usd = fxRes.ok ? fxRes.data.rates?.find((r) => r.currency === "USD") : null;
  const rows = coRes.ok ? (coRes.data.data ?? []).filter((r) => r.price != null) : [];

  // Breadth & vol from the company universe.
  const withMom = rows.filter((r) => r.change_1m_percent != null);
  const pctPositive1m = withMom.length ? withMom.filter((r) => (r.change_1m_percent ?? 0) > 0).length / withMom.length : 0.5;
  const inRange = rows.filter((r) => r.high_52wk != null && r.low_52wk != null && r.high_52wk! > r.low_52wk!);
  const pctUpperRange = inRange.length
    ? inRange.filter((r) => (r.price ?? 0) > (r.low_52wk! + (r.high_52wk! - r.low_52wk!) / 2)).length / inRange.length
    : 0.5;
  const dailyMoves = rows.map((r) => r.price_change_percent).filter((v): v is number => v != null);
  const avgAbsDailyPct = dailyMoves.length ? dailyMoves.reduce((s, v) => s + Math.abs(v), 0) / dailyMoves.length : 1.2;
  const dispersionPct = stdev(dailyMoves);

  return {
    asiTodayPct: snap?.asi_change_percent ?? asiIdx?.price_change_percent ?? 0,
    asi7dPct: asiIdx?.change_7d_percent ?? 0,
    asiYtdPct: snap?.ytd_asi_change_percent ?? asiIdx?.change_ytd_percent ?? 0,
    advancers: snap?.breadth?.advancers ?? 0,
    decliners: snap?.breadth?.decliners ?? 0,
    pctPositive1m,
    pctUpperRange,
    avgAbsDailyPct,
    dispersionPct,
    fxDailyPct: usd?.daily_change_percent ?? 0,
  };
}

export async function evaluateRegime(): Promise<RegimeSnapshot> {
  return computeRegime(await gatherRegimeInputs());
}
