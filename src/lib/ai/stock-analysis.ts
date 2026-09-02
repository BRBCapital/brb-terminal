// Claude-generated per-stock analyses for the Forecasting section:
//  • dividend_forecast — narrative income outlook over the payout history
//  • sector_momentum   — where the stock's sector sits in the rotation
//  • trade_signal      — an internal BUY / HOLD / SELL decision-support note
//
// Every generator gathers real NGX figures server-side and passes them as JSON;
// Claude reasons over the numbers but never invents prices, ratios or
// indicators. All output is internal decision-support, explicitly not advice.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, hasAnthropicCredentials } from "./credentials";
import { ngxFetch } from "@/lib/ngx/client";
import { forecastDividends } from "@/lib/forecast/fundamental";
import { deriveSectors } from "@/lib/ngx/derived";
import { sma, rsi, maxDrawdown, annualizedVolatility } from "@/lib/indicators";
import { saveAnalysis, type AnalysisKind, type AiStockAnalysis } from "@/lib/db/ai-stock-analyses";
import type {
  CompanyDetail,
  CompanyDividends,
  CompanyChart,
  CompanyListRow,
  Paginated,
  SectorRotation,
  SectorRow,
} from "@/lib/ngx/types";

const MODEL = "claude-opus-4-8";

export interface AnalysisResult {
  ok: boolean;
  analysis?: AiStockAnalysis;
  error?: string;
  errorCode?: "NO_CREDENTIALS" | "RATE_LIMITED" | "API_ERROR" | "NO_DATA";
}

const COMPLIANCE_TAIL = `

Hard rules (dual-regulated FCA/SEC desk): use ONLY the figures in the provided JSON — never invent or recall prices, ratios, dividends or indicators from memory. Do not promise or imply returns; use conditional, risk-weighted language. This is internal analytical decision-support for a professional analyst, not investment advice, not a client recommendation, and requires the analyst's/Investment Committee's own judgement.`;

const PROMPTS: Record<AnalysisKind, string> = {
  dividend_forecast: `You are a senior income/equity analyst at BRB Capital writing a forward dividend outlook for one NGX stock, for internal use.

Work only from the provided dividend history, the model's projected DPS path, and the headline ratios. Output Markdown with exactly these sections:
## Payout History
2–4 sentences on the trend, regularity and any special/irregular payouts evident in the data.
## Sustainability
Read cover/affordability from the provided figures (EPS vs DPS, payout ratio if derivable, yield). State clearly where the data is insufficient.
## Forward Outlook
Discuss the model's projected DPS path as an ILLUSTRATIVE scenario (not a promise), noting the growth assumption and what would change it.
## Risks to the Dividend
3–4 bullets grounded in the data (earnings volatility, one-offs, macro).${COMPLIANCE_TAIL}`,

  sector_momentum: `You are a market strategist at BRB Capital assessing sector momentum for one NGX stock, for internal use.

Work only from the provided sector-performance rows (1d/7d/52w), the stock's own momentum, and its sector. Output Markdown with exactly these sections:
## Sector Standing
Where the stock's sector ranks in the current rotation (1d/7d/52w) versus other sectors, using the numbers.
## Relative Momentum
How the stock's own recent move compares to its sector and the tape.
## Implication for {SYMBOL}
Qualitative tailwind/headwind read — no price targets. Conditional language only.
## Watch-outs
2–3 bullets on what would flip the momentum read.${COMPLIANCE_TAIL}`,

  trade_signal: `You are a senior equity analyst at BRB Capital producing an internal BUY / HOLD / SELL decision-support signal on one NGX stock, for a professional analyst (not a client).

Work only from the provided quote, valuation ratios, momentum, 52-week position, computed technical summary, and sector context. Fill every field of the required JSON structure:
- stance: BUY, HOLD or SELL — your overall call.
- conviction: Low, Medium or High — how strongly the data supports the stance.
- horizon: the time horizon the call applies to (e.g. "6–12 months").
- thesis: one crisp sentence summarising why, citing the decisive figures.
- bull_case: 3–4 short evidence-based reasons to own it, each grounded in a provided number.
- bear_case: 3–4 short reasons to avoid or reduce, each grounded in a provided number.
- valuation_read: what the provided P/E, P/B, dividend yield and 52-week position imply (cheap/expensive vs its own range) — factual, no external comps invented.
- technical_read: interpret the provided RSI, moving-average positioning, trend, drawdown and volatility.
- catalysts: 2–4 things that could confirm the thesis.
- risks: 2–4 things that could break it.
- bottom_line: 2–3 sentences restating the stance and the single most important condition attached to it.
Keep every string tight and desk-level; no markdown formatting inside the fields.${COMPLIANCE_TAIL}`,
};

// Schema for the structured trade signal (Anthropic structured outputs).
const SIGNAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    stance: { type: "string", enum: ["BUY", "HOLD", "SELL"] },
    conviction: { type: "string", enum: ["Low", "Medium", "High"] },
    horizon: { type: "string" },
    thesis: { type: "string" },
    bull_case: { type: "array", items: { type: "string" } },
    bear_case: { type: "array", items: { type: "string" } },
    valuation_read: { type: "string" },
    technical_read: { type: "string" },
    catalysts: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    bottom_line: { type: "string" },
  },
  required: [
    "stance",
    "conviction",
    "horizon",
    "thesis",
    "bull_case",
    "bear_case",
    "valuation_read",
    "technical_read",
    "catalysts",
    "risks",
    "bottom_line",
  ],
} as const;

async function callClaude(
  system: string,
  userMessage: string,
  outputSchema?: Record<string, unknown>
): Promise<{ ok: true; text: string; model: string } | { ok: false; result: AnalysisResult }> {
  if (!(await hasAnthropicCredentials())) {
    return {
      ok: false,
      result: {
        ok: false,
        errorCode: "NO_CREDENTIALS",
        error:
          "Claude API key not configured. An admin can add it under Admin → Settings (or set ANTHROPIC_API_KEY on the server).",
      },
    };
  }
  const client = new Anthropic({ apiKey: (await getAnthropicApiKey()) ?? null });
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system,
      // Structured outputs constrain the response to the schema (used by the
      // trade signal, which is rendered as a bespoke card, not markdown).
      ...(outputSchema
        ? { output_config: { format: { type: "json_schema" as const, schema: outputSchema } } }
        : {}),
      messages: [{ role: "user", content: userMessage }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) return { ok: false, result: { ok: false, errorCode: "API_ERROR", error: "The model returned no text." } };
    return { ok: true, text, model: response.model };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, result: { ok: false, errorCode: "NO_CREDENTIALS", error: "The Claude API key was rejected. Check it under Admin → Settings." } };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, result: { ok: false, errorCode: "RATE_LIMITED", error: "Claude API rate limit reached — try again shortly." } };
    }
    if (err instanceof Anthropic.APIError) {
      return { ok: false, result: { ok: false, errorCode: "API_ERROR", error: `Claude API error (${err.status}): ${err.message}` } };
    }
    return { ok: false, result: { ok: false, errorCode: "API_ERROR", error: "Could not reach the Claude API." } };
  }
}

function lastOf(arr: Array<number | null>): number | null {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i];
  return null;
}
function round(n: number | null, dp = 2): number | null {
  return n == null ? null : Number(n.toFixed(dp));
}

// Sector performance rows — the official /market/sectors endpoint when the plan
// allows it, otherwise derived (equal-weighted) from the Starter-tier company
// list so the sector features work regardless of tier.
async function fetchSectors(): Promise<{ rows: SectorRow[] | ReturnType<typeof deriveSectors>; derived: boolean }> {
  const res = await ngxFetch<SectorRotation>({ path: "market/sectors" });
  if (res.ok && res.data.sectors?.length) return { rows: res.data.sectors, derived: false };
  const companies = await ngxFetch<Paginated<CompanyListRow>>({ path: "companies", query: "limit=300" });
  const rows = companies.ok ? deriveSectors(companies.data.data) : [];
  return { rows, derived: true };
}

// --- Data gathering per kind ------------------------------------------------

async function gatherDividend(symbol: string) {
  const [detailRes, divRes] = await Promise.all([
    ngxFetch<CompanyDetail>({ path: `companies/${symbol}` }),
    ngxFetch<CompanyDividends>({ path: `companies/${symbol}/dividends` }),
  ]);
  const detail = detailRes.ok ? detailRes.data : null;
  const dividends = divRes.ok ? divRes.data.dividends ?? [] : [];
  if (!detail && !dividends.length) return null;
  const fc = forecastDividends(dividends, detail?.current_price ?? 0, 5);
  return {
    symbol,
    name: detail?.name,
    current_price: detail?.current_price ?? null,
    ttm_eps: detail?.ttm_eps ?? null,
    ttm_dividends: detail?.ttm_dividends ?? null,
    dividend_yield_pct: detail?.dividend_yield ?? null,
    dividend_history: dividends.slice(-16),
    model_projection: {
      trailing_annual_dps: round(fc.recentAnnualDps),
      estimated_growth_pct: round(fc.estimatedGrowthPct),
      projected_dps: fc.projections.map((p) => ({ year: p.year, dps: round(p.dps), yield_on_price_pct: round(p.yieldOnCostPct) })),
      note: "Growth clamped to contain one-off spikes; assumes payout policy persists.",
    },
  };
}

async function gatherSector(symbol: string) {
  const [detailRes, sectors] = await Promise.all([
    ngxFetch<CompanyDetail>({ path: `companies/${symbol}` }),
    fetchSectors(),
  ]);
  const detail = detailRes.ok ? detailRes.data : null;
  if (!detail) return null;
  return {
    symbol,
    name: detail.name,
    sector: detail.sector,
    stock_momentum: {
      change_1d_pct: detail.price_change_percent ?? null,
      change_ytd_pct: (detail as unknown as { change_ytd_percent?: number }).change_ytd_percent ?? null,
    },
    sector_data_basis: sectors.derived ? "derived (equal-weighted from constituents)" : "official",
    sector_rotation: sectors.rows.map((s) => ({
      sector: s.sector,
      change_1d_pct: round(s.change_1d),
      change_7d_pct: round(s.change_7d),
      change_52w_pct: round(s.change_52w),
    })),
  };
}

async function gatherSignal(symbol: string) {
  const [detailRes, chartRes, sectors] = await Promise.all([
    ngxFetch<CompanyDetail>({ path: `companies/${symbol}` }),
    ngxFetch<CompanyChart>({ path: `companies/${symbol}/chart`, query: "period=1Y" }),
    fetchSectors(),
  ]);
  const detail = detailRes.ok ? detailRes.data : null;
  if (!detail) return null;
  const points = chartRes.ok ? chartRes.data.data ?? [] : [];
  const closes = points.map((p) => p.close ?? p.price);
  const price = detail.current_price ?? lastOf(closes);

  // Computed technicals (so Claude never derives indicators from raw series).
  const sma20 = lastOf(sma(closes, 20));
  const sma50 = lastOf(sma(closes, 50));
  const sma200 = lastOf(sma(closes, 200));
  const rsi14 = lastOf(rsi(closes, 14));
  const validCloses = closes.filter((c): c is number => c != null);
  const oneMonthAgo = validCloses.length > 21 ? validCloses[validCloses.length - 22] : validCloses[0];
  const threeMonthAgo = validCloses.length > 63 ? validCloses[validCloses.length - 64] : validCloses[0];
  const pctFrom = (base: number | undefined) =>
    price != null && base && base > 0 ? round(((price - base) / base) * 100) : null;
  const rangePos =
    price != null && detail.high_52wk != null && detail.low_52wk != null && detail.high_52wk > detail.low_52wk
      ? round(((price - detail.low_52wk) / (detail.high_52wk - detail.low_52wk)) * 100)
      : null;

  const mySector = sectors.rows.find((s) => s.sector === detail.sector);

  return {
    symbol,
    name: detail.name,
    sector: detail.sector,
    quote: {
      current_price: round(price),
      day_change_pct: detail.price_change_percent ?? null,
      high_52wk: detail.high_52wk ?? null,
      low_52wk: detail.low_52wk ?? null,
      position_in_52wk_range_pct: rangePos,
    },
    valuation: {
      pe_ratio: detail.ttm_eps && detail.current_price ? round(detail.current_price / detail.ttm_eps) : null,
      pb_ratio: detail.pb_ratio ?? null,
      dividend_yield_pct: detail.dividend_yield ?? null,
      debt_to_equity: detail.debt_to_equity ?? null,
      current_ratio: detail.current_ratio ?? null,
      ttm_eps: detail.ttm_eps ?? null,
    },
    technicals: {
      sma20: round(sma20),
      sma50: round(sma50),
      sma200: round(sma200),
      price_vs_sma50_pct: sma50 ? pctFrom(sma50) : null,
      rsi14: round(rsi14),
      return_1m_pct: pctFrom(oneMonthAgo),
      return_3m_pct: pctFrom(threeMonthAgo),
      max_drawdown_1y_pct: round(maxDrawdown(closes)),
      annualized_vol_pct: round(annualizedVolatility(closes)),
      history_points: validCloses.length,
    },
    sector_context: mySector
      ? { change_1d_pct: round(mySector.change_1d), change_7d_pct: round(mySector.change_7d), change_52w_pct: round(mySector.change_52w) }
      : null,
    prices_as_of: detail.last_updated ?? null,
  };
}

// --- Public entry point -----------------------------------------------------

export async function generateStockAnalysis(
  actor: string,
  symbol: string,
  kind: AnalysisKind
): Promise<AnalysisResult> {
  const sym = symbol.toUpperCase();
  let payload: unknown;
  if (kind === "dividend_forecast") payload = await gatherDividend(sym);
  else if (kind === "sector_momentum") payload = await gatherSector(sym);
  else payload = await gatherSignal(sym);

  if (!payload) {
    return { ok: false, errorCode: "NO_DATA", error: `Not enough data to analyse ${sym} right now.` };
  }

  const system = PROMPTS[kind].replace(/\{SYMBOL\}/g, sym);
  const userMessage = `Here is the data for ${sym} as JSON. Produce the analysis.

\`\`\`json
${JSON.stringify(payload, null, 1)}
\`\`\``;

  const call = await callClaude(
    system,
    userMessage,
    kind === "trade_signal" ? (SIGNAL_SCHEMA as unknown as Record<string, unknown>) : undefined
  );
  if (!call.ok) return call.result;

  const analysis = await saveAnalysis({
    symbol: sym,
    kind,
    content: call.text,
    model: call.model,
    generatedBy: actor,
  });
  return { ok: true, analysis };
}
