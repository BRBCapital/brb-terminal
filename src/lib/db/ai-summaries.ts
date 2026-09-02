import "server-only";
import { query, queryOne } from "./client";

export interface AiSummary {
  trade_date: string; // YYYY-MM-DD
  content: string; // markdown
  model: string;
  generated_by: string;
  created_at: string;
}

export async function getSummary(tradeDate: string): Promise<AiSummary | null> {
  return queryOne<AiSummary>(`SELECT * FROM ai_summaries WHERE trade_date = $1`, [
    tradeDate,
  ]);
}

export async function saveSummary(input: {
  tradeDate: string;
  content: string;
  model: string;
  generatedBy: string;
}): Promise<AiSummary> {
  await query(
    `INSERT INTO ai_summaries (trade_date, content, model, generated_by)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (trade_date)
     DO UPDATE SET content = $2, model = $3, generated_by = $4, created_at = now()`,
    [input.tradeDate, input.content, input.model, input.generatedBy]
  );
  return (await getSummary(input.tradeDate))!;
}
