"use client";

import type {
  PortfolioInput,
  PortfolioSummary,
  PortfolioWithHoldings,
} from "@/lib/db/portfolios";
import type { ValidationIssue } from "./validate";

export interface SaveResult {
  ok: boolean;
  portfolio?: PortfolioWithHoldings;
  error?: string;
  issues?: ValidationIssue[];
}

export async function fetchPortfolios(): Promise<PortfolioSummary[]> {
  const res = await fetch("/api/portfolios", { cache: "no-store" });
  const body = await res.json();
  return body.ok ? body.portfolios : [];
}

export async function fetchPortfolio(
  id: string
): Promise<PortfolioWithHoldings | null> {
  const res = await fetch(`/api/portfolios/${id}`, { cache: "no-store" });
  const body = await res.json();
  return body.ok ? body.portfolio : null;
}

export async function savePortfolio(
  input: PortfolioInput,
  id?: string
): Promise<SaveResult> {
  const res = await fetch(id ? `/api/portfolios/${id}` : "/api/portfolios", {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function deletePortfolioReq(id: string): Promise<boolean> {
  const res = await fetch(`/api/portfolios/${id}`, { method: "DELETE" });
  const body = await res.json();
  return body.ok;
}

// --- Transactions ---------------------------------------------------------
import type { Transaction, TransactionInput, Alert, AlertInput } from "@/lib/db/transactions";

export async function fetchTransactions(portfolioId: string): Promise<Transaction[]> {
  const res = await fetch(`/api/portfolios/${portfolioId}/transactions`, { cache: "no-store" });
  const body = await res.json();
  return body.ok ? body.transactions : [];
}

export async function addTransactionReq(
  portfolioId: string,
  input: TransactionInput
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/portfolios/${portfolioId}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function bulkTransactionsReq(
  portfolioId: string,
  transactions: TransactionInput[]
): Promise<{ ok: boolean; error?: string; count?: number }> {
  const res = await fetch(`/api/portfolios/${portfolioId}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactions }),
  });
  return res.json();
}

export async function deleteTransactionReq(portfolioId: string, txId: string): Promise<boolean> {
  const res = await fetch(`/api/portfolios/${portfolioId}/transactions/${txId}`, { method: "DELETE" });
  return (await res.json()).ok;
}

// --- Alerts ---------------------------------------------------------------
export async function fetchAlerts(portfolioId: string): Promise<Alert[]> {
  const res = await fetch(`/api/portfolios/${portfolioId}/alerts`, { cache: "no-store" });
  const body = await res.json();
  return body.ok ? body.alerts : [];
}

export async function addAlertReq(
  portfolioId: string,
  input: AlertInput
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/portfolios/${portfolioId}/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function deleteAlertReq(portfolioId: string, alertId: string): Promise<boolean> {
  const res = await fetch(`/api/portfolios/${portfolioId}/alerts/${alertId}`, { method: "DELETE" });
  return (await res.json()).ok;
}
