import "server-only";
import { query, queryOne, newId } from "./client";

export type ProposalStatus = "pending" | "approved" | "rejected";

export interface ProposalTrade {
  symbol: string;
  action: "BUY" | "SELL";
  units: number;
  value: number;
}

export interface RebalanceProposal {
  id: string;
  portfolio_id: string;
  portfolio_name: string;
  created_by: string;
  status: ProposalStatus;
  trades: string; // JSON
  turnover: number;
  note: string;
  decided_by: string | null;
  decision_note: string;
  decided_at: string | null;
  created_at: string;
}

async function audit(actor: string, action: string, portfolioId: string, detail: string) {
  await query(
    `INSERT INTO audit_log (id, actor, action, portfolio_id, detail) VALUES ($1,$2,$3,$4,$5)`,
    [newId("aud"), actor, action, portfolioId, detail]
  );
}

export async function createProposal(
  actor: string,
  input: {
    portfolioId: string;
    portfolioName: string;
    trades: ProposalTrade[];
    turnover: number;
    note?: string;
  }
): Promise<RebalanceProposal> {
  const id = newId("reb");
  await query(
    `INSERT INTO rebalance_proposals (id, portfolio_id, portfolio_name, created_by, trades, turnover, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      input.portfolioId,
      input.portfolioName,
      actor,
      JSON.stringify(input.trades),
      input.turnover,
      input.note ?? "",
    ]
  );
  await audit(
    actor,
    "rebalance.submit",
    input.portfolioId,
    `${input.trades.length} trades · turnover ${Math.round(input.turnover)}`
  );
  return (await queryOne<RebalanceProposal>(`SELECT * FROM rebalance_proposals WHERE id = $1`, [id]))!;
}

export async function listProposalsForPortfolio(portfolioId: string): Promise<RebalanceProposal[]> {
  return query<RebalanceProposal>(
    `SELECT * FROM rebalance_proposals WHERE portfolio_id = $1 ORDER BY created_at DESC`,
    [portfolioId]
  );
}

// PM/Admin queue — all pending across the desk; optionally include decided.
export async function listAllProposals(status?: ProposalStatus): Promise<RebalanceProposal[]> {
  if (status) {
    return query<RebalanceProposal>(
      `SELECT * FROM rebalance_proposals WHERE status = $1 ORDER BY created_at DESC`,
      [status]
    );
  }
  return query<RebalanceProposal>(`SELECT * FROM rebalance_proposals ORDER BY created_at DESC`);
}

export async function getProposal(id: string): Promise<RebalanceProposal | null> {
  return queryOne<RebalanceProposal>(`SELECT * FROM rebalance_proposals WHERE id = $1`, [id]);
}

export async function decideProposal(
  actor: string,
  id: string,
  decision: "approved" | "rejected",
  note: string
): Promise<RebalanceProposal | null> {
  const existing = await getProposal(id);
  if (!existing || existing.status !== "pending") return null;
  await query(
    `UPDATE rebalance_proposals
       SET status = $2, decided_by = $3, decision_note = $4, decided_at = now()
     WHERE id = $1`,
    [id, decision, actor, note]
  );
  await audit(actor, `rebalance.${decision}`, existing.portfolio_id, existing.portfolio_name);
  return getProposal(id);
}
