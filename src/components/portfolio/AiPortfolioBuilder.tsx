"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, AlertTriangle, Wallet, Plus, Check, Clock, Briefcase } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { Delta } from "@/components/ui/Delta";
import { formatNaira, formatNairaCompact, formatPercent, formatNumber } from "@/lib/format";
import type { BuiltPortfolio, BuiltPosition } from "@/lib/ai/portfolio-builder";
import type { Horizon } from "@/lib/db/paper-trades";

const HORIZONS: { key: Horizon; label: string; sub: string }[] = [
  { key: "intraday", label: "Intraday", sub: "Buy today · sell tomorrow" },
  { key: "weekly", label: "Weekly", sub: "Hold ~1 week" },
  { key: "monthly", label: "Monthly", sub: "Hold ~1 month" },
  { key: "yearly", label: "Yearly", sub: "Hold ~1 year" },
];

export function AiPortfolioBuilder({
  onPaperTradeSaved,
  onPaperPortfolioSaved,
}: {
  onPaperTradeSaved?: () => void;
  onPaperPortfolioSaved?: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [horizon, setHorizon] = useState<Horizon>("monthly");
  const [building, setBuilding] = useState(false);
  const [portfolio, setPortfolio] = useState<BuiltPortfolio | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [ppSaving, setPpSaving] = useState(false);
  const [ppSavedName, setPpSavedName] = useState<string | null>(null);

  async function build() {
    if (!(Number(amount) > 0)) return;
    setBuilding(true);
    setError(null);
    setPortfolio(null);
    setSaved({});
    setPpSavedName(null);
    try {
      const res = await fetch("/api/portfolio-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), currency, horizon }),
      });
      const body = await res.json();
      if (body.ok) setPortfolio(body.portfolio);
      else setError({ message: body.error ?? "Build failed.", code: body.errorCode });
    } catch {
      setError({ message: "Could not reach the server." });
    } finally {
      setBuilding(false);
    }
  }

  async function savePaperTrade(p: BuiltPosition) {
    if (!portfolio) return;
    try {
      const res = await fetch("/api/paper-trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: p.ticker,
          companyName: p.company_name,
          sector: p.sector,
          horizon: portfolio.horizon,
          currency: portfolio.currency,
          entryPrice: p.entry_price,
          shares: p.units,
          amountNgn: p.allocation_ngn,
          rationale: p.rationale,
        }),
      });
      const body = await res.json();
      if (body.ok) {
        setSaved((s) => ({ ...s, [p.ticker]: true }));
        onPaperTradeSaved?.();
      }
    } catch {
      /* ignore per-row */
    }
  }

  async function saveAll() {
    if (!portfolio) return;
    setSavingAll(true);
    for (const p of portfolio.positions) {
      if (!saved[p.ticker]) await savePaperTrade(p);
    }
    setSavingAll(false);
  }

  // Save the whole built book as one paper trading portfolio (recorded separately).
  async function saveAsPortfolio(name: string) {
    if (!portfolio || ppSaving) return;
    setPpSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/paper-portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          horizon: portfolio.horizon,
          currency: portfolio.currency,
          amountInput: portfolio.amount_input,
          budgetNgn: portfolio.budget_ngn,
          marketContext: portfolio.market_context,
          riskNote: portfolio.portfolio_risk_note,
          model: portfolio.model,
          positions: portfolio.positions.map((p) => ({
            symbol: p.ticker,
            companyName: p.company_name,
            sector: p.sector,
            entryPrice: p.entry_price,
            shares: p.units,
            amountNgn: p.allocation_ngn,
            rationale: p.rationale,
          })),
        }),
      });
      const body = await res.json();
      if (body.ok) {
        setPpSavedName(body.portfolio.name);
        onPaperPortfolioSaved?.();
      } else {
        setError({ message: body.error ?? "Could not save the portfolio." });
      }
    } catch {
      setError({ message: "Could not reach the server." });
    } finally {
      setPpSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Panel
        title="AI portfolio builder"
        subtitle="Claude Fable 5 — CIO / Head Trader constructs an institutional NGX book for your budget & horizon"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 flex items-center gap-1 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                <Wallet className="h-3 w-3" /> Amount to deploy
              </span>
              <div className="flex overflow-hidden rounded-lg border border-stone">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={currency === "NGN" ? "e.g. 10,000,000" : "e.g. 10,000"}
                  className="w-48 bg-surface px-3 py-2 font-mono text-[13px] tabular-nums outline-none focus:bg-sand/40"
                />
                {(["NGN", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={
                      currency === c
                        ? "bg-forest px-3 py-2 font-sans text-[12px] font-semibold text-[#F5F2EC]"
                        : "bg-surface px-3 py-2 font-sans text-[12px] text-ink/50 hover:bg-sand"
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <div>
            <span className="mb-1.5 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
              Trading horizon
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {HORIZONS.map((h) => (
                <button
                  key={h.key}
                  onClick={() => setHorizon(h.key)}
                  className={`rounded-lg border p-2.5 text-left transition ${
                    horizon === h.key ? "border-fresh bg-fresh/[0.08]" : "border-stone bg-surface hover:border-fresh/50"
                  }`}
                >
                  <p className="font-sans text-[13px] font-semibold text-forest">{h.label}</p>
                  <p className="font-sans text-[10px] text-ink/50">{h.sub}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={build}
            disabled={building || !(Number(amount) > 0)}
            className="inline-flex items-center gap-2 rounded-lg bg-fresh px-4 py-2 font-sans text-sm font-semibold text-forest hover:brightness-95 disabled:opacity-50"
          >
            {building ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {building ? "Constructing the book…" : portfolio ? "Rebuild portfolio" : "Build portfolio"}
          </button>

          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-3 font-sans text-[12px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error.message}
            </p>
          )}
        </div>
      </Panel>

      {portfolio && (
        <BuiltView
          portfolio={portfolio}
          saved={saved}
          savingAll={savingAll}
          onSave={savePaperTrade}
          onSaveAll={saveAll}
          onSavePortfolio={saveAsPortfolio}
          ppSaving={ppSaving}
          ppSavedName={ppSavedName}
        />
      )}

      <div className="brb-callout py-2">
        <p className="font-sans text-[11px] leading-relaxed text-ink/55">
          Internal, illustrative construction for the analyst&apos;s judgement — not investment advice, not a
          recommendation to any client, and not an order. Positions size to live NGX prices (delayed up to 20 min);
          saving a pick opens a <strong>simulated paper trade</strong> only. Past performance does not indicate
          future results.
        </p>
      </div>
    </div>
  );
}

function BuiltView({
  portfolio,
  saved,
  savingAll,
  onSave,
  onSaveAll,
  onSavePortfolio,
  ppSaving,
  ppSavedName,
}: {
  portfolio: BuiltPortfolio;
  saved: Record<string, boolean>;
  savingAll: boolean;
  onSave: (p: BuiltPosition) => void;
  onSaveAll: () => void;
  onSavePortfolio: (name: string) => void;
  ppSaving: boolean;
  ppSavedName: string | null;
}) {
  const allSaved = portfolio.positions.every((p) => saved[p.ticker]);
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const [ppName, setPpName] = useState(
    `${portfolio.horizon.charAt(0).toUpperCase() + portfolio.horizon.slice(1)} book · ${today}`
  );
  return (
    <Panel
      title="Constructed portfolio"
      subtitle={`${portfolio.horizon} · ${portfolio.positions.length} positions · model ${portfolio.model}`}
      right={
        <button
          onClick={onSaveAll}
          disabled={savingAll || allSaved}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone px-3 py-1.5 font-sans text-[12px] font-semibold text-forest hover:bg-sand disabled:opacity-50"
        >
          {savingAll ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {allSaved ? "All saved" : "Save all as paper trades"}
        </button>
      }
    >
      <div className="space-y-4">
        {/* Save as a paper trading portfolio (grouped, recorded separately) */}
        <div className="rounded-lg border border-fresh/30 bg-fresh/[0.06] p-3">
          {ppSavedName ? (
            <p className="flex items-center gap-2 font-sans text-[12.5px] text-forest">
              <Check className="h-4 w-4 text-forest-soft" />
              Saved <span className="font-semibold">“{ppSavedName}”</span> — view it on the{" "}
              <span className="font-semibold">Paper Trading Portfolio</span> tab.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="block flex-1">
                <span className="mb-1 flex items-center gap-1 font-sans text-[10px] uppercase tracking-eyebrow text-forest-soft">
                  <Briefcase className="h-3 w-3" /> Save as paper trading portfolio
                </span>
                <input
                  value={ppName}
                  onChange={(e) => setPpName(e.target.value)}
                  className="w-full min-w-[12rem] rounded-md border border-stone bg-surface px-2.5 py-1.5 font-sans text-[13px] text-ink"
                />
              </label>
              <button
                onClick={() => onSavePortfolio(ppName.trim() || "AI Paper Book")}
                disabled={ppSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3.5 py-2 font-sans text-[12px] font-semibold text-[#F5F2EC] hover:bg-forest/90 disabled:opacity-50"
              >
                {ppSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Briefcase className="h-3.5 w-3.5" />}
                Save portfolio
              </button>
            </div>
          )}
        </div>

        {/* Budget strip */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Budget" value={formatNairaCompact(portfolio.budget_ngn)} />
          <Stat label="Allocated" value={formatNairaCompact(portfolio.total_allocated_ngn)} />
          <Stat label="Cash residual" value={formatNairaCompact(portfolio.cash_residual_ngn)} />
          <Stat
            label="Wtd. exp. return"
            value={portfolio.weighted_expected_return_pct != null ? formatPercent(portfolio.weighted_expected_return_pct) : "—"}
            tone={portfolio.weighted_expected_return_pct ?? 0}
          />
        </div>
        {portfolio.currency === "USD" && portfolio.fx_rate_used && (
          <p className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/40">
            Converted at ₦{formatNumber(portfolio.fx_rate_used, 2)} / $1 · ${portfolio.amount_input.toLocaleString()} input
          </p>
        )}

        {/* Desk narrative */}
        <div className="space-y-2 rounded-lg border border-stone bg-sand/40 p-3">
          <Narrative label="Market context" text={portfolio.market_context} />
          <Narrative label="Risk posture" text={portfolio.portfolio_risk_note} />
        </div>

        {/* Warnings */}
        {portfolio.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-400/50 bg-amber-50 p-3 dark:bg-amber-950/25">
            <p className="mb-1 flex items-center gap-1.5 font-sans text-[10px] font-semibold uppercase tracking-eyebrow text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" /> Desk warnings
            </p>
            <ul className="space-y-1">
              {portfolio.warnings.map((w, i) => (
                <li key={i} className="font-sans text-[12px] text-amber-800 dark:text-amber-200">
                  · {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Positions */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-[12.5px]">
            <thead>
              <tr className="border-b border-stone font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                <th className="py-1.5 pr-2 font-medium">Stock</th>
                <th className="py-1.5 pr-2 text-right font-medium">Wt</th>
                <th className="py-1.5 pr-2 text-right font-medium">Units</th>
                <th className="py-1.5 pr-2 text-right font-medium">Amount</th>
                <th className="py-1.5 pr-2 text-right font-medium">Entry</th>
                <th className="py-1.5 pr-2 text-right font-medium">Target</th>
                <th className="py-1.5 pr-2 text-right font-medium">Stop</th>
                <th className="py-1.5 pr-2 text-right font-medium">Exp.</th>
                <th className="py-1.5 pr-2 text-right font-medium">Exit</th>
                <th className="py-1.5 pl-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {portfolio.positions.map((p) => (
                <PositionRow key={p.ticker} p={p} saved={!!saved[p.ticker]} onSave={() => onSave(p)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}

function PositionRow({ p, saved, onSave }: { p: BuiltPosition; saved: boolean; onSave: () => void }) {
  return (
    <>
      <tr className="border-t border-stone hover:bg-sand/40">
        <td className="py-2 pr-2">
          <p className="font-semibold text-forest">{p.ticker}</p>
          <p className="text-[10px] uppercase tracking-eyebrow text-ink/40">{p.sector}</p>
        </td>
        <td className="py-2 pr-2 text-right tabular-nums">{formatPercent(p.allocation_pct)}</td>
        <td className="py-2 pr-2 text-right tabular-nums">{p.units.toLocaleString()}</td>
        <td className="py-2 pr-2 text-right tabular-nums font-semibold text-forest">{formatNairaCompact(p.allocation_ngn)}</td>
        <td className="py-2 pr-2 text-right tabular-nums">{formatNaira(p.entry_price)}</td>
        <td className="py-2 pr-2 text-right tabular-nums text-forest-soft">{p.target_price != null ? formatNaira(p.target_price) : "—"}</td>
        <td className="py-2 pr-2 text-right tabular-nums text-loss">{p.stop_loss != null ? formatNaira(p.stop_loss) : "—"}</td>
        <td className="py-2 pr-2 text-right">
          {p.expected_return_pct != null ? <Delta value={p.expected_return_pct} showArrow={false} className="justify-end text-[11px]" /> : "—"}
        </td>
        <td className="py-2 pr-2 text-right tabular-nums text-[11px] text-ink/55">{p.expected_exit_date || "—"}</td>
        <td className="py-2 pl-2 text-right">
          <button
            onClick={onSave}
            disabled={saved}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-sans text-[11px] font-semibold ${
              saved ? "bg-fresh/20 text-forest" : "border border-stone text-forest hover:bg-sand"
            }`}
          >
            {saved ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {saved ? "Saved" : "Paper trade"}
          </button>
        </td>
      </tr>
      <tr className="border-none">
        <td colSpan={10} className="pb-3 pl-0 pr-2 text-[11.5px] leading-snug text-ink/65">
          <span className="font-medium text-forest-soft">{p.company_name}.</span> {p.rationale}
          {p.liquidity_note && <span className="text-ink/45"> · Liquidity: {p.liquidity_note}</span>}
        </td>
      </tr>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  const color = tone == null ? "text-forest" : tone >= 0 ? "text-forest" : "text-loss";
  return (
    <div className="rounded-xl border border-stone bg-surface px-3.5 py-3 shadow-card">
      <p className="font-sans text-[9.5px] font-semibold uppercase tracking-eyebrow text-ink/40">{label}</p>
      <p className={`mt-0.5 font-serif text-base font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function Narrative({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="mb-0.5 font-sans text-[10px] font-semibold uppercase tracking-eyebrow text-forest-soft">{label}</p>
      <p className="font-sans text-[12.5px] leading-relaxed text-ink/75">{text}</p>
    </div>
  );
}
