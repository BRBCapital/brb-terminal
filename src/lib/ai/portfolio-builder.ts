// AI portfolio builder — Claude (Fable 5) acts as the combined CIO / Head Trader
// of a top Nigerian brokerage and constructs an institutional-grade, horizon-
// specific NGX equity portfolio for a given budget. Claude makes the picks,
// targets, stops and sizing; the server reconciles entry price / units / naira
// against live prices so the arithmetic is always exact and grounded.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, hasAnthropicCredentials } from "./credentials";
import { ngxFetch } from "@/lib/ngx/client";
import { deriveSectors } from "@/lib/ngx/derived";
import type { Horizon } from "@/lib/db/paper-trades";
import type {
  CompanyListRow,
  CompanyDetail,
  Paginated,
  SectorRotation,
  ForexCurrent,
  MarketSnapshot,
} from "@/lib/ngx/types";

const PRIMARY_MODEL = "claude-fable-5";
const FALLBACK_MODEL = "claude-opus-4-8";

export interface BuiltPosition {
  ticker: string;
  company_name: string;
  sector: string;
  allocation_ngn: number;
  allocation_pct: number;
  units: number;
  entry_price: number;
  target_price: number | null;
  stop_loss: number | null;
  expected_return_pct: number | null;
  expected_exit_date: string;
  rationale: string;
  liquidity_note: string;
}

export interface BuiltPortfolio {
  horizon: Horizon;
  currency: "NGN" | "USD";
  amount_input: number;
  budget_ngn: number;
  fx_rate_used: number | null;
  market_context: string;
  portfolio_risk_note: string;
  weighted_expected_return_pct: number | null;
  total_allocated_ngn: number;
  cash_residual_ngn: number;
  positions: BuiltPosition[];
  warnings: string[];
  model: string;
}

export interface BuildResult {
  ok: boolean;
  portfolio?: BuiltPortfolio;
  error?: string;
  errorCode?: "NO_CREDENTIALS" | "RATE_LIMITED" | "API_ERROR" | "NO_DATA" | "REFUSED";
}

const SYSTEM_PROMPT = `You are the combined Chief Investment Officer and Head Trader of a top-tier Nigerian brokerage firm, with 20+ years of experience trading the Nigerian Exchange (NGX). You construct institutional-grade equity portfolios for professional analysts at BRB Capital Group.

YOUR EXPERTISE
You apply the full discipline of an institutional Nigerian trading desk:
- Liquidity first: You never recommend a position the market cannot absorb. You check traded value/volume and ensure each position could be entered and exited within a reasonable share of daily volume (guideline: no position larger than ~15% of the stock's daily traded value for intraday/weekly horizons; up to ~30% for monthly/yearly).
- NGX market structure: You account for the 10% daily price movement limit, T+3 settlement, market hours (10:00–14:30 WAT), and the practical reality of wide spreads and thin books outside the most liquid names.
- Sector awareness: You understand the dynamics of NGX banking, industrial goods, consumer goods, oil & gas, insurance, and telecoms sectors — including dividend seasons, earnings calendars, CBN policy impact on banks, FX pass-through on consumer names, and index rebalancing flows.
- Momentum and mean reversion: For short horizons you weight price momentum, volume surges and order-flow signals. For long horizons you weight valuation (P/E, P/B, dividend yield), earnings quality, and structural themes (recapitalisation, FX liberalisation beneficiaries, infrastructure).
- Risk management: Every position has a defined entry, target, and stop-loss. You size positions so no single stop-loss event costs more than ~2% of total capital on short horizons, or ~5% on long horizons. You diversify across at least 3 sectors unless capital is too small to do so sensibly.
- Capital realism: If the capital amount is small, you concentrate in fewer, highly liquid names rather than spreading into unbuyable fractional allocations. Round all unit counts to whole shares. Leave a small cash residual rather than forcing full deployment.

HORIZON PLAYBOOKS
- INTRADAY (buy today, sell next trading day): Only the most liquid NGX names. Prioritise volume spikes, momentum continuation, news catalysts and closing-auction dynamics. Tight stops (2–4%). 2–4 positions maximum.
- WEEKLY: Liquid names with short-term catalysts — earnings releases, dividend markdowns/qualification dates, index inclusion, sector rotation. Stops 4–7%. 3–5 positions.
- MONTHLY: Blend of momentum and valuation. Position ahead of earnings season, dividend declarations and macro events (MPC meetings, auction calendars). Stops 7–12%. 4–6 positions.
- YEARLY: Fundamental conviction picks — valuation, dividend yield, earnings growth, structural themes. Liquidity constraints relax but never vanish. Stops 15–20% or thesis-based. 5–8 positions.

DATA DISCIPLINE
- Base every recommendation ONLY on the market data provided. Do not invent prices, volumes or fundamentals not present in the data. Use only tickers that appear in the provided universe.
- If the data is insufficient to responsibly recommend a position for the selected horizon, say so in the "warnings" field and recommend fewer positions rather than fabricating conviction.
- All prices in NGN. If capital is in USD, convert using the FX rate provided; state the rate used in the summary.
- This is an illustrative construction for internal analyst evaluation and paper trading — not investment advice, not a client recommendation, and not an order.

OUTPUT FORMAT
Respond ONLY with a valid JSON object matching the required schema — no preamble, no markdown, no commentary outside the JSON. Provide entry_price, target_price and stop_loss in NGN; allocation_pct as a percentage of capital; units as whole shares; expected_exit_date as YYYY-MM-DD appropriate to the horizon; and a specific, data-cited rationale and liquidity_note for each position.`;

// Schema mirrors the desk output format (structured outputs).
const PORTFOLIO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: {
      type: "object",
      additionalProperties: false,
      properties: {
        horizon: { type: "string", enum: ["intraday", "weekly", "monthly", "yearly"] },
        capital_currency: { type: "string", enum: ["NGN", "USD"] },
        capital_amount: { type: "number" },
        weighted_expected_return_pct: { type: "number" },
        portfolio_risk_note: { type: "string" },
        market_context: { type: "string" },
      },
      required: [
        "horizon",
        "capital_currency",
        "capital_amount",
        "weighted_expected_return_pct",
        "portfolio_risk_note",
        "market_context",
      ],
    },
    positions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          ticker: { type: "string" },
          company_name: { type: "string" },
          sector: { type: "string" },
          allocation_pct: { type: "number" },
          units: { type: "integer" },
          entry_price: { type: "number" },
          target_price: { type: "number" },
          stop_loss: { type: "number" },
          expected_return_pct: { type: "number" },
          expected_exit_date: { type: "string" },
          rationale: { type: "string" },
          liquidity_note: { type: "string" },
        },
        required: [
          "ticker",
          "company_name",
          "sector",
          "allocation_pct",
          "units",
          "entry_price",
          "target_price",
          "stop_loss",
          "expected_return_pct",
          "expected_exit_date",
          "rationale",
          "liquidity_note",
        ],
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "positions", "warnings"],
} as const;

interface ClaudeOut {
  summary: {
    weighted_expected_return_pct: number;
    portfolio_risk_note: string;
    market_context: string;
  };
  positions: Array<{
    ticker: string;
    company_name: string;
    sector: string;
    allocation_pct: number;
    units: number;
    entry_price: number;
    target_price: number;
    stop_loss: number;
    expected_return_pct: number;
    expected_exit_date: string;
    rationale: string;
    liquidity_note: string;
  }>;
  warnings: string[];
}

async function callModel(model: string, system: string, userMessage: string) {
  const client = new Anthropic({ apiKey: (await getAnthropicApiKey()) ?? null });
  const isFable = model.startsWith("claude-fable");
  const response = await client.messages.create({
    model,
    max_tokens: 20000,
    // Fable 5 thinking is always on — omit the param (explicit disabled 400s).
    ...(isFable ? {} : { thinking: { type: "adaptive" as const } }),
    output_config: {
      effort: "high",
      format: { type: "json_schema" as const, schema: PORTFOLIO_SCHEMA as unknown as Record<string, unknown> },
    },
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  if (response.stop_reason === "refusal") return { text: "", refused: true, model: response.model };
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { text, refused: false, model: response.model };
}

function round(n: number, dp = 2): number {
  return Number(n.toFixed(dp));
}

// The company list is the one call the build can't proceed without. The NGN
// Market upstream is intermittently slow (occasional 502s), so retry a few
// times — bypassing the cache on retries — before giving up.
async function fetchCompaniesWithRetry(attempts = 3): Promise<CompanyListRow[]> {
  for (let i = 0; i < attempts; i++) {
    const res = await ngxFetch<Paginated<CompanyListRow>>({
      path: "companies",
      query: "limit=300",
      skipCache: i > 0,
    });
    if (res.ok && res.data.data?.length) return res.data.data;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  return [];
}

export async function buildPortfolio(input: {
  amount: number;
  currency: "NGN" | "USD";
  horizon: Horizon;
}): Promise<BuildResult> {
  if (!(input.amount > 0)) {
    return { ok: false, errorCode: "NO_DATA", error: "Enter an amount greater than zero." };
  }
  if (!(await hasAnthropicCredentials())) {
    return {
      ok: false,
      errorCode: "NO_CREDENTIALS",
      error:
        "Claude API key not configured. An admin can add it under Admin → Settings (or set ANTHROPIC_API_KEY on the server).",
    };
  }

  const [rows, sectorsRes, snapRes, fxRes] = await Promise.all([
    fetchCompaniesWithRetry(),
    ngxFetch<SectorRotation>({ path: "market/sectors" }),
    ngxFetch<MarketSnapshot>({ path: "market/snapshot" }),
    ngxFetch<ForexCurrent>({ path: "forex/current" }),
  ]);
  if (!rows.length) {
    return {
      ok: false,
      errorCode: "NO_DATA",
      error:
        "The NGX market-data feed didn't respond (it's intermittently slow). Please try building again in a moment.",
    };
  }

  const usdRate = fxRes.ok ? fxRes.data.rates.find((r) => r.currency === "USD")?.rate ?? null : null;
  const budgetNgn = input.currency === "USD" ? (usdRate ? input.amount * usdRate : 0) : input.amount;
  if (input.currency === "USD" && !usdRate) {
    return { ok: false, errorCode: "NO_DATA", error: "USD/NGN rate unavailable — try again or use NGN." };
  }

  // Investable universe with liquidity signals, most liquid first.
  const bySymbol = new Map<string, CompanyListRow>();
  const universe = rows
    .filter((r) => r.symbol && r.price != null && r.price > 0)
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
    .slice(0, 200);
  for (const r of universe) bySymbol.set(r.symbol.toUpperCase(), r);

  const sectors = sectorsRes.ok && sectorsRes.data.sectors?.length ? sectorsRes.data.sectors : deriveSectors(rows);
  const today = new Date().toISOString().slice(0, 10);

  // Real fundamentals (P/E, P/B, dividend yield, EPS) for the most liquid names
  // — sourced from the NGN Market API per-company detail endpoint, never from
  // the model's memory. Fetched in small concurrent batches to be gentle on the
  // upstream; the TTL cache makes repeat builds cheap. Names without a detail
  // hit simply carry no fundamentals (Claude is told which are which).
  interface Fundamentals {
    pe_ratio: number | null;
    pb_ratio: number | null;
    dividend_yield_pct: number | null;
    ttm_eps: number | null;
    debt_to_equity: number | null;
    current_ratio: number | null;
  }
  const fundBySymbol = new Map<string, Fundamentals>();
  const detailTargets = universe.slice(0, 45); // liquid core by market cap
  for (let i = 0; i < detailTargets.length; i += 10) {
    const batch = detailTargets.slice(i, i + 10);
    const details = await Promise.all(
      batch.map((r) =>
        ngxFetch<CompanyDetail>({ path: `companies/${r.symbol}` })
          .then((res) => (res.ok ? res.data : null))
          .catch(() => null)
      )
    );
    for (const d of details) {
      if (!d) continue;
      const pe = d.ttm_eps && d.ttm_eps > 0 && d.current_price ? d.current_price / d.ttm_eps : null;
      fundBySymbol.set(d.symbol.toUpperCase(), {
        pe_ratio: pe != null ? round(pe) : null,
        pb_ratio: d.pb_ratio ?? null,
        dividend_yield_pct: d.dividend_yield ?? null,
        ttm_eps: d.ttm_eps ?? null,
        debt_to_equity: d.debt_to_equity ?? null,
        current_ratio: d.current_ratio ?? null,
      });
    }
  }

  const withMove = universe.filter((r) => r.price_change_percent != null);
  const topGainers = [...withMove]
    .sort((a, b) => (b.price_change_percent ?? 0) - (a.price_change_percent ?? 0))
    .slice(0, 10)
    .map((r) => ({ symbol: r.symbol, chg_1d_pct: r.price_change_percent, price: r.price }));
  const topLosers = [...withMove]
    .sort((a, b) => (a.price_change_percent ?? 0) - (b.price_change_percent ?? 0))
    .slice(0, 10)
    .map((r) => ({ symbol: r.symbol, chg_1d_pct: r.price_change_percent, price: r.price }));

  const payload = {
    today,
    fx_rate_ngn_per_usd: usdRate,
    market: snapRes.ok
      ? {
          asi: snapRes.data.asi,
          asi_change_pct: snapRes.data.asi_change_percent,
          asi_ytd_pct: snapRes.data.ytd_asi_change_percent,
          value_traded: snapRes.data.value_traded,
          breadth: snapRes.data.breadth,
        }
      : null,
    sector_context: sectors.slice(0, 12).map((s) => ({
      sector: s.sector,
      change_1d_pct: s.change_1d,
      change_7d_pct: s.change_7d,
      change_52w_pct: s.change_52w,
    })),
    top_gainers: topGainers,
    top_losers: topLosers,
    data_notes:
      "Fundamentals (pe_ratio, pb_ratio, dividend_yield_pct, ttm_eps, debt_to_equity, current_ratio) are the exchange's own figures from the NGN Market API and are provided for the most liquid names; where a name's `fundamentals` is null the data was not available for it, so lean on liquidity/momentum for that name and flag any material gap in warnings.",
    universe: universe.map((r) => ({
      ticker: r.symbol,
      name: r.name,
      sector: r.sector,
      price: r.price,
      day_change_pct: r.price_change_percent,
      chg_7d_pct: r.change_7d_percent,
      chg_ytd_pct: r.change_ytd_percent,
      chg_52w_pct: r.change_52w_percent,
      volume: r.volume,
      // daily traded value proxy (₦) = volume × price, for liquidity sizing
      traded_value_ngn: r.volume != null && r.price != null ? Math.round(r.volume * r.price) : null,
      market_cap: r.market_cap,
      high_52wk: r.high_52wk,
      low_52wk: r.low_52wk,
      fundamentals: fundBySymbol.get(r.symbol.toUpperCase()) ?? null,
    })),
  };

  const userMessage = `Capital: ${input.amount} ${input.currency}
Horizon: ${input.horizon}
Today's date: ${today}
FX rate (NGN/USD): ${usdRate ?? "n/a"}
Budget in NGN: ${Math.round(budgetNgn)}

NGX MARKET DATA:
\`\`\`json
${JSON.stringify(payload, null, 1)}
\`\`\`

Construct the portfolio.`;

  // Fable 5 primary; Opus 4.8 fallback on refusal / model error.
  let raw: { text: string; refused: boolean; model: string } | null = null;
  let lastError: unknown = null;
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      const r = await callModel(model, SYSTEM_PROMPT, userMessage);
      if (r.refused || !r.text) {
        lastError = new Error("refused/empty");
        continue;
      }
      raw = r;
      break;
    } catch (err) {
      lastError = err;
      if (err instanceof Anthropic.AuthenticationError) {
        return { ok: false, errorCode: "NO_CREDENTIALS", error: "The Claude API key was rejected. Check it under Admin → Settings." };
      }
      if (err instanceof Anthropic.RateLimitError) {
        return { ok: false, errorCode: "RATE_LIMITED", error: "Claude API rate limit reached — try again shortly." };
      }
    }
  }
  if (!raw) {
    const msg = lastError instanceof Anthropic.APIError ? `Claude API error (${lastError.status}).` : "Could not reach the Claude API.";
    return { ok: false, errorCode: "API_ERROR", error: msg };
  }

  let parsed: ClaudeOut;
  try {
    parsed = JSON.parse(raw.text);
  } catch {
    return { ok: false, errorCode: "API_ERROR", error: "The model returned an unparseable portfolio." };
  }

  // Reconcile against live prices: authoritative entry, exact units/naira; drop
  // hallucinated or unpriced tickers; recompute expected return from target.
  const positions: BuiltPosition[] = [];
  let invested = 0;
  for (const p of parsed.positions ?? []) {
    const row = bySymbol.get((p.ticker ?? "").toUpperCase());
    const price = row?.price;
    if (!row || price == null || price <= 0) continue;
    const alloc = Math.max(0, Number(p.allocation_pct) || 0);
    const targetAmt = (alloc / 100) * budgetNgn;
    const units = Math.floor(targetAmt / price);
    if (units <= 0) continue;
    const amount = units * price;
    invested += amount;
    const target = Number(p.target_price) > 0 ? round(Number(p.target_price)) : null;
    const stop = Number(p.stop_loss) > 0 ? round(Number(p.stop_loss)) : null;
    const expRet = target != null ? round(((target - price) / price) * 100) : (Number.isFinite(p.expected_return_pct) ? round(p.expected_return_pct) : null);
    positions.push({
      ticker: row.symbol.toUpperCase(),
      company_name: row.name || p.company_name || row.symbol,
      sector: row.sector || p.sector || "",
      allocation_ngn: round(amount),
      allocation_pct: round(alloc),
      units,
      entry_price: price,
      target_price: target,
      stop_loss: stop,
      expected_return_pct: expRet,
      expected_exit_date: String(p.expected_exit_date ?? ""),
      rationale: String(p.rationale ?? ""),
      liquidity_note: String(p.liquidity_note ?? ""),
    });
  }
  if (!positions.length) {
    return { ok: false, errorCode: "NO_DATA", error: "Could not size any positions for that budget — try a larger amount." };
  }

  // Recompute weighted expected return from the enriched positions.
  const weighted =
    invested > 0
      ? round(
          positions.reduce((a, p) => a + (p.expected_return_pct ?? 0) * (p.allocation_ngn / invested), 0)
        )
      : Number(parsed.summary?.weighted_expected_return_pct) || null;

  return {
    ok: true,
    portfolio: {
      horizon: input.horizon,
      currency: input.currency,
      amount_input: input.amount,
      budget_ngn: Math.round(budgetNgn),
      fx_rate_used: input.currency === "USD" ? usdRate : null,
      market_context: parsed.summary?.market_context ?? "",
      portfolio_risk_note: parsed.summary?.portfolio_risk_note ?? "",
      weighted_expected_return_pct: weighted,
      total_allocated_ngn: round(invested),
      cash_residual_ngn: round(Math.max(0, budgetNgn - invested)),
      positions: positions.sort((a, b) => b.allocation_ngn - a.allocation_ngn),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((w) => typeof w === "string") : [],
      model: raw.model,
    },
  };
}
