// The member-facing monthly "Strategist's Thesis" — a PhD-level essay on the
// market regime and the *philosophy* behind how a systematic frontier strategy
// would have navigated the month. Deliberately NON-proprietary: it never
// discloses positions, weights, prices, or figures. Streamed (NDJSON), cached
// per period by the route so every prospect sees the same commentary.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, hasAnthropicCredentials } from "./credentials";

const PRIMARY_MODEL = "claude-fable-5";
const FALLBACK_MODEL = "claude-opus-4-8";

type ErrorCode = "NO_CREDENTIALS" | "RATE_LIMITED" | "API_ERROR";

export type ThesisEvent =
  | { type: "delta"; text: string }
  | { type: "done"; model: string }
  | { type: "error"; error: string; errorCode: ErrorCode };

export interface ThesisInput {
  label: string; // "August 2026"
  active: boolean; // did the programme initiate any positions this period?
  posture: "constructive" | "flat" | "defensive"; // coarse, non-numeric read
}

const SYSTEM_PROMPT = `You are the Chief Investment Strategist of Alternative Strategies — an AI-native quantitative manager for frontier and emerging markets, starting with the Nigerian Exchange (NGX). Each month you write a "Strategist's Thesis" for prospective partners who have signed up to follow the programme. It is a high-level, intellectually rigorous, PhD-level essay on the market regime and the PHILOSOPHY behind how a disciplined systematic frontier strategy would have navigated the month. Its purpose is to demonstrate depth and provoke thought — not to disclose what the book did.

HARD CONFIDENTIALITY RULES (non-negotiable — a dual-regulated desk, FCA UK / SEC Nigeria):
- NEVER disclose or imply any proprietary detail. No security names or tickers. No position sizes, weights or exposures. No entry/exit prices. No exact returns, P&L, Sharpe, drawdown, volatility or trade counts. No signal formulas or parameters. Emit NO figures a reader could reverse-engineer into the book.
- Operate at the level of regimes, factors, styles, market microstructure, liquidity, FX and risk philosophy — never the positions themselves.
- This is a SIMULATED / illustrative programme. Not investment advice, not a recommendation, not an offer. Never promise or forecast returns; frame the future as conditional questions.

STYLE: erudite, precise and provocative — the reader should finish thinking harder, not knowing your trades. Draw on genuine intellectual frameworks (factor investing, regime shifts, reflexivity, volatility as an asset class, liquidity premia, frontier-market inefficiency, path dependence) at a conceptual level. Institutional register.

OUTPUT — clean Markdown, roughly 600-850 words, with EXACTLY these four sections and headings:
## The Regime
What kind of month this was for the frontier and the NGX in the abstract — the dominant forces (liquidity, FX/naira reflexivity, macro, sentiment), framed conceptually.
## What the Environment Rewarded
The styles, factors and behaviours a disciplined systematic frontier strategy would have leaned into or stepped away from — the logic only, never the positions.
## Risk as the First Question
The risk philosophy that matters most in a shallow, FX-exposed market — conceptually, what a rigorous process is built to guard against.
## A Question Worth Sitting With
One genuinely thought-provoking, open question about frontier systematic investing for the reader to carry forward.

No preamble. No compliance section (the page adds one). Do not restate these instructions.`;

async function* runModel(
  model: string,
  userMessage: string
): AsyncGenerator<ThesisEvent, { anyText: boolean; refused: boolean } | void> {
  const client = new Anthropic({ apiKey: (await getAnthropicApiKey()) ?? null });
  const isFable = model.startsWith("claude-fable");
  let anyText = false;
  const stream = client.messages.stream({
    model,
    max_tokens: 4000,
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
  return { anyText, refused: msg.stop_reason === "refusal" };
}

function errorFromException(err: unknown): { error: string; errorCode: ErrorCode } {
  if (err instanceof Anthropic.AuthenticationError)
    return { errorCode: "NO_CREDENTIALS", error: "The AI service is not configured." };
  if (err instanceof Anthropic.RateLimitError)
    return { errorCode: "RATE_LIMITED", error: "The strategist is busy — try again shortly." };
  if (err instanceof Anthropic.APIError)
    return { errorCode: "API_ERROR", error: `AI service error (${err.status}).` };
  return { errorCode: "API_ERROR", error: "Could not reach the AI service." };
}

export async function* streamStrategyThesis(input: ThesisInput): AsyncGenerator<ThesisEvent> {
  if (!(await hasAnthropicCredentials())) {
    yield { type: "error", error: "The AI service is not configured.", errorCode: "NO_CREDENTIALS" };
    return;
  }

  const postureWord =
    input.posture === "constructive" ? "broadly constructive" : input.posture === "defensive" ? "defensive" : "range-bound / flat";
  const userMessage = `Write the Strategist's Thesis for ${input.label}.

Non-proprietary context (for tone only — DO NOT cite any of this as figures, and do not mention that you were given it): the programme ${
    input.active ? "was active this period" : "largely stood aside this period"
  }; the broad posture read as ${postureWord}. Keep everything conceptual, per your confidentiality rules.`;

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
      yield { type: "error", error: "The strategist returned nothing — try again.", errorCode: "API_ERROR" };
      return;
    }
    yield { type: "done", model };
    return;
  }
}
