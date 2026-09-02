import "server-only";
import { query, queryOne } from "./client";

export interface AiFiling {
  document_url: string;
  symbol: string;
  title: string;
  content: string;
  model: string;
  generated_by: string;
  created_at: string;
}

export async function getFilingExtraction(url: string): Promise<AiFiling | null> {
  return queryOne<AiFiling>(`SELECT * FROM ai_filings WHERE document_url = $1`, [url]);
}

export async function listFilingExtractions(symbol: string): Promise<AiFiling[]> {
  return query<AiFiling>(
    `SELECT * FROM ai_filings WHERE symbol = $1 ORDER BY created_at DESC`,
    [symbol]
  );
}

export async function saveFilingExtraction(input: {
  documentUrl: string;
  symbol: string;
  title: string;
  content: string;
  model: string;
  generatedBy: string;
}): Promise<AiFiling> {
  await query(
    `INSERT INTO ai_filings (document_url, symbol, title, content, model, generated_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (document_url)
     DO UPDATE SET content = $4, model = $5, generated_by = $6, created_at = now()`,
    [input.documentUrl, input.symbol.toUpperCase(), input.title, input.content, input.model, input.generatedBy]
  );
  return (await getFilingExtraction(input.documentUrl))!;
}
