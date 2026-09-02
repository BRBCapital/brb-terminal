// AI portfolio review — Claude acts as a senior NGX portfolio strategist and
// generates optimisation IDEAS (trim/remove, add, sizing) grounded strictly in
// the portfolio's own figures plus the live NGX opportunity set. This is an
// internal decision-support tool for a professional analyst: every figure comes
// from provided data (never invented), and output is explicitly not advice.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, hasAnthropicCredentials } from "./credentials";
import { ngxFetch } from "@/lib/ngx/client";
import { deriveSectors } from "@/lib/ngx/derived";
import { saveReview, type AiPortfolioReview } from "@/lib/db/ai-reviews";
import type { CompanyListRow, Paginated } from "@/lib/ngx/types";

const MODEL = "claude-opus-4-8";

// --- Shapes the client sends (the numbers the analyst already sees) ----------

export interface ReviewPosition {
  symbol: string;
  name: string;
  sector: string;
  units: number;
  avgCost: number | null;
  currentPrice: number | null;
  marketValue: number | null;
  weightPct: number | null;
  unrealisedPct: number | null;
  dayChangePct: number | null;
}

export interface ReviewSnapshot {
  name: string;
  mandateNotes: string;
  benchmark: string;
  baseCurrency: string;
  totals: {
    marketValue: number;
    costBasis: number;
    unrealisedPnl: number;
    unrealisedPct: number | null;
    realisedPnl: number;
    dividends: number;
  };
  positions: ReviewPosition[];
  sectorAllocation: { sector: string; pct: number }[];
  lastUpdated: string | null;
}

export interface ReviewResult {
  ok: boolean;
  review?: AiPortfolioReview;
  error?: string;
  errorCode?: "NO_CREDENTIALS" | "RATE_LIMITED" | "API_ERROR" | "NO_DATA";
}

const SYSTEM_PROMPT = `You are the Head of Portfolio Strategy at BRB Capital, a Nigerian brokerage, producing an internal portfolio-optimisation review for one of your equity analysts. Your reader is a finance professional, not a retail client. Your job is to pressure-test the current NGX equity portfolio and surface concrete, actionable IDEAS the analyst can evaluate — what to trim or exit, what to add, and how to size trades against the cash available to deploy.

ABSOLUTE DATA RULES (a dual-regulated desk — FCA UK / SEC Nigeria):
- Use ONLY the figures in the provided JSON (portfolio positions, totals, cash available, and the NGX opportunity-set universe). NEVER invent or recall prices, market caps, fundamentals, or percentages from memory. If a data point you'd want is absent, say so and reason qualitatively.
- Every naira figure you cite for sizing must be arithmetic on the provided numbers (available cash, position market values, estimated sale proceeds at the given current price). Show the arithmetic briefly.
- Do NOT promise, forecast, or imply returns. No "will rise/outperform/is undervalued and will re-rate". Frame everything as conditional, risk-weighted rationale ("screens cheap on the provided P/E", "concentration risk if...", "momentum has been negative YTD per the data").
- Recommendations are IDEAS for the analyst's judgement, subject to PM/Investment-Committee approval and compliance review. This is not investment advice and not an order.

SIZING DISCIPLINE:
- The deployable amount = cash available to trade + estimated net proceeds from any trims/exits you propose (proceeds ≈ units × current price for full exits, or the trimmed portion). State the running cash budget so the adds never exceed it.
- Respect prudent single-name sizing: flag any single position that would exceed ~15% of portfolio market value, and prefer sizing new adds to ~3–8% unless the mandate notes say otherwise.
- Prefer improving diversification where one sector dominates; justify with the provided sector allocation.

OUTPUT — Markdown with exactly these sections:
## Portfolio Diagnosis
4–6 sentences: concentration, sector tilt, momentum/P&L posture, cash drag, alignment to the stated mandate/benchmark. Cite the numbers.
## Ideas to Trim or Exit
A markdown table: | Symbol | Current weight | Rationale | Suggested action |. Only names in the current portfolio. Action = "Exit", "Trim to X%", or "Hold". If nothing warrants trimming, say so and explain.
## Ideas to Add
A markdown table: | Symbol | Sector | Rationale (from data) | Suggested ₦ | Resulting weight |. Only names from the provided opportunity-set universe that are NOT already held. Size against the running cash budget.
## Illustrative Reallocation Plan
A short numbered walk-through: starting cash → proceeds from exits/trims → total deployable → adds → residual cash. Keep the arithmetic explicit and internally consistent.
## Risks & Watch-outs
3–5 bullets: liquidity, single-stock/sector concentration, data staleness, execution/market-impact, mandate drift.
## Compliance Note
One short paragraph reminding the reader this is internal idea-generation for analyst review — not investment advice, not a recommendation to any client, illustrative only, requires PM/IC approval, and past performance does not indicate future results.

Tone: crisp, senior, desk-level. No preamble, no restating the instructions. Aim for 550–800 words.`;

// Build a compact NGX opportunity set (names not held), bounded for token cost.
function buildUniverse(rows: CompanyListRow[], heldSymbols: Set<string>) {
  const candidates = rows
    .filter((r) => r.symbol && !heldSymbols.has(r.symbol.toUpperCase()) && r.price != null)
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
    .slice(0, 140)
    .map((r) => ({
      symbol: r.symbol,
      sector: r.sector,
      price: r.price,
      chg_1d_pct: r.price_change_percent,
      chg_ytd_pct: r.change_ytd_percent,
      market_cap: r.market_cap,
    }));
  return candidates;
}

export async function generateReview(
  actor: string,
  input: { portfolioId: string; cashAvailable: number; snapshot: ReviewSnapshot }
): Promise<ReviewResult> {
  const { snapshot, cashAvailable } = input;
  // Defend against malformed/older client bodies: positions may be missing, and
  // individual rows may carry a null symbol.
  const positions = (snapshot.positions ?? []).filter((p) => p && p.symbol);
  snapshot.positions = positions;
  if (!positions.length && cashAvailable <= 0) {
    return {
      ok: false,
      errorCode: "NO_DATA",
      error: "This portfolio has no valued positions and no cash to deploy — nothing to review yet.",
    };
  }

  if (!(await hasAnthropicCredentials())) {
    return {
      ok: false,
      errorCode: "NO_CREDENTIALS",
      error:
        "Claude API key not configured. An admin can add it under Admin → Settings (or set ANTHROPIC_API_KEY on the server).",
    };
  }

  // Live opportunity set from the Starter-tier companies list (real prices/YTD).
  const held = new Set(snapshot.positions.map((p) => p.symbol.toUpperCase()));
  const companiesRes = await ngxFetch<Paginated<CompanyListRow>>({ path: "companies", query: "limit=300" });
  const rows = companiesRes.ok ? companiesRes.data.data : [];
  const universe = buildUniverse(rows, held);
  const sectorContext = rows.length ? deriveSectors(rows).slice(0, 12) : [];

  const payload = {
    portfolio: {
      name: snapshot.name,
      mandate_notes: snapshot.mandateNotes || "(none provided)",
      benchmark: snapshot.benchmark,
      base_currency: snapshot.baseCurrency,
      totals: snapshot.totals,
      sector_allocation: snapshot.sectorAllocation,
      positions: snapshot.positions,
    },
    cash_available_to_trade: Math.max(0, Math.round(cashAvailable)),
    ngx_opportunity_set: universe,
    ngx_sector_context_equal_weighted: sectorContext,
    prices_as_of: snapshot.lastUpdated,
    data_notes:
      "All prices/percentages are from the NGN Market API (delayed up to 20 min during NGX hours). Opportunity set is the 140 largest listed names not already held. Sector context is equal-weighted from constituents.",
  };

  const client = new Anthropic({ apiKey: (await getAnthropicApiKey()) ?? null });

  const userMessage = `Review this NGX equity portfolio and produce the optimisation ideas. Cash available to trade: ₦${payload.cash_available_to_trade.toLocaleString()}.

\`\`\`json
${JSON.stringify(payload, null, 1)}
\`\`\``;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 12000, // headroom for adaptive thinking; review is ~700 words
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) {
      return { ok: false, errorCode: "API_ERROR", error: "The model returned no text." };
    }

    const review = await saveReview({
      portfolioId: input.portfolioId,
      cashAvailable: payload.cash_available_to_trade,
      content: text,
      model: response.model,
      generatedBy: actor,
    });
    return { ok: true, review };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return {
        ok: false,
        errorCode: "NO_CREDENTIALS",
        error: "The Claude API key was rejected. Check it under Admin → Settings.",
      };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, errorCode: "RATE_LIMITED", error: "Claude API rate limit reached — try again shortly." };
    }
    if (err instanceof Anthropic.APIError) {
      return { ok: false, errorCode: "API_ERROR", error: `Claude API error (${err.status}): ${err.message}` };
    }
    return { ok: false, errorCode: "API_ERROR", error: "Could not reach the Claude API." };
  }
}
