import "server-only";
import { query, queryOne } from "./client";

export type AnalysisKind = "dividend_forecast" | "sector_momentum" | "trade_signal";

export const ANALYSIS_KINDS: AnalysisKind[] = [
  "dividend_forecast",
  "sector_momentum",
  "trade_signal",
];

export function isAnalysisKind(v: string): v is AnalysisKind {
  return (ANALYSIS_KINDS as string[]).includes(v);
}

export interface AiStockAnalysis {
  symbol: string;
  kind: AnalysisKind;
  content: string; // markdown
  model: string;
  generated_by: string;
  created_at: string;
}

export async function getAnalysis(
  symbol: string,
  kind: AnalysisKind
): Promise<AiStockAnalysis | null> {
  return queryOne<AiStockAnalysis>(
    `SELECT * FROM ai_stock_analyses WHERE symbol = $1 AND kind = $2`,
    [symbol.toUpperCase(), kind]
  );
}

export async function saveAnalysis(input: {
  symbol: string;
  kind: AnalysisKind;
  content: string;
  model: string;
  generatedBy: string;
}): Promise<AiStockAnalysis> {
  await query(
    `INSERT INTO ai_stock_analyses (symbol, kind, content, model, generated_by)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (symbol, kind)
     DO UPDATE SET content = $3, model = $4, generated_by = $5, created_at = now()`,
    [input.symbol.toUpperCase(), input.kind, input.content, input.model, input.generatedBy]
  );
  return (await getAnalysis(input.symbol, input.kind))!;
}
