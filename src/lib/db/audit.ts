import "server-only";
import { query, newId } from "./client";

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  portfolio_id: string | null;
  detail: string;
  created_at: string;
}

// Write an audit entry. portfolioId is optional for platform-level actions
// (e.g. settings changes) that aren't tied to a portfolio.
export async function logAudit(entry: {
  actor: string;
  action: string;
  detail?: string;
  portfolioId?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO audit_log (id, actor, action, portfolio_id, detail) VALUES ($1,$2,$3,$4,$5)`,
    [newId("aud"), entry.actor, entry.action, entry.portfolioId ?? null, entry.detail ?? ""]
  );
}

export async function listAudit(
  opts: { portfolioId?: string; limit?: number } = {}
): Promise<AuditEntry[]> {
  // `?? 200` doesn't catch NaN (e.g. limit=Number("abc")), which would make the
  // SQL LIMIT NaN and 500. Coerce defensively.
  const n = Number(opts.limit);
  const limit = Number.isFinite(n) ? Math.min(500, Math.max(1, n)) : 200;
  if (opts.portfolioId) {
    return query<AuditEntry>(
      `SELECT * FROM audit_log WHERE portfolio_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [opts.portfolioId, limit]
    );
  }
  return query<AuditEntry>(
    `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
}
