"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Broker } from "@/lib/db/brokers";
import { formatNaira, formatNairaCompact, formatNumber } from "@/lib/format";
import { AS_THEME_CSS } from "@/components/strategies/theme";
import { BROKER_CSS } from "./brokerStyles";

interface Txn {
  source_trade_id: string; cadence: string; symbol: string; company_name: string; side: string;
  entry_price: number; shares: number; amount_ngn: number; weight_pct: number;
  status: string; broker_status: string; close_price: number | null; realized_pnl: number | null;
}
interface Me {
  ok: boolean;
  broker: Broker & { sandbox_key: string; live_key: string };
  transactions: Txn[];
  plan: { intraday: number; weekly: number; monthly: number };
  engine: {
    model_capital: number; execution_mode: string; enabled: boolean;
    risk: { max_position_pct: number; max_adv_pct: number; stop_loss_pct: number; drawdown_halt_pct: number; fx_overlay: boolean };
  };
}

function tone(v: number | null) {
  return v == null || v === 0 ? "" : v > 0 ? "pos" : "neg";
}

export function BrokerPortal({ broker }: { broker: Broker }) {
  const [data, setData] = useState<Me | null>(null);
  const [aumInput, setAumInput] = useState<string>(String(broker.aum_ngn || ""));
  const [savingAum, setSavingAum] = useState(false);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/broker/me", { cache: "no-store" });
    const body = await res.json();
    if (body.ok) {
      setData(body as Me);
      setAumInput(String(body.broker.aum_ngn || ""));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mode = data?.broker.mode ?? broker.mode;

  async function saveAum() {
    setSavingAum(true);
    try {
      await fetch("/api/broker/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "setAum", aum_ngn: Number(aumInput) || 0 }),
      });
      await load();
    } finally {
      setSavingAum(false);
    }
  }

  async function switchMode(next: "sandbox" | "live") {
    if (next === mode) return;
    setSwitching(true);
    try {
      await fetch("/api/broker/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "setMode", mode: next }),
      });
      await load();
    } finally {
      setSwitching(false);
    }
  }

  async function signOut() {
    try {
      await fetch("/api/broker/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    window.location.href = "/broker/login";
  }

  const txns = data?.transactions ?? [];
  const openN = txns.filter((t) => t.status === "open").length;
  const realized = txns.reduce((s, t) => s + (t.realized_pnl ?? 0), 0);

  return (
    <div className="as-shell">
      <style dangerouslySetInnerHTML={{ __html: AS_THEME_CSS + BROKER_CSS }} />

      <header className="bk-header">
        <div className="bk-bar">
          <Link href="/strategies" className="brand">
            <span className="glyph" aria-hidden="true" />
            <span className="name">Alternative&nbsp;<b>Strategies</b></span>
          </Link>
          <nav className="bk-nav">
            <span className="bk-navlink active">Dashboard</span>
            <Link href="/broker/settings" className="bk-navlink">API keys</Link>
            <Link href="/strategies/api-docs" className="bk-navlink">Docs</Link>
          </nav>
          <div className="bk-right">
            <div className="bk-modes" role="group" aria-label="Environment">
              {(["sandbox", "live"] as const).map((m) => (
                <button key={m} disabled={switching} onClick={() => switchMode(m)} className={`bk-mode ${mode === m ? "on " + m : ""}`}>
                  {m}
                </button>
              ))}
            </div>
            <button className="bk-signout" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="bk-main">
        <div className="bk-hero">
          <span className="bk-eyebrow">Execution partner</span>
          <h1>{broker.firm_name}</h1>
          <p>
            The engine allocates its model book to your AUM and serves it over the API. You are viewing your{" "}
            <b className={mode === "live" ? "live" : "sand"}>{mode}</b> environment.
          </p>
        </div>

        {/* KPI strip */}
        <div className="bk-kpis">
          <div className="bk-kpi glass hud"><span className="mono">AUM under engine</span><b>{formatNairaCompact(data?.broker.aum_ngn ?? broker.aum_ngn)}</b></div>
          <div className="bk-kpi glass hud"><span className="mono">Open orders</span><b>{openN}</b></div>
          <div className="bk-kpi glass hud"><span className="mono">Transactions</span><b>{txns.length}</b></div>
          <div className="bk-kpi glass hud"><span className="mono">Realised P&L</span><b className={tone(realized)}>{formatNairaCompact(realized)}</b></div>
        </div>

        <div className="bk-grid">
          {/* AUM */}
          <section className="bk-panel glass hud">
            <h2>Assets under engine</h2>
            <p className="bk-note">The capital you want the engine to trade on your behalf. Signals and sizing scale to this figure.</p>
            <div className="bk-aum">
              <span className="bk-cur">₦</span>
              <input inputMode="numeric" value={aumInput} onChange={(e) => setAumInput(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" />
              <button className="btn btn-primary" onClick={saveAum} disabled={savingAum}>{savingAum ? "Saving…" : "Update AUM"}</button>
            </div>
          </section>

          {/* Allocation plan */}
          <section className="bk-panel glass hud">
            <h2>How your AUM deploys</h2>
            <p className="bk-note">Cadence split &amp; risk limits applied by the engine to your book.</p>
            <div className="bk-alloc">
              {(["intraday", "weekly", "monthly"] as const).map((c) => (
                <div className="bk-alloc-row" key={c}>
                  <span className="bk-alloc-c mono">{c}</span>
                  <span className="bk-alloc-v mono">{formatNairaCompact(data?.plan[c] ?? 0)}</span>
                </div>
              ))}
            </div>
            {data && (
              <div className="bk-risk mono">
                Single-name ≤ {data.engine.risk.max_position_pct}% · ≤ {data.engine.risk.max_adv_pct}% ADV · stop {data.engine.risk.stop_loss_pct}% ·
                drawdown halt {data.engine.risk.drawdown_halt_pct}%{data.engine.risk.fx_overlay ? " · FX overlay" : ""}
              </div>
            )}
          </section>
        </div>

        {/* Transactions */}
        <section className="bk-panel glass hud" style={{ marginTop: 14 }}>
          <div className="bk-panel-head">
            <h2>Transactions <span className="bk-modetag mono">{mode}</span></h2>
            <span className="mono bk-sub">{txns.length} total · {openN} open</span>
          </div>
          {txns.length === 0 ? (
            <p className="bk-empty">
              No transactions yet. When the engine executes trades and your AUM is set, allocations scaled to your book appear
              here and on <span className="mono">GET /api/v1/signals</span>.
            </p>
          ) : (
            <div className="bk-tablewrap">
              <table className="bk-table">
                <thead>
                  <tr>
                    <th>Symbol</th><th>Cadence</th><th className="r">Shares</th><th className="r">Entry</th>
                    <th className="r">Notional</th><th className="r">Status</th><th className="r">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t) => (
                    <tr key={t.source_trade_id}>
                      <td><b>{t.symbol}</b><span className="bk-co">{t.company_name}</span></td>
                      <td className="mono">{t.cadence}</td>
                      <td className="r mono">{formatNumber(t.shares)}</td>
                      <td className="r mono">{formatNaira(t.entry_price)}</td>
                      <td className="r mono">{formatNairaCompact(t.amount_ngn)}</td>
                      <td className="r"><span className={`bk-st ${t.status}`}>{t.status}</span></td>
                      <td className={`r mono ${tone(t.realized_pnl)}`}>{t.realized_pnl == null ? "—" : formatNairaCompact(t.realized_pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="bk-disclaimer mono">
          Simulated / illustrative · orders are scaled from the engine model to your AUM · not investment advice · execution,
          custody and settlement are performed by the regulated broker, not the engine.
        </p>
      </main>
    </div>
  );
}
