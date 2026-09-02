import "server-only";
import { query, queryOne } from "./client";

export interface AiPortfolioReview {
  portfolio_id: string;
  cash_available: number;
  content: string; // markdown
  model: string;
  generated_by: string;
  created_at: string;
}

export async function getReview(portfolioId: string): Promise<AiPortfolioReview | null> {
  const row = await queryOne<AiPortfolioReview>(
    `SELECT * FROM ai_portfolio_reviews WHERE portfolio_id = $1`,
    [portfolioId]
  );
  // PGlite returns NUMERIC columns as strings; coerce so the typed `number` is
  // honest for every consumer (not just the ones that defensively wrap it).
  if (row) row.cash_available = Number(row.cash_available);
  return row;
}

export async function saveReview(input: {
  portfolioId: string;
  cashAvailable: number;
  content: string;
  model: string;
  generatedBy: string;
}): Promise<AiPortfolioReview> {
  await query(
    `INSERT INTO ai_portfolio_reviews (portfolio_id, cash_available, content, model, generated_by)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (portfolio_id)
     DO UPDATE SET cash_available = $2, content = $3, model = $4, generated_by = $5, created_at = now()`,
    [input.portfolioId, input.cashAvailable, input.content, input.model, input.generatedBy]
  );
  return (await getReview(input.portfolioId))!;
}
