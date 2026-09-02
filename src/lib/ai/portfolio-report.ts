// Structured Portfolio Analysis Report — Fable 5 produces a formal, sectioned
// analysis of the portfolio grounded strictly in its own figures + live NGX
// data. Rendered to a print-clean page the analyst saves as PDF. Same provenance
// and compliance rules as the rest of the AI layer; Opus 4.8 fallback.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, hasAnthropicCredentials } from "./credentials";
import { ngxFetch } from "@/lib/ngx/client";
import { deriveSectors } from "@/lib/ngx/derived";
import type { CompanyListRow, Paginated } from "@/lib/ngx/types";
import type { ReviewSnapshot } from "./portfolio-review";

const PRIMARY_MODEL = "claude-fable-5";
const FALLBACK_MODEL = "claude-opus-4-8";

type ErrorCode = "NO_CREDENTIALS" | "RATE_LIMITED" | "API_ERROR" | "NO_DATA";

// Streamed to the browser as newline-delimited JSON (NDJSON). The report is a
// long Fable 5 document (~46s non-streamed), so we stream it: bytes flow
// immediately, the analyst watches it write, and no single long response trips
// an intermediate proxy/function timeout.
export type ReportEvent =
  | { type: "delta"; text: string } // a chunk of the report markdown
  | { type: "done"; model: string } // report complete
  | { type: "error"; error: string; errorCode: ErrorCode };

const SYSTEM_PROMPT = `You are the Head of Portfolio Strategy at BRB Capital, a Nigerian brokerage, writing a formal internal Portfolio Analysis Report on one NGX equity portfolio for the analyst who manages it and their Investment Committee. The reader is a finance professional.

ABSOLUTE DATA RULES (a dual-regulated desk — FCA UK / SEC Nigeria):
- Use ONLY the figures in the provided JSON (positions, totals, sector allocation, the NGX opportunity-set universe). NEVER invent or recall prices, market caps, fundamentals or percentages from memory. If a figure is absent, say so and reason qualitatively.
- Every naira figure for sizing must be arithmetic on the provided numbers; show it briefly.
- Do NOT promise, forecast or imply returns. Frame everything as conditional, risk-weighted rationale grounded in the data.
- This is internal idea-generation for the analyst's judgement, subject to PM/IC approval — not investment advice, not a recommendation to any client, not an order.

OUTPUT — a clean Markdown report with EXACTLY these sections and headings:
## Executive Summary
3–4 sentences: the book's posture, standout strengths and the single most important issue to address. Cite numbers.
## Portfolio Diagnosis
A short paragraph on concentration, sector tilt, momentum/P&L and mandate/benchmark alignment, citing the figures.
## Holdings Review
A markdown table: | Symbol | Weight | Unrealised % | Stance | Note |. One row per held position. Stance = Add / Hold / Trim / Exit. Keep notes to one line, grounded in the data.
## Sector & Concentration
2–4 bullets on sector concentration and single-name risk (flag any position above ~15% of market value), using the provided sector allocation.
## Ideas — Trim or Exit
A markdown table: | Symbol | Current weight | Rationale | Suggested action |. Only current holdings. If nothing warrants it, say so.
## Ideas — Add
A markdown table: | Symbol | Sector | Rationale (from data) | Indicative weight |. Only names from the provided opportunity set that are NOT already held.
## Key Risks
3–5 bullets: liquidity, concentration, data staleness, execution, mandate drift.
## Recommendation Summary
A short numbered list of the 3–5 highest-priority actions for the analyst to evaluate, in order.

Tone: senior, crisp, desk-level. No preamble, no restating instructions. Do not add a compliance section (the report template adds one). Aim for 700–1000 words.`;

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

// Validate + assemble the grounded prompt (shared by the streaming generator).
type PreparedReport =
  | { ok: false; errorCode: ErrorCode; error: string }
  | { ok: true; userMessage: string };

async function prepareReport(snapshot: ReviewSnapshot): Promise<PreparedReport> {
  const positions = (snapshot.positions ?? []).filter((p) => p && p.symbol);
  if (!positions.length) {
    return { ok: false, errorCode: "NO_DATA", error: "This portfolio has no valued positions to report on." };
  }
  if (!(await hasAnthropicCredentials())) {
    return { ok: false, errorCode: "NO_CREDENTIALS", error: "Claude API key not configured (Admin → Settings)." };
  }

  const held = new Set(positions.map((p) => p.symbol.toUpperCase()));
  const companiesRes = await ngxFetch<Paginated<CompanyListRow>>({ path: "companies", query: "limit=300" });
  const rows = companiesRes.ok ? companiesRes.data.data : [];

  const payload = {
    portfolio: {
      name: snapshot.name,
      mandate_notes: snapshot.mandateNotes || "(none provided)",
      benchmark: snapshot.benchmark,
      base_currency: snapshot.baseCurrency,
      totals: snapshot.totals,
      sector_allocation: snapshot.sectorAllocation,
      positions,
    },
    ngx_opportunity_set: buildUniverse(rows, held),
    ngx_sector_context_equal_weighted: rows.length ? deriveSectors(rows).slice(0, 12) : [],
    prices_as_of: snapshot.lastUpdated,
    data_notes:
      "All prices/percentages are from the NGN Market API (delayed up to 20 min during NGX hours). Opportunity set is the largest listed names not already held; sector context is equal-weighted from constituents.",
  };

  const userMessage = `Write the Portfolio Analysis Report for this NGX equity portfolio.

\`\`\`json
${JSON.stringify(payload)}
\`\`\``;

  return { ok: true, userMessage };
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

// Stream the report as Fable writes it. Fable primary; falls back to Opus 4.8
// only if the first attempt refuses before any text (once text has streamed a
// refusal is surfaced as-is). Yields NDJSON-friendly events.
export async function* streamPortfolioReport(input: {
  snapshot: ReviewSnapshot;
}): AsyncGenerator<ReportEvent> {
  const prep = await prepareReport(input.snapshot);
  if (!prep.ok) {
    yield { type: "error", error: prep.error, errorCode: prep.errorCode };
    return;
  }

  const client = new Anthropic({ apiKey: (await getAnthropicApiKey()) ?? null });
  let model = PRIMARY_MODEL;
  let usedFallback = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    const isFable = model.startsWith("claude-fable");
    let anyText = false;
    let refused = false;
    let finalModel = model;
    try {
      const stream = client.messages.stream({
        model,
        max_tokens: 14000,
        // Fable 5 thinking is always on — omit the param (explicit disabled 400s).
        ...(isFable ? {} : { thinking: { type: "adaptive" as const } }),
        output_config: { effort: "high" as const },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prep.userMessage }],
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          anyText = true;
          yield { type: "delta", text: event.delta.text };
        }
      }
      const msg = await stream.finalMessage();
      finalModel = msg.model;
      refused = msg.stop_reason === "refusal";
    } catch (err) {
      yield { type: "error", ...errorFromException(err) };
      return;
    }

    // Retry once on Opus if Fable declined/produced nothing before any output.
    if ((refused || !anyText) && !usedFallback && !anyText) {
      usedFallback = true;
      model = FALLBACK_MODEL;
      continue;
    }
    if (!anyText) {
      yield { type: "error", error: "The model returned no report — try again.", errorCode: "API_ERROR" };
      return;
    }
    yield { type: "done", model: finalModel };
    return;
  }

  yield { type: "error", error: "The model returned no report — try again.", errorCode: "API_ERROR" };
}
