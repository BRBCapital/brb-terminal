"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { formatNaira } from "@/lib/format";
import type { FactorSignal } from "@/lib/engine/signals";
import { ScoreBar, toneClass, pct } from "./ui";

export function SignalsTab() {
  const [signals, setSignals] = useState<FactorSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/engine/signals", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => {
        if (!cancelled) setSignals(b.ok ? b.signals ?? [] : []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return (
    <Panel
      title="Factor signal leaderboard"
      subtitle="Computed momentum / liquidity / volatility / range-value — ranked by composite (illustrative)"
      right={
        <button
          onClick={() => setNonce((n) => n + 1)}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-full border border-stone px-2.5 py-1 font-sans text-[11px] text-forest hover:bg-sand disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      }
    >
      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-stone/60" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left font-sans text-[12px]">
            <thead>
              <tr className="border-b border-stone text-[10px] uppercase tracking-eyebrow text-ink/45">
                <th className="py-2 pr-2">#</th>
                <th className="pr-2">Stock</th>
                <th className="px-2 text-right">Price</th>
                <th className="px-2 text-right">1M</th>
                <th className="px-2">Composite</th>
                <th className="px-2">Momentum</th>
                <th className="px-2">Liquidity</th>
                <th className="px-2">Value</th>
                <th className="px-2">Volatility</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s, i) => (
                <tr key={s.symbol} className="border-b border-stone/60">
                  <td className="py-1.5 pr-2 tabular-nums text-ink/40">{i + 1}</td>
                  <td className="pr-2">
                    <Link href={`/stocks/${s.symbol}`} className="font-sans text-[11px] font-bold uppercase text-forest hover:underline">
                      {s.symbol}
                    </Link>
                    <div className="font-sans text-[10px] text-ink/45">{s.sector}</div>
                  </td>
                  <td className="px-2 text-right tabular-nums">{formatNaira(s.price)}</td>
                  <td className={`px-2 text-right tabular-nums ${toneClass(s.chg_1m)}`}>{pct(s.chg_1m)}</td>
                  <td className="px-2"><ScoreBar value={s.composite} /></td>
                  <td className="px-2"><ScoreBar value={s.momentum} /></td>
                  <td className="px-2"><ScoreBar value={s.liquidity} /></td>
                  <td className="px-2"><ScoreBar value={s.value} /></td>
                  <td className="px-2"><ScoreBar value={s.volatility} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
