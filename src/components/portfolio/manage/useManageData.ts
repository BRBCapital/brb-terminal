"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchProxy } from "@/lib/ngx/browser";
import {
  fetchPortfolio,
  fetchTransactions,
  fetchAlerts,
} from "@/lib/portfolio/api";
import {
  computePositions,
  valuePositions,
  type LedgerTx,
} from "@/lib/portfolio/positions";
import { effectiveWeights } from "@/lib/portfolio/validate";
import type { CompanyDetail, ForexCurrent } from "@/lib/ngx/types";
import type { PortfolioWithHoldings } from "@/lib/db/portfolios";
import type { Transaction, Alert } from "@/lib/db/transactions";

export interface Quote {
  price: number | null;
  prevClose: number | null;
  sector: string;
  name: string;
  lastUpdated: string | null;
}

export type ManageData = ReturnType<typeof useManageData>;

export function useManageData(id: string) {
  const [portfolio, setPortfolio] = useState<PortfolioWithHoldings | null | undefined>(undefined);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [usdRate, setUsdRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadTx = useCallback(async () => {
    setTransactions(await fetchTransactions(id));
  }, [id]);
  const reloadAlerts = useCallback(async () => {
    setAlerts(await fetchAlerts(id));
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [pf, txs0, als, fx] = await Promise.all([
        fetchPortfolio(id),
        fetchTransactions(id),
        fetchAlerts(id),
        fetchProxy<ForexCurrent>("forex/current"),
      ]);
      if (cancelled) return;

      // Auto-seed the live ledger from the model the first time this book is
      // opened in Manage — so a freshly-built portfolio shows its holdings here
      // instead of an empty ledger. The endpoint is idempotent (guarded by
      // ledger_seeded_at server-side), so this never double-books on revisits or
      // React strict-mode double effects.
      let txs = txs0;
      if (txs.length === 0 && pf && !pf.ledger_seeded_at && pf.holdings.length > 0) {
        try {
          await fetch(`/api/portfolios/${id}/initialize-ledger`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          if (cancelled) return;
          txs = await fetchTransactions(id);
          if (cancelled) return;
        } catch {
          // Non-fatal: the Holdings tab still offers a manual "Initialize" action.
        }
      }

      setPortfolio(pf);
      setTransactions(txs);
      setAlerts(als);
      if (fx.ok) {
        setUsdRate(fx.data.rates.find((r) => r.currency === "USD")?.rate ?? null);
      }

      // Quotes for every symbol referenced by the model or the ledger.
      const symbols = new Set<string>();
      pf?.holdings.forEach((h) => symbols.add(h.symbol));
      txs.forEach((t) => symbols.add(t.symbol));
      const entries = await Promise.all(
        [...symbols].map(async (sym) => {
          const res = await fetchProxy<CompanyDetail>(`companies/${sym}`);
          const q: Quote = res.ok
            ? {
                price: res.data.current_price,
                prevClose: res.data.prev_close,
                sector: res.data.sector,
                name: res.data.name,
                lastUpdated: res.data.last_updated,
              }
            : { price: null, prevClose: null, sector: "", name: sym, lastUpdated: null };
          return [sym, q] as const;
        })
      );
      if (cancelled) return;
      setQuotes(Object.fromEntries(entries));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const positions = useMemo(() => {
    const ledger: LedgerTx[] = transactions.map((t) => ({
      symbol: t.symbol,
      kind: t.kind,
      trade_date: t.trade_date,
      units: t.units,
      price: t.price,
      fees: t.fees,
      amount: t.amount,
    }));
    return computePositions(ledger);
  }, [transactions]);

  const { valued, totals } = useMemo(
    () =>
      valuePositions(
        positions,
        Object.fromEntries(
          Object.entries(quotes).map(([s, q]) => [
            s,
            { price: q.price, prevClose: q.prevClose, sector: q.sector, name: q.name },
          ])
        )
      ),
    [positions, quotes]
  );

  // Target weights from the model portfolio (construction phase).
  const targetWeights = useMemo(() => {
    if (!portfolio) return {} as Record<string, number>;
    const eff = effectiveWeights(
      portfolio.holdings.map((h) => ({
        symbol: h.symbol,
        sector: h.sector,
        mode: h.mode,
        weight: h.weight,
        units: h.units,
        entry_price: h.entry_price,
      }))
    );
    return Object.fromEntries(eff.map((w) => [w.symbol, w.pct]));
  }, [portfolio]);

  const lastUpdated = useMemo(() => {
    const times = Object.values(quotes)
      .map((q) => q.lastUpdated)
      .filter(Boolean) as string[];
    return times.sort().at(-1) ?? null;
  }, [quotes]);

  return {
    portfolio,
    transactions,
    alerts,
    quotes,
    usdRate,
    positions,
    valued,
    totals,
    targetWeights,
    lastUpdated,
    loading,
    reloadTx,
    reloadAlerts,
  };
}
