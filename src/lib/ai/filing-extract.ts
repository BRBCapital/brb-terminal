// AI extraction of financial statements from official NGX filing PDFs.
// The Starter-tier disclosures endpoint links every filing's PDF on the NGX
// document library; we download the document server-side, hand it to Claude as
// a base64 document block with citations enabled, and store the extracted
// statements as markdown with page-level citation markers. One extraction per
// document URL is cached in PGlite.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, hasAnthropicCredentials } from "./credentials";
import { ngxFetch } from "@/lib/ngx/client";
import {
  getFilingExtraction,
  saveFilingExtraction,
  type AiFiling,
} from "@/lib/db/ai-filings";
import type { DisclosureRow, Paginated } from "@/lib/ngx/types";

const MODEL = "claude-opus-4-8";
const MAX_PDF_BYTES = 20 * 1024 * 1024; // guard well under the 32MB request cap
// Only fetch documents from the official NGX document library (SSRF guard —
// these URLs come from API data, not user input, but defense in depth).
const ALLOWED_HOSTS = new Set(["doclib.ngxgroup.com"]);

export interface FilingRef {
  title: string;
  submission_type: string;
  document_url: string;
  disclosed_at: string;
}

// Financial-statement filings for a company, newest first.
export async function listFinancialFilings(symbol: string): Promise<FilingRef[]> {
  const res = await ngxFetch<Paginated<DisclosureRow>>({
    path: `companies/${symbol}/disclosures`,
    query: "limit=50",
  });
  if (!res.ok) return [];
  return res.data.data
    .filter((r) => /financial statement/i.test(r.submission_type))
    .map((r) => ({
      title: r.title,
      submission_type: r.submission_type,
      document_url: r.document_url,
      disclosed_at: r.disclosed_at,
    }));
}

const SYSTEM_PROMPT = `You are a financial-statements analyst at BRB Capital Group extracting figures from an official NGX (Nigerian Exchange) corporate filing for internal use by investment analysts.

Rules — compliance requirements:
- Extract ONLY figures that appear in the document. Never estimate, extrapolate, or fill gaps. If a statement or line item is not in the document, state that it is not present.
- Pay close attention to units and currency: Nigerian filings commonly report in ₦'000, ₦ million, or ₦ billion — state the unit ONCE per table header and keep all figures in the filing's own units.
- Include comparative-period figures where the filing shows them.
- Descriptive only: no advice, recommendations, forecasts, or valuation opinions.

Output format: Markdown with exactly these sections (omit a table only if that statement is absent, and say so):
## Filing Overview
Reporting entity, period covered, audited/unaudited, accounting standard if stated, currency and units.
## Income Statement
Table: line item | current period | comparative. Cover revenue, key costs, operating profit, pre-tax profit, tax, profit after tax, EPS.
## Balance Sheet
Table with major lines: total assets, key asset lines, total liabilities, key liability lines, equity.
## Cash Flow
Table: operating, investing, financing cash flows, ending cash.
## Notable Points
3–5 bullet facts evident in the filing (e.g. one-off items, dividend declared, segment notes). Facts only.`;

export interface ExtractResult {
  ok: boolean;
  filing?: AiFiling;
  error?: string;
  errorCode?: "NO_CREDENTIALS" | "RATE_LIMITED" | "FETCH_FAILED" | "TOO_LARGE" | "API_ERROR";
}

export async function extractFiling(
  actor: string,
  input: { symbol: string; documentUrl: string; title: string; force?: boolean }
): Promise<ExtractResult> {
  // Serve cache unless regeneration was requested.
  if (!input.force) {
    const cached = await getFilingExtraction(input.documentUrl);
    if (cached) return { ok: true, filing: cached };
  }

  // Validate + download the PDF server-side.
  let url: URL;
  try {
    url = new URL(input.documentUrl);
  } catch {
    return { ok: false, errorCode: "FETCH_FAILED", error: "Invalid document URL." };
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    return {
      ok: false,
      errorCode: "FETCH_FAILED",
      error: "Only documents on the official NGX document library can be extracted.",
    };
  }

  let pdfBase64: string;
  try {
    // redirect:"error" — the host allow-list is checked on the initial URL only,
    // so refuse to follow a redirect off the trusted NGX host (SSRF defence).
    const res = await fetch(url, { cache: "no-store", redirect: "error" });
    if (!res.ok) {
      return { ok: false, errorCode: "FETCH_FAILED", error: `Could not download the filing (HTTP ${res.status}).` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_PDF_BYTES) {
      return {
        ok: false,
        errorCode: "TOO_LARGE",
        error: `This filing is ${(buf.byteLength / 1e6).toFixed(1)}MB — above the ${MAX_PDF_BYTES / 1e6}MB extraction limit.`,
      };
    }
    pdfBase64 = buf.toString("base64");
  } catch {
    return { ok: false, errorCode: "FETCH_FAILED", error: "Could not download the filing PDF." };
  }

  if (!(await hasAnthropicCredentials())) {
    return {
      ok: false,
      errorCode: "NO_CREDENTIALS",
      error:
        "Claude API key not configured. An admin can add it under Admin → Settings (or set ANTHROPIC_API_KEY on the server).",
    };
  }
  const client = new Anthropic({ apiKey: (await getAnthropicApiKey()) ?? null });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
              title: input.title,
              citations: { enabled: true },
            },
            {
              type: "text",
              text: `Extract the financial statements from this NGX filing ("${input.title}" — ${input.symbol}).`,
            },
          ],
        },
      ],
    });

    // With citations enabled the answer arrives as many text blocks; cited
    // blocks carry page_location citations. Append page markers so every
    // extracted figure is traceable to the source page.
    let text = "";
    for (const block of response.content) {
      if (block.type !== "text") continue;
      text += block.text;
      if (block.citations?.length) {
        const pages = new Set<number>();
        for (const c of block.citations) {
          if ("start_page_number" in c && typeof c.start_page_number === "number") {
            pages.add(c.start_page_number);
          }
        }
        if (pages.size) {
          text += ` *[p.${[...pages].sort((a, b) => a - b).join(", p.")}]*`;
        }
      }
    }
    text = text.trim();
    if (!text) {
      return { ok: false, errorCode: "API_ERROR", error: "The model returned no text." };
    }

    const filing = await saveFilingExtraction({
      documentUrl: input.documentUrl,
      symbol: input.symbol,
      title: input.title,
      content: text,
      model: response.model,
      generatedBy: actor,
    });
    return { ok: true, filing };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return {
        ok: false,
        errorCode: "NO_CREDENTIALS",
        error:
          "The Claude API key was rejected. Check the key under Admin → Settings.",
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
