"use client";

import type { RebalanceProposal, ProposalTrade } from "@/lib/db/proposals";

export async function fetchPortfolioProposals(portfolioId: string): Promise<RebalanceProposal[]> {
  const res = await fetch(`/api/portfolios/${portfolioId}/rebalance-proposals`, { cache: "no-store" });
  const b = await res.json();
  return b.ok ? b.proposals : [];
}

export async function submitProposal(
  portfolioId: string,
  trades: ProposalTrade[],
  turnover: number,
  note = ""
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/portfolios/${portfolioId}/rebalance-proposals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trades, turnover, note }),
  });
  return res.json();
}

export async function fetchProposalQueue(status?: string): Promise<RebalanceProposal[]> {
  const q = status ? `?status=${status}` : "";
  const res = await fetch(`/api/rebalance-proposals${q}`, { cache: "no-store" });
  const b = await res.json();
  return b.ok ? b.proposals : [];
}

export async function decideProposalReq(
  pid: string,
  decision: "approved" | "rejected",
  note = ""
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/rebalance-proposals/${pid}/decide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, note }),
  });
  return res.json();
}
