// AI daily market summary. Gathers the day's NGX data from our cached proxy
// layer (no extra quota beyond the dashboard's own calls) and asks Claude to
// write a desk-style summary. One summary per trading day is persisted in
// PGlite; regeneration overwrites that day's entry.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, hasAnthropicCredentials } from "./credentials";
import { ngxFetch } from "@/lib/ngx/client";
import { deriveSectors, deriveYtd } from "@/lib/ngx/derived";
import { getSummary, saveSummary, type AiSummary } from "@/lib/db/ai-summaries";
import type {
  CompanyListRow,
  ForexCurrent,
  IndexSummary,
  MarketMovers,
  MarketSnapshot,
  Paginated,
  SectorRotation,
  TopTrades,
  YtdPerformers,
} from "@/lib/ngx/types";

const MODEL = "claude-opus-4-8";

// ---------------------------------------------------------------------------
// Data gathering — compact payload, only fields the summary needs.
// ---------------------------------------------------------------------------

interface GatheredData {
  tradeDate: string;
  payload: Record<string, unknown>;
  unavailable: string[];
}

export async function gatherMarketData(): Promise<GatheredData | null> {
  const [snapshot, indices, movers, topTrades, sectors, ytd, forex] =
    await Promise.all([
      ngxFetch<MarketSnapshot>({ path: "market/snapshot" }),
      ngxFetch<Paginated<IndexSummary>>({ path: "indices", query: "limit=50" }),
      ngxFetch<MarketMovers>({ path: "market/movers", query: "limit=5" }),
      ngxFetch<TopTrades>({ path: "market/top-trades", query: "limit=5" }),
      ngxFetch<SectorRotation>({ path: "market/sectors" }),
      ngxFetch<YtdPerformers>({ path: "market/ytd-performers", query: "type=best&limit=5" }),
      ngxFetch<ForexCurrent>({ path: "forex/current" }),
    ]);

  if (!snapshot.ok) return null; // without the snapshot there is nothing to summarize
  const s = snapshot.data;
  const tradeDate = String(s.date).slice(0, 10);
  const unavailable: string[] = [];

  const payload: Record<string, unknown> = {
    trade_date: tradeDate,
    data_delayed_note:
      "Prices delayed up to 20 minutes during NGX hours; outside hours values are last session close.",
    snapshot: {
      asi: s.asi,
      asi_change_percent: s.asi_change_percent,
      asi_change_points: s.asi_change,
      ytd_asi_change_percent: s.ytd_asi_change_percent,
      deals: s.deals,
      volume: s.volume,
      value_traded_ngn: s.value_traded,
      market_cap_total_ngn: s.market_cap?.total,
      breadth: s.breadth,
      last_updated: s.updated_at,
    },
  };

  if (indices.ok) {
    payload.indices = indices.data.data.slice(0, 12).map((i) => ({
      symbol: i.symbol,
      name: i.index_name,
      value: i.current_value,
      day_pct: i.price_change_percent,
      ytd_pct: i.change_ytd_percent,
    }));
  } else unavailable.push("indices");

  if (movers.ok) {
    const strip = (rows: MarketMovers["top_gainers"]) =>
      rows.map((r) => ({
        symbol: r.symbol,
        name: r.company_name,
        sector: r.sector,
        close: r.todays_close,
        change_pct: r.change_percent,
      }));
    payload.top_gainers = strip(movers.data.top_gainers);
    payload.top_losers = strip(movers.data.top_losers);
  } else unavailable.push("top gainers/losers");

  if (topTrades.ok) {
    payload.most_active_by_value = topTrades.data.data.map((r) => ({
      symbol: r.symbol,
      name: r.company_name,
      value_traded_ngn: r.value_traded,
      price: r.price,
      change_pct: r.price_change_percent,
    }));
  } else unavailable.push("most active");

  // Sector + YTD: use the API when the plan allows; otherwise derive exactly
  // from the per-company list and label the methodology.
  let companyRows: CompanyListRow[] | null = null;
  const needDerived = !sectors.ok || !ytd.ok;
  if (needDerived) {
    const companies = await ngxFetch<Paginated<CompanyListRow>>({
      path: "companies",
      query: "limit=300",
    });
    if (companies.ok) companyRows = companies.data.data;
  }

  if (sectors.ok) {
    payload.sectors = sectors.data.sectors.map((x) => ({
      sector: x.sector,
      day_pct: x.change_1d,
      week_pct: x.change_7d,
      breadth: x.breadth,
    }));
  } else if (companyRows) {
    payload.sectors_derived_equal_weighted = deriveSectors(companyRows).map((x) => ({
      sector: x.sector,
      day_pct: x.change_1d,
      week_pct: x.change_7d,
      breadth: x.breadth,
    }));
  } else unavailable.push("sector performance");

  if (ytd.ok) {
    payload.ytd_best = ytd.data.data.map((r) => ({
      symbol: r.symbol,
      ytd_pct: r.ytd_pct,
    }));
  } else if (companyRows) {
    payload.ytd_best_derived = deriveYtd(companyRows, "best", 5).map((r) => ({
      symbol: r.symbol,
      ytd_pct: r.ytd_pct,
    }));
  } else unavailable.push("YTD leaders");

  if (forex.ok) {
    payload.fx_ngn_per_unit = forex.data.rates
      .filter((r) => ["USD", "GBP", "EUR"].includes(r.currency))
      .map((r) => ({
        currency: r.currency,
        ngn_rate: r.rate,
        day_change_pct: r.daily_change_percent,
      }));
  } else unavailable.push("FX rates");

  return { tradeDate, payload, unavailable };
}

// ---------------------------------------------------------------------------
// Claude call
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a markets-desk analyst at BRB Capital Group writing the internal daily NGX (Nigerian Exchange) market summary for investment analysts and portfolio managers.

Rules — these are compliance requirements, not preferences:
- Use ONLY the figures provided in the JSON data. Never invent, estimate, or extrapolate numbers. If a dataset is listed as unavailable, do not speculate about it.
- Describe what happened; never advise. No recommendations, no "buy/sell/hold", no price targets, no predictions, no language implying guaranteed or expected returns.
- Neutral, professional desk tone. Written for professionals — dense and specific beats padded prose.
- Note the data timestamp/delay once, briefly.
- Currency is Nigerian naira (₦); large values may be expressed as ₦x.xB / ₦x.xT. Percentages to 2dp as given.

Output format: Markdown, 300–450 words, exactly these sections:
## Headline
One or two sentences capturing the session.
## Market Action
ASI level and move, breadth, turnover/volume, notable index moves.
## Movers & Sectors
Top gainers/losers and most-active names; sector picture if available.
## FX
Naira rates and moves (₦ per unit).
## Takeaway
2–3 neutral observations an analyst should note (facts from the data, not advice).`;

export interface GenerateResult {
  ok: boolean;
  summary?: AiSummary;
  error?: string;
  errorCode?: "NO_CREDENTIALS" | "RATE_LIMITED" | "NO_DATA" | "API_ERROR";
}

export async function getCachedSummary(): Promise<AiSummary | null> {
  const snapshot = await ngxFetch<MarketSnapshot>({ path: "market/snapshot" });
  if (!snapshot.ok) return null;
  const tradeDate = String(snapshot.data.date).slice(0, 10);
  return getSummary(tradeDate);
}

export async function generateSummary(
  actor: string,
  opts: { webContext?: boolean } = {}
): Promise<GenerateResult> {
  const gathered = await gatherMarketData();
  if (!gathered) {
    return {
      ok: false,
      errorCode: "NO_DATA",
      error: "Market data is unavailable right now — cannot generate a summary.",
    };
  }

  // Require an explicit credential up front — clearer than letting the SDK
  // throw its generic "could not resolve authentication" error at call time.
  if (!(await hasAnthropicCredentials())) {
    return {
      ok: false,
      errorCode: "NO_CREDENTIALS",
      error:
        "Claude API key not configured. An admin can add it under Admin → Settings (or set ANTHROPIC_API_KEY on the server).",
    };
  }
  const client = new Anthropic({ apiKey: (await getAnthropicApiKey()) ?? null });

  const userMessage = `Here is today's NGX market data as JSON. Write the daily summary.

${gathered.unavailable.length ? `Datasets unavailable on our current data plan (do not mention beyond a single parenthetical if relevant): ${gathered.unavailable.join(", ")}.` : ""}

\`\`\`json
${JSON.stringify(gathered.payload, null, 1)}
\`\`\``;

  // Optional: let Claude search the live web for qualitative context (policy,
  // corporate events) — never for NGX price figures, which the JSON governs.
  const webSystemAddendum = `

Web search is enabled for THIS request. Use it sparingly (1–3 searches) for qualitative Nigerian-market context only — monetary policy, notable corporate actions, macro events. The JSON data remains the ONLY source for NGX prices, index levels and percentages; never replace or adjust those figures with web numbers. Attribute web-sourced statements naturally in text (e.g. "per <source>"). If nothing materially relevant is found, write the summary from the data alone.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000, // headroom for adaptive thinking; the summary itself is short
      thinking: { type: "adaptive" },
      system: opts.webContext ? SYSTEM_PROMPT + webSystemAddendum : SYSTEM_PROMPT,
      ...(opts.webContext
        ? {
            tools: [
              { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 3 },
            ],
          }
        : {}),
      messages: [{ role: "user", content: userMessage }],
    });

    let text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) {
      return { ok: false, errorCode: "API_ERROR", error: "The model returned no text." };
    }

    // Append cited web sources (deduped) so every web-derived claim is traceable.
    if (opts.webContext) {
      const sources = new Map<string, string>();
      for (const block of response.content) {
        if (block.type === "text" && block.citations) {
          for (const c of block.citations) {
            if ("url" in c && typeof c.url === "string") {
              sources.set(c.url, "title" in c && c.title ? String(c.title) : c.url);
            }
          }
        }
      }
      if (sources.size > 0) {
        text +=
          "\n\n## Sources\n" +
          [...sources.entries()].map(([url, title]) => `- [${title}](${url})`).join("\n");
      }
    }

    const summary = await saveSummary({
      tradeDate: gathered.tradeDate,
      content: text,
      model: response.model,
      generatedBy: actor,
    });
    return { ok: true, summary };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return {
        ok: false,
        errorCode: "NO_CREDENTIALS",
        error:
          "Claude API credentials are missing or invalid. Add ANTHROPIC_API_KEY to .env.local and restart the server.",
      };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return {
        ok: false,
        errorCode: "RATE_LIMITED",
        error: "Claude API rate limit reached — try again shortly.",
      };
    }
    if (err instanceof Anthropic.APIError) {
      return {
        ok: false,
        errorCode: "API_ERROR",
        error: `Claude API error (${err.status}): ${err.message}`,
      };
    }
    return {
      ok: false,
      errorCode: "API_ERROR",
      error: "Could not reach the Claude API.",
    };
  }
}
