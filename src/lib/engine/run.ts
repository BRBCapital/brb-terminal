// Job functions: open and close a cadence's simulated positions. These are what
// the scheduler (and the admin "Run now" button) invoke. Each job atomically
// claims a strategy_runs row (dedup), reuses buildPortfolio() for AI selection,
// applies the rules-based risk overlay, persists, and finalises the run row.

import "server-only";
import { buildPortfolio } from "@/lib/ai/portfolio-builder";
import { ngxFetch } from "@/lib/ngx/client";
import type { CompanyDetail, CompanyListRow, ForexCurrent, Paginated } from "@/lib/ngx/types";
import * as repo from "@/lib/db/strategy";
import type { Cadence } from "@/lib/db/strategy";
import { applyRiskOverlay, isDrawdownBreached, resolveAllocation, type EnginePosition } from "./risk";
import { computeFactorSignals } from "./signals";
import { evaluateRegime, exposureMultFor, resolveEffectiveState, type RegimeState } from "./regime";
import { upsertRegimeSnapshot, listRegime } from "@/lib/db/regime";
import { selectDefensiveSleeve } from "./defensive";

export interface RunOutcome {
  status: "success" | "skipped" | "error";
  cadence: Cadence;
  opened?: number;
  closed?: number;
  pnl?: number;
  detail: string;
}

const periodOf = (dateStr: string) => dateStr.slice(0, 7); // YYYY-MM

// --- market context helpers ------------------------------------------------
async function loadUniverse(): Promise<CompanyListRow[]> {
  const res = await ngxFetch<Paginated<CompanyListRow>>({ path: "companies", query: "limit=300" });
  return res.ok ? res.data.data ?? [] : [];
}

async function fxDailyChangePct(): Promise<number> {
  const res = await ngxFetch<ForexCurrent>({ path: "forex/current" });
  if (!res.ok) return 0;
  const usd = res.data.rates?.find((r) => r.currency === "USD");
  return usd?.daily_change_percent ?? 0; // + = NGN depreciation vs USD
}

// --- open ------------------------------------------------------------------
export async function openCadence(
  cadence: Cadence,
  ctx: { runKey: string; trigger: "schedule" | "manual"; dateStr: string }
): Promise<RunOutcome> {
  const kind = `open_${cadence}`;
  const runId = await repo.claimRun(kind, ctx.runKey, ctx.trigger);
  if (!runId) return { status: "skipped", cadence, detail: "already claimed" };

  const finish = (o: RunOutcome) =>
    repo
      .finishRun(runId, {
        status: o.status,
        trades_opened: o.opened ?? 0,
        detail: o.detail,
      })
      .then(() => o);

  try {
    const settings = await repo.getSettings();
    const bucket = resolveAllocation(settings)[cadence];
    if (!(bucket > 0)) return finish({ status: "skipped", cadence, detail: "no capital allocated" });

    // Idempotency: never open the same cadence twice on the same trading day.
    if (await repo.hasOpenTradesOpenedOn(cadence, ctx.dateStr)) {
      return finish({ status: "skipped", cadence, detail: `already opened on ${ctx.dateStr}` });
    }

    // Drawdown halt: pause the cadence if its cumulative realized loss is too deep.
    const all = await repo.listAllTrades();
    const realized = all
      .filter((t) => t.cadence === cadence && t.status === "closed")
      .reduce((s, t) => s + (t.realized_pnl ?? 0), 0);
    if (isDrawdownBreached(realized, bucket, settings.drawdown_halt_pct)) {
      return finish({
        status: "skipped",
        cadence,
        detail: `drawdown halt (realized ${Math.round(realized).toLocaleString()} ≤ -${settings.drawdown_halt_pct}%)`,
      });
    }

    // --- Regime layer (Phase 2): auto de-risk, human-approved re-risk --------
    // When enabled, the market regime scales how much we deploy and gates new
    // entries. De-risking is automatic; re-risking (opening against a risk-off
    // regime) is routed to human approval. Fails safe: no data → no new entries.
    let deployBucket = bucket;
    let regimeForcesPending = false;
    let regimeNote = "";
    let effState: RegimeState | null = null;
    if (settings.regime_enabled) {
      let snapshot;
      try {
        snapshot = await evaluateRegime();
      } catch {
        return finish({ status: "skipped", cadence, detail: "regime feed unavailable — fail-safe: no new entries" });
      }
      await upsertRegimeSnapshot(ctx.dateStr, snapshot).catch(() => {});
      const recent = (await listRegime(Math.max(1, Math.floor(settings.regime_dwell_days) + 1)))
        .filter((r) => r.date < ctx.dateStr)
        .map((r) => r.state);
      effState = resolveEffectiveState(snapshot.state, recent, settings.regime_dwell_days);
      const mult = exposureMultFor(effState, snapshot.score);

      if (effState === "CRISIS") {
        return finish({ status: "skipped", cadence, detail: `regime CRISIS (${Math.round(snapshot.score * 100)}/100) — new entries halted` });
      }
      deployBucket = Math.round(bucket * mult);
      if (!(deployBucket > 0)) {
        return finish({ status: "skipped", cadence, detail: `regime ${effState} — exposure scaled to zero` });
      }
      regimeForcesPending = effState === "RISK_OFF"; // adding risk against the regime needs sign-off
      regimeNote = ` · regime ${effState} @ ${Math.round(mult * 100)}% exposure`;
    }

    // Live universe + FX (used for both selection and the risk overlay).
    const [universe, fxPct] = await Promise.all([loadUniverse(), fxDailyChangePct()]);
    const volumeBySymbol: Record<string, number> = {};
    const rangePctBySymbol: Record<string, number> = {};
    for (const r of universe) {
      const sym = r.symbol?.toUpperCase();
      if (!sym) continue;
      volumeBySymbol[sym] = r.volume ?? 0;
      if (r.high_52wk != null && r.low_52wk != null && r.price) {
        rangePctBySymbol[sym] = (r.high_52wk - r.low_52wk) / r.price;
      }
    }
    const signalsBySymbol = new Map(computeFactorSignals(universe, 300).map((s) => [s.symbol, s]));

    // Selection: on a risk-off regime rotate into the DEFENSIVE sleeve
    // (deterministic, low-vol/defensive-sector); otherwise the AI momentum book.
    const defensive = settings.regime_enabled && effState === "RISK_OFF";
    let positions: EnginePosition[];
    let model = "regime-defensive";
    let marketContext = "Risk-off — defensive rotation";
    let baseRiskNote = "";
    if (defensive) {
      const sleeve = selectDefensiveSleeve({ universe, bucketNgn: deployBucket, settings });
      positions = sleeve.positions;
      baseRiskNote = sleeve.note;
      regimeNote += " · defensive sleeve";
      if (!positions.length) {
        return finish({ status: "skipped", cadence, detail: "regime RISK_OFF — no defensive names available" });
      }
    } else {
      const build = await buildPortfolio({ amount: deployBucket, currency: "NGN", horizon: cadence });
      if (!build.ok || !build.portfolio) {
        return finish({ status: "error", cadence, detail: build.error ?? "builder returned no portfolio" });
      }
      model = build.portfolio.model;
      marketContext = build.portfolio.market_context;
      baseRiskNote = build.portfolio.portfolio_risk_note;
      positions = build.portfolio.positions.map((p) => ({
        ticker: p.ticker,
        company_name: p.company_name,
        sector: p.sector,
        entry_price: p.entry_price,
        units: p.units,
        amount_ngn: p.allocation_ngn,
        target_price: p.target_price,
        stop_loss: p.stop_loss,
        rationale: p.rationale,
      }));
    }

    const overlay = applyRiskOverlay({
      positions,
      bucketNgn: deployBucket,
      settings,
      volumeBySymbol,
      rangePctBySymbol,
      fxDailyChangePct: fxPct,
    });

    if (!overlay.positions.length) {
      return finish({ status: "skipped", cadence, detail: "no positions passed risk caps" });
    }

    const period = periodOf(ctx.dateStr);
    const riskNote =
      `${baseRiskNote}` +
      (overlay.adjustments.length ? ` | Risk overlay: ${overlay.adjustments.join("; ")}` : "");
    const portfolioId = await repo.upsertActivePortfolio({
      cadence,
      period,
      capital_ngn: deployBucket,
      model,
      market_context: marketContext,
      risk_note: riskNote,
    });

    // Full automation executes immediately; human-approval mode queues the book
    // as pending proposals until an admin approves each one.
    const manual = settings.execution_mode === "manual";
    const pending = manual || regimeForcesPending; // regime risk-off ⇒ human approval
    const opened = await repo.insertTrades({
      portfolioId,
      cadence,
      period,
      openedOn: ctx.dateStr,
      status: pending ? "pending" : "open",
      trades: overlay.positions.map((p) => {
        const sig = signalsBySymbol.get(p.ticker);
        return {
          symbol: p.ticker,
          company_name: p.company_name,
          sector: p.sector,
          entry_price: p.entry_price,
          shares: p.units,
          amount_ngn: p.amount_ngn,
          target_price: p.target_price,
          stop_loss: p.stop_loss,
          signal: sig
            ? JSON.stringify({
                composite: sig.composite,
                momentum: sig.momentum,
                liquidity: sig.liquidity,
                volatility: sig.volatility,
                value: sig.value,
              })
            : "",
          rationale: p.rationale,
        };
      }),
    });

    return finish({
      status: "success",
      cadence,
      opened,
      detail: `${pending ? "proposed" : "opened"} ${opened} position(s)${
        pending ? " for approval" : ""
      } · bucket ₦${Math.round(deployBucket).toLocaleString()}${regimeNote}${
        overlay.adjustments.length ? ` · ${overlay.adjustments.length} risk adj.` : ""
      }`,
    });
  } catch (err) {
    return finish({ status: "error", cadence, detail: (err as Error)?.message ?? "run failed" });
  }
}

// --- close -----------------------------------------------------------------
export async function closeCadence(
  cadence: Cadence,
  ctx: { runKey: string; trigger: "schedule" | "manual"; dateStr: string; mode: "scheduled" | "manual" }
): Promise<RunOutcome> {
  const kind = `close_${cadence}`;
  const runId = await repo.claimRun(kind, ctx.runKey, ctx.trigger);
  if (!runId) return { status: "skipped", cadence, detail: "already claimed" };

  const finish = (o: RunOutcome) =>
    repo
      .finishRun(runId, {
        status: o.status,
        trades_closed: o.closed ?? 0,
        pnl: o.pnl ?? 0,
        detail: o.detail,
      })
      .then(() => o);

  try {
    const open = await repo.listOpenTrades(cadence);
    // Intraday scheduled close = positions opened on a PRIOR trading day (held
    // overnight, closed at the next day's bell). Weekly/monthly scheduled close,
    // and any manual close, close the whole open book for the cadence.
    const scope =
      ctx.mode === "scheduled" && cadence === "intraday"
        ? open.filter((t) => t.opened_on < ctx.dateStr)
        : open;

    if (!scope.length) return finish({ status: "skipped", cadence, detail: "no open positions to close" });

    // One live-price fetch per distinct symbol.
    const symbols = [...new Set(scope.map((t) => t.symbol.toUpperCase()))];
    const priceBy: Record<string, number | null> = {};
    await Promise.all(
      symbols.map(async (sym) => {
        const res = await ngxFetch<CompanyDetail>({ path: `companies/${sym}`, skipCache: true });
        priceBy[sym] = res.ok ? res.data.current_price ?? res.data.prev_close ?? null : null;
      })
    );

    let closed = 0;
    let pnl = 0;
    for (const t of scope) {
      const px = priceBy[t.symbol.toUpperCase()] ?? t.entry_price; // fall back flat if no quote
      const realized = await repo.closeTrade(
        t.id,
        px,
        ctx.mode === "manual" ? "manual close" : `${cadence} scheduled close`
      );
      closed++;
      pnl += realized;
    }

    return finish({
      status: "success",
      cadence,
      closed,
      pnl,
      detail: `closed ${closed} position(s), realized ₦${Math.round(pnl).toLocaleString()}`,
    });
  } catch (err) {
    return finish({ status: "error", cadence, detail: (err as Error)?.message ?? "close failed" });
  }
}
