// Portfolio "Ask Fable" chat — a conversational analyst assistant scoped to one
// portfolio. Fable 5 reasons over the portfolio's own figures plus the live NGX
// opportunity set; it never invents market data. Multi-turn, provenance-bound,
// explicitly not investment advice. Falls back to Opus 4.8 on refusal / error.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, hasAnthropicCredentials } from "./credentials";
import { ngxFetch } from "@/lib/ngx/client";
import { deriveSectors } from "@/lib/ngx/derived";
import type {
  CompanyDetail,
  CompanyDividends,
  CompanyListRow,
  Paginated,
} from "@/lib/ngx/types";
import type { ReviewSnapshot } from "./portfolio-review";

const PRIMARY_MODEL = "claude-fable-5";
const FALLBACK_MODEL = "claude-opus-4-8";
const MAX_TURNS = 16; // cap history for token cost
const MAX_TOOL_TURNS = 5; // cap the tool-use round-trips per question

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type ErrorCode = "NO_CREDENTIALS" | "RATE_LIMITED" | "API_ERROR" | "NO_DATA";

// Events streamed back to the browser as newline-delimited JSON (NDJSON).
export type ChatEvent =
  | { type: "delta"; text: string } // a chunk of the assistant's reply
  | { type: "tool"; symbol: string } // Fable is pulling live fundamentals for a name
  | { type: "done"; model: string } // turn complete
  | { type: "error"; error: string; errorCode: ErrorCode };

const SYSTEM_PROMPT = `You are "Fable", the desk analyst assistant at BRB Capital, a Nigerian brokerage, embedded inside one equity analyst's portfolio-management screen. You hold a conversation with a finance professional (not a retail client) about the specific NGX portfolio described in the DATA block below.

You can help the analyst:
- analyse the portfolio (concentration, sector tilt, momentum, P&L, cash, mandate/benchmark alignment);
- analyse individual holdings or names from the provided NGX opportunity set;
- suggest ideas to trim, exit, add or rebalance, sized against any cash mentioned;
- explain metrics and reason through "what-if" questions.

TOOL — get_stock_fundamentals(symbol):
- The DATA block gives you prices and light metrics. For DEEPER fundamentals on a SPECIFIC NGX name (TTM EPS, computed P/E, P/B, dividend yield, debt-to-equity, current ratio, 52-week range, recent dividend history), call get_stock_fundamentals with its ticker. It fetches those figures LIVE from the NGN Market API.
- Call it whenever the analyst asks about a particular stock's valuation, ratios, dividends or 52-week levels and the DATA block does not already contain them — for holdings AND for names in the opportunity set. You may call it for several names in one turn.
- Treat whatever the tool returns as authoritative live market fact (same provenance as the DATA block). If the tool reports no data for a symbol, tell the analyst plainly rather than guessing.

ABSOLUTE DATA RULES (a dual-regulated desk — FCA UK / SEC Nigeria):
- Use ONLY the figures in the DATA block or returned by the get_stock_fundamentals tool. NEVER invent or recall prices, market caps, fundamentals or percentages from memory. If a figure you'd want is absent and the tool can't supply it, say so plainly and reason qualitatively.
- Any naira figure you cite for sizing must be arithmetic on the provided numbers (position market values, sale proceeds ~ units x current price, stated cash). Show the arithmetic briefly.
- Do NOT promise, forecast, or imply returns ("will rise / outperform / is undervalued and will re-rate"). Frame everything as conditional, risk-weighted rationale grounded in the data.
- Everything you say is an IDEA for the analyst's judgement, subject to PM/Investment-Committee approval and compliance review — not investment advice, not a recommendation to any client, not an order.

STYLE:
- Conversational and concise — answer the actual question first, then brief supporting reasoning. Use short markdown (bold, small tables, bullet lists) where it helps; avoid long essays unless asked.
- Prices are delayed up to 20 minutes during NGX hours. When you cite portfolio numbers, they are "as of" the provided timestamp.
- No preamble like "Certainly!" — just answer as a senior desk colleague.`;

// Compact NGX opportunity set (names not held), bounded for token cost.
function buildUniverse(rows: CompanyListRow[], held: Set<string>) {
  return rows
    .filter((r) => r.symbol && !held.has(r.symbol.toUpperCase()) && r.price != null)
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
    .slice(0, 120)
    .map((r) => ({
      symbol: r.symbol,
      sector: r.sector,
      price: r.price,
      chg_1d_pct: r.price_change_percent,
      chg_ytd_pct: r.change_ytd_percent,
      market_cap: r.market_cap,
    }));
}

// On-demand deeper fundamentals for ONE ticker — the tool Fable can call mid-chat.
const FUNDAMENTALS_TOOL: Anthropic.Tool = {
  name: "get_stock_fundamentals",
  description:
    "Fetch deeper LIVE fundamentals for a single NGX-listed stock by its ticker symbol (e.g. GTCO, DANGCEM, MTNN) from the NGN Market API. Use when the analyst asks about a specific name's valuation, ratios, dividend history or 52-week range and those figures are not already in the DATA block. Returns current price, market cap, TTM EPS, a server-computed P/E, P/B, dividend yield, TTM dividends, debt-to-equity, current ratio, the 52-week high/low, and recent dividend history. Call it only for a real NGX ticker.",
  input_schema: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "NGX ticker symbol, uppercase — e.g. GTCO, ZENITHBANK, DANGCEM.",
      },
    },
    required: ["symbol"],
  },
};

// Execute the tool: pull company detail (+ recent dividends) and normalise it.
// Provenance rule holds — every figure is from the NGN Market API, and the one
// derived value (P/E) is recomputed here, never taken from the model.
async function getStockFundamentals(symbolRaw: string) {
  const symbol = String(symbolRaw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "");
  if (!symbol) return { error: "No ticker symbol provided." };

  const detailRes = await ngxFetch<CompanyDetail>({ path: `companies/${symbol}` });
  if (!detailRes.ok) {
    return {
      symbol,
      error: `No live fundamentals for ${symbol} (${detailRes.error.code}). It may not be an NGX-listed ticker.`,
    };
  }
  const d = detailRes.data;
  const pe =
    d.current_price != null && d.ttm_eps != null && d.ttm_eps !== 0
      ? Math.round((d.current_price / d.ttm_eps) * 100) / 100
      : null;

  // Recent dividend history is best-effort — a missing feed shouldn't fail the tool.
  const divRes = await ngxFetch<CompanyDividends>({ path: `companies/${symbol}/dividends` });
  const recentDividends = divRes.ok ? (divRes.data.dividends ?? []).slice(0, 6) : [];

  return {
    symbol: d.symbol,
    name: d.name,
    sector: d.sector,
    sub_sector: d.sub_sector,
    current_price: d.current_price,
    prev_close: d.prev_close,
    day_high: d.day_high,
    day_low: d.day_low,
    price_change_percent: d.price_change_percent,
    volume: d.volume,
    market_cap: d.market_cap,
    shares_outstanding: d.shares_outstanding,
    ttm_eps: d.ttm_eps,
    pe_ratio_computed: pe,
    pb_ratio: d.pb_ratio,
    dividend_yield: d.dividend_yield,
    ttm_dividends: d.ttm_dividends,
    debt_to_equity: d.debt_to_equity,
    current_ratio: d.current_ratio,
    high_52wk: d.high_52wk,
    high_52wk_date: d.high_52wk_date,
    low_52wk: d.low_52wk,
    low_52wk_date: d.low_52wk_date,
    latest_equity: d.latest_equity,
    recent_dividends: recentDividends,
    as_of: d.last_updated,
    note: "All figures from the NGN Market API (delayed up to 20 min during NGX hours). pe_ratio_computed = current_price / ttm_eps, computed server-side.",
  };
}

// Shared prep: validate the request, check credentials, gather the live NGX
// context, and assemble the grounded system prompt + trimmed history. Reused by
// both the streaming and non-streaming entry points.
type PreparedContext =
  | { ok: false; errorCode: ErrorCode; error: string }
  | { ok: true; system: string; history: ChatMessage[] };

async function prepareContext(input: {
  snapshot: ReviewSnapshot;
  messages: ChatMessage[];
}): Promise<PreparedContext> {
  const positions = (input.snapshot.positions ?? []).filter((p) => p && p.symbol);
  const history = (input.messages ?? [])
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (!history.length || history[history.length - 1].role !== "user") {
    return { ok: false, errorCode: "NO_DATA", error: "No question to answer." };
  }
  if (!(await hasAnthropicCredentials())) {
    return {
      ok: false,
      errorCode: "NO_CREDENTIALS",
      error: "Claude API key not configured. An admin can add it under Admin → Settings.",
    };
  }

  // Live opportunity set + sector context (best-effort; the chat still works on
  // the portfolio alone if the feed is briefly unavailable).
  const held = new Set(positions.map((p) => p.symbol.toUpperCase()));
  const companiesRes = await ngxFetch<Paginated<CompanyListRow>>({ path: "companies", query: "limit=300" });
  const rows = companiesRes.ok ? companiesRes.data.data : [];

  const payload = {
    portfolio: {
      name: input.snapshot.name,
      mandate_notes: input.snapshot.mandateNotes || "(none provided)",
      benchmark: input.snapshot.benchmark,
      base_currency: input.snapshot.baseCurrency,
      totals: input.snapshot.totals,
      sector_allocation: input.snapshot.sectorAllocation,
      positions,
    },
    ngx_opportunity_set: buildUniverse(rows, held),
    ngx_sector_context_equal_weighted: rows.length ? deriveSectors(rows).slice(0, 12) : [],
    prices_as_of: input.snapshot.lastUpdated,
    data_notes:
      "All prices/percentages are from the NGN Market API (delayed up to 20 min during NGX hours). The opportunity set is the largest listed names not already held. Sector context is equal-weighted from constituents. For deeper single-stock fundamentals, call the get_stock_fundamentals tool.",
  };

  const system = `${SYSTEM_PROMPT}

DATA (the only market facts you may use):
\`\`\`json
${JSON.stringify(payload)}
\`\`\``;

  return { ok: true, system, history };
}

// Map an SDK exception to a ChatEvent error (shared by both entry points).
function errorFromException(err: unknown): { error: string; errorCode: ErrorCode } {
  if (err instanceof Anthropic.AuthenticationError) {
    return { errorCode: "NO_CREDENTIALS", error: "The Claude API key was rejected. Check Admin → Settings." };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { errorCode: "RATE_LIMITED", error: "Rate limit reached — try again shortly." };
  }
  if (err instanceof Anthropic.APIError) {
    return { errorCode: "API_ERROR", error: `Claude API error (${err.status}).` };
  }
  return { errorCode: "API_ERROR", error: "Could not reach the Claude API." };
}

// Streaming answer with on-demand tool use. Yields NDJSON-friendly events: text
// deltas as Fable writes, a "tool" event whenever it pulls a stock's live
// fundamentals, and a final "done"/"error". Fable primary; falls back to Opus
// 4.8 only if the FIRST turn refuses before any text (staying on one model once
// a tool-use loop starts keeps thinking-block replay valid).
export async function* streamChatPortfolio(input: {
  snapshot: ReviewSnapshot;
  messages: ChatMessage[];
}): AsyncGenerator<ChatEvent> {
  const ctx = await prepareContext(input);
  if (!ctx.ok) {
    yield { type: "error", error: ctx.error, errorCode: ctx.errorCode };
    return;
  }

  const client = new Anthropic({ apiKey: (await getAnthropicApiKey()) ?? null });
  let model = PRIMARY_MODEL;
  let usedFallback = false;
  let anyText = false;
  const messages: Anthropic.MessageParam[] = ctx.history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const isFable = model.startsWith("claude-fable");
    let msg: Anthropic.Message;
    try {
      const stream = client.messages.stream({
        model,
        max_tokens: 6000, // headroom for adaptive thinking + reply + tool calls
        // Fable 5 thinking is always on — omit the param (explicit disabled 400s).
        ...(isFable ? {} : { thinking: { type: "adaptive" as const } }),
        output_config: { effort: "medium" as const },
        system: ctx.system,
        tools: [FUNDAMENTALS_TOOL],
        messages,
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          anyText = true;
          yield { type: "delta", text: event.delta.text };
        }
      }
      msg = await stream.finalMessage();
    } catch (err) {
      yield { type: "error", ...errorFromException(err) };
      return;
    }

    // Safety-classifier decline. Retry the whole turn on Opus only if nothing
    // has been streamed yet (a mid-answer decline is surfaced to the analyst).
    if (msg.stop_reason === "refusal") {
      if (!usedFallback && !anyText && turn === 0) {
        usedFallback = true;
        model = FALLBACK_MODEL;
        turn = -1; // restart the loop with the untouched history
        continue;
      }
      yield { type: "error", error: "Fable declined to answer this one — try rephrasing.", errorCode: "API_ERROR" };
      return;
    }

    // Tool use: run each requested lookup, return all results in one user turn,
    // then loop so Fable can continue with the live figures.
    if (msg.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: msg.content });
      const toolUses = msg.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const symbol = String((tu.input as { symbol?: unknown })?.symbol ?? "").toUpperCase();
        yield { type: "tool", symbol };
        const data = await getStockFundamentals(symbol);
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(data),
        });
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    // end_turn (or any other terminal stop).
    if (!anyText) {
      yield { type: "error", error: "The model returned no answer — try rephrasing.", errorCode: "API_ERROR" };
      return;
    }
    yield { type: "done", model: msg.model };
    return;
  }

  // Exhausted the tool-round budget without a final text turn.
  yield { type: "done", model };
}
