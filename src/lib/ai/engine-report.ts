// Fable-written performance review of the Alternative Strategies Engine — a
// formal monthly or yearly analysis of the SIMULATED quant book, grounded
// strictly in the provided performance data. Streamed (NDJSON) like the
// portfolio analysis report; Opus 4.8 fallback.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, hasAnthropicCredentials } from "./credentials";

const PRIMARY_MODEL = "claude-fable-5";
const FALLBACK_MODEL = "claude-opus-4-8";

type ErrorCode = "NO_CREDENTIALS" | "RATE_LIMITED" | "API_ERROR" | "NO_DATA";

export type EngineReportEvent =
  | { type: "delta"; text: string }
  | { type: "done"; model: string }
  | { type: "error"; error: string; errorCode: ErrorCode };

export interface EnginePerfPayload {
  scope: "month" | "year";
  label: string; // "August 2026" or "2026"
  capital: number;
  totals: unknown; // overview.totals
  per_cadence: unknown; // overview.per_cadence
  monthly_pnl: unknown; // overview.monthly_pnl
  top_trades: unknown; // most material trades by |P&L|
  max_drawdown: number;
  sharpe: number | null;
  context?: string;
}

const SYSTEM_PROMPT = `You are the Head of Quantitative Strategy at BRB Capital, a Nigerian brokerage, writing a formal internal performance review of the firm's automated "Alternative Strategies Engine" for the Investment Committee. The engine is a SIMULATED paper-trading quant system that trades NGX equities across three cadences — intraday, weekly and monthly — with AI-selected candidates sized by transparent, rules-based risk controls (single-name cap, liquidity/ADV cap, volatility scaling, an FX overlay and a drawdown halt).

ABSOLUTE DATA RULES (a dual-regulated desk — FCA UK / SEC Nigeria):
- Use ONLY the figures in the provided JSON (totals, per-cadence stats, monthly P&L, the trade list). NEVER invent prices, returns or trades. If something isn't in the data, say so.
- Every naira/percentage figure you cite must come from or be simple arithmetic on the provided numbers.
- This is SIMULATED / illustrative performance of a paper-trading engine — never describe it as realised client returns. Do NOT promise or forecast future returns; frame outlook as conditional and risk-aware.
- Not investment advice, not a recommendation, not an offer.

OUTPUT — a clean Markdown report with EXACTLY these sections and headings:
## Executive Summary
3-4 sentences: the period's headline result (net P&L, return on capital, win rate) and the single most important takeaway. Cite numbers.
## Performance Overview
A short paragraph on realised vs unrealised P&L, capital deployed vs idle, and win rate — with the figures.
## Cadence Attribution
Which cadence(s) drove the result. A compact markdown table: | Cadence | Trades | Win rate | Realised | Unrealised |. One row per active cadence. Then one line on what it implies.
## Risk & Drawdown
2-3 bullets: max drawdown, concentration/liquidity behaviour, and whether the rules-based risk controls appear to be binding, using the data.
## Notable Trades
2-4 bullets on the most material positions (largest contributors/detractors) from the trade list, with their P&L.
## Process Notes & Outlook
3-4 sentences: what the data suggests about the engine's process for the period ahead, framed as conditional and governance-oriented (this is a paused-by-default, human-governed engine).

Tone: senior quant PM — crisp, quantitative, desk-level. No preamble. Do not add a compliance section (the template adds one). Aim for 500-800 words.`;

async function* runModel(
  model: string,
  userMessage: string
): AsyncGenerator<EngineReportEvent, { anyText: boolean; refused: boolean } | void> {
  const client = new Anthropic({ apiKey: (await getAnthropicApiKey()) ?? null });
  const isFable = model.startsWith("claude-fable");
  let anyText = false;
  let refused = false;
  const stream = client.messages.stream({
    model,
    max_tokens: 12000,
    ...(isFable ? {} : { thinking: { type: "adaptive" as const } }),
    output_config: { effort: "high" as const },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      anyText = true;
      yield { type: "delta", text: event.delta.text };
    }
  }
  const msg = await stream.finalMessage();
  refused = msg.stop_reason === "refusal";
  return { anyText, refused };
}

function errorFromException(err: unknown): { error: string; errorCode: ErrorCode } {
  if (err instanceof Anthropic.AuthenticationError)
    return { errorCode: "NO_CREDENTIALS", error: "The Claude API key was rejected (Admin → Settings)." };
  if (err instanceof Anthropic.RateLimitError)
    return { errorCode: "RATE_LIMITED", error: "Rate limit reached — try again shortly." };
  if (err instanceof Anthropic.APIError)
    return { errorCode: "API_ERROR", error: `Claude API error (${err.status}).` };
  return { errorCode: "API_ERROR", error: "Could not reach the Claude API." };
}

export async function* streamEngineReport(
  payload: EnginePerfPayload
): AsyncGenerator<EngineReportEvent> {
  if (!(await hasAnthropicCredentials())) {
    yield { type: "error", error: "Claude API key not configured (Admin → Settings).", errorCode: "NO_CREDENTIALS" };
    return;
  }

  const userMessage = `Write the ${payload.scope === "year" ? "annual" : "monthly"} performance review for the Alternative Strategies Engine covering ${payload.label}.

\`\`\`json
${JSON.stringify(payload)}
\`\`\``;

  let model = PRIMARY_MODEL;
  for (let attempt = 0; attempt < 2; attempt++) {
    let result: { anyText: boolean; refused: boolean } | void;
    try {
      result = yield* runModel(model, userMessage);
    } catch (err) {
      yield { type: "error", ...errorFromException(err) };
      return;
    }
    const anyText = result?.anyText ?? false;
    const refused = result?.refused ?? false;
    if ((refused || !anyText) && attempt === 0) {
      model = FALLBACK_MODEL;
      continue;
    }
    if (!anyText) {
      yield { type: "error", error: "The model returned no report — try again.", errorCode: "API_ERROR" };
      return;
    }
    yield { type: "done", model };
    return;
  }
}
