"use client";

import { useState } from "react";
import { Play, Square, Save, Power, RefreshCw, Trash2, ShieldCheck, Zap, Gauge } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { formatNairaCompact } from "@/lib/format";
import type { Cadence, StrategySettings } from "@/lib/db/strategy";
import { CadenceTag } from "./ui";
import { BrokersPanel } from "./BrokersPanel";

type Form = Pick<
  StrategySettings,
  | "enabled"
  | "execution_mode"
  | "allocation_mode"
  | "total_capital_ngn"
  | "intraday_pct"
  | "weekly_pct"
  | "monthly_pct"
  | "intraday_capital"
  | "weekly_capital"
  | "monthly_capital"
  | "max_position_pct"
  | "max_adv_pct"
  | "stop_loss_pct"
  | "drawdown_halt_pct"
  | "fx_overlay"
  | "regime_enabled"
  | "regime_dwell_days"
>;

const CADENCES: Cadence[] = ["intraday", "weekly", "monthly"];

export function SettingsTab({ settings, onChanged }: { settings: StrategySettings; onChanged: () => void }) {
  const [f, setF] = useState<Form>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [confirmAuto, setConfirmAuto] = useState(false);
  const [confirmRegime, setConfirmRegime] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const numSet = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as Form[typeof k]);

  const pctSum = f.intraday_pct + f.weekly_pct + f.monthly_pct;

  async function save(patch: Partial<Form>) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/engine/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (body.ok) {
        setF({ ...body.settings });
        setMsg("Saved.");
        onChanged();
      } else {
        setMsg(body.error ?? "Could not save.");
      }
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  async function resetLedger() {
    if (!resetPw) {
      setResetMsg("Enter your admin password to confirm.");
      return;
    }
    setResetting(true);
    setResetMsg(null);
    try {
      const res = await fetch("/api/engine/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPw }),
      });
      const body = await res.json();
      if (body.ok) {
        setResetMsg(`Ledger cleared — ${body.trades} trades, ${body.portfolios} profiles, ${body.runs} runs removed.`);
        setConfirmReset(false);
        setResetPw("");
        onChanged();
      } else {
        // Keep the confirm open so the admin can retry the password.
        setResetMsg(body.error ?? "Could not reset the ledger.");
      }
    } catch {
      setResetMsg("Could not reach the server.");
    } finally {
      setResetting(false);
    }
  }

  async function runNow(action: "open" | "close", cadence: Cadence) {
    setRunning(`${action}:${cadence}`);
    setRunMsg(`Running ${action} ${cadence}… (opening a cadence runs an AI build — this can take a minute)`);
    try {
      const res = await fetch("/api/engine/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, cadence }),
      });
      const body = await res.json();
      const o = body.outcome;
      setRunMsg(o ? `${action} ${cadence}: ${o.status} — ${o.detail}` : body.error ?? "Run failed.");
      onChanged();
    } catch {
      setRunMsg("Could not reach the server.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Governance gate */}
      <Panel title="Governance" subtitle="Master switch — the engine only trades when enabled">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                f.enabled ? "bg-fresh/20 text-forest" : "bg-stone text-ink/50"
              }`}
            >
              <Power className="h-4 w-4" />
            </span>
            <div>
              <p className="font-serif text-base font-semibold text-forest">
                Engine {f.enabled ? "ACTIVE" : "PAUSED"}
              </p>
              <p className="font-sans text-[11px] text-ink/55">
                {f.enabled
                  ? "The scheduler will fire cadence jobs at the NGX open/close windows."
                  : "No scheduled trades will fire. Use “Run now” below to test on demand."}
              </p>
            </div>
          </div>
          <button
            onClick={() => save({ enabled: !f.enabled })}
            disabled={saving}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-sans text-sm font-semibold disabled:opacity-50 ${
              f.enabled ? "border border-loss/40 text-loss hover:bg-loss/5" : "bg-fresh text-forest hover:brightness-95"
            }`}
          >
            <Power className="h-4 w-4" />
            {f.enabled ? "Pause engine" : "Enable engine"}
          </button>
        </div>
      </Panel>

      {/* Execution mode — full automation vs human approval */}
      <Panel title="Trade execution" subtitle="Who executes the trades the engine generates">
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Human approval */}
          <button
            onClick={() => {
              setConfirmAuto(false);
              if (f.execution_mode !== "manual") save({ execution_mode: "manual" });
            }}
            disabled={saving}
            className={`rounded-xl border p-3.5 text-left transition-colors disabled:opacity-50 ${
              f.execution_mode === "manual" ? "border-fresh bg-fresh/[0.06] ring-1 ring-fresh/30" : "border-stone hover:bg-sand"
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-forest-soft" />
              <span className="font-serif text-sm font-semibold text-forest">Human approval</span>
              {f.execution_mode === "manual" && <span className="ml-auto rounded-full bg-fresh/20 px-2 py-0.5 font-sans text-[10px] font-semibold text-forest">Active</span>}
            </div>
            <p className="mt-1.5 font-sans text-[11px] leading-relaxed text-ink/60">
              Automated execution is paused. Every generated trade waits in <strong>Approvals</strong> for an admin to approve
              before it goes live. Governed posture.
            </p>
          </button>

          {/* Full automation */}
          <button
            onClick={() => {
              if (f.execution_mode === "auto") return;
              setConfirmAuto(true);
            }}
            disabled={saving}
            className={`rounded-xl border p-3.5 text-left transition-colors disabled:opacity-50 ${
              f.execution_mode === "auto" ? "border-amber-400 bg-amber-50/60 ring-1 ring-amber-300/40 dark:bg-amber-950/20" : "border-stone hover:bg-sand"
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" />
              <span className="font-serif text-sm font-semibold text-forest">Full automation</span>
              {f.execution_mode === "auto" && <span className="ml-auto rounded-full bg-amber-400/25 px-2 py-0.5 font-sans text-[10px] font-semibold text-amber-700 dark:text-amber-300">Active</span>}
            </div>
            <p className="mt-1.5 font-sans text-[11px] leading-relaxed text-ink/60">
              The engine executes every generated trade automatically, with <strong>no human approval</strong>. Fastest, fully
              hands-off — still simulated only.
            </p>
          </button>
        </div>

        {confirmAuto && f.execution_mode !== "auto" && (
          <div className="mt-3 rounded-xl border border-amber-400/50 bg-amber-50/70 p-3 dark:bg-amber-950/20">
            <p className="font-sans text-[12px] leading-relaxed text-ink/75">
              <strong className="text-amber-700 dark:text-amber-300">Switch to full automation?</strong> Trades will execute
              automatically without human review or a governance gate. Any proposals currently in the Approvals queue stay
              pending until you clear them. This engine is simulated — no real orders are placed.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={() => {
                  save({ execution_mode: "auto" });
                  setConfirmAuto(false);
                }}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 font-sans text-[12px] font-semibold text-white hover:brightness-95 disabled:opacity-50"
              >
                <Zap className="h-3.5 w-3.5" /> Enable full automation
              </button>
              <button
                onClick={() => setConfirmAuto(false)}
                className="rounded-lg border border-stone px-3 py-1.5 font-sans text-[12px] text-forest hover:bg-sand"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Panel>

      {/* Broker accounts */}
      <BrokersPanel />

      {/* Allocation */}
      <Panel title="Capital allocation" subtitle="How the book is split across cadences">
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["auto", "manual"] as const).map((m) => (
              <button
                key={m}
                onClick={() => set("allocation_mode", m)}
                className={`rounded-full px-3 py-1 font-sans text-[12px] font-medium ${
                  f.allocation_mode === m ? "bg-forest text-[#F5F2EC]" : "border border-stone text-forest hover:bg-sand"
                }`}
              >
                {m === "auto" ? "Auto (% split)" : "Manual (₦ per cadence)"}
              </button>
            ))}
          </div>

          {f.allocation_mode === "auto" ? (
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Total capital (₦)" value={f.total_capital_ngn} onChange={numSet("total_capital_ngn")} step={1_000_000} />
              <Field label="Intraday %" value={f.intraday_pct} onChange={numSet("intraday_pct")} />
              <Field label="Weekly %" value={f.weekly_pct} onChange={numSet("weekly_pct")} />
              <Field label="Monthly %" value={f.monthly_pct} onChange={numSet("monthly_pct")} />
              <p className={`sm:col-span-4 font-sans text-[11px] ${Math.round(pctSum) === 100 ? "text-ink/50" : "text-loss"}`}>
                Split sums to {pctSum}% {Math.round(pctSum) === 100 ? "" : "— should total 100%"} · Intraday{" "}
                {formatNairaCompact((f.total_capital_ngn * f.intraday_pct) / 100)} · Weekly{" "}
                {formatNairaCompact((f.total_capital_ngn * f.weekly_pct) / 100)} · Monthly{" "}
                {formatNairaCompact((f.total_capital_ngn * f.monthly_pct) / 100)}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Intraday capital (₦)" value={f.intraday_capital} onChange={numSet("intraday_capital")} step={1_000_000} />
              <Field label="Weekly capital (₦)" value={f.weekly_capital} onChange={numSet("weekly_capital")} step={1_000_000} />
              <Field label="Monthly capital (₦)" value={f.monthly_capital} onChange={numSet("monthly_capital")} step={1_000_000} />
            </div>
          )}
        </div>
      </Panel>

      {/* Risk */}
      <Panel title="Risk management" subtitle="Applied on top of every AI-selected book">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Max single name %" value={f.max_position_pct} onChange={numSet("max_position_pct")} />
          <Field label="Max % of daily volume" value={f.max_adv_pct} onChange={numSet("max_adv_pct")} />
          <Field label="Stop-loss %" value={f.stop_loss_pct} onChange={numSet("stop_loss_pct")} />
          <Field label="Drawdown halt %" value={f.drawdown_halt_pct} onChange={numSet("drawdown_halt_pct")} />
        </div>
        <label className="mt-3 flex items-center gap-2 font-sans text-[12px] text-ink/70">
          <input type="checkbox" checked={f.fx_overlay} onChange={(e) => set("fx_overlay", e.target.checked)} />
          FX overlay — haircut import-sensitive sectors on NGN depreciation
        </label>
      </Panel>

      {/* Regime layer (Phase 2) */}
      <Panel title="Regime layer" subtitle="Scale sizing & gate entries by the market regime (bull/bear)">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${f.regime_enabled ? "bg-fresh/20 text-forest" : "bg-stone text-ink/50"}`}>
              <Gauge className="h-4 w-4" />
            </span>
            <div>
              <p className="font-serif text-base font-semibold text-forest">Regime layer {f.regime_enabled ? "LIVE" : "SHADOW"}</p>
              <p className="max-w-lg font-sans text-[11px] leading-relaxed text-ink/55">
                {f.regime_enabled
                  ? "The regime scales how much is deployed and gates entries. De-risking is automatic; opening against a risk-off regime goes to Approvals; CRISIS halts new entries."
                  : "Observing only — see the Regime tab. Turn on to let the market regime scale sizing and gate entries (automatic de-risking, human-approved re-risking)."}
              </p>
            </div>
          </div>
          <button
            onClick={() => { if (f.regime_enabled) save({ regime_enabled: false }); else setConfirmRegime(true); }}
            disabled={saving}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-sans text-sm font-semibold disabled:opacity-50 ${f.regime_enabled ? "border border-loss/40 text-loss hover:bg-loss/5" : "bg-fresh text-forest hover:brightness-95"}`}
          >
            <Gauge className="h-4 w-4" /> {f.regime_enabled ? "Back to shadow" : "Enable regime layer"}
          </button>
        </div>

        {confirmRegime && !f.regime_enabled && (
          <div className="mt-3 rounded-xl border border-fresh/40 bg-fresh/[0.06] p-3">
            <p className="font-sans text-[12px] leading-relaxed text-ink/75">
              <strong className="text-forest">Enable the regime layer?</strong> From now on the engine will size positions by the
              live regime and <strong>pause new entries in bear regimes</strong> (RISK_OFF routes to Approvals; CRISIS halts).
              De-risking is automatic; re-risking needs approval. Still simulated — no real orders.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <button onClick={() => { save({ regime_enabled: true }); setConfirmRegime(false); }} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-fresh px-3 py-1.5 font-sans text-[12px] font-semibold text-forest hover:brightness-95 disabled:opacity-50">
                <Gauge className="h-3.5 w-3.5" /> Enable
              </button>
              <button onClick={() => setConfirmRegime(false)} className="rounded-lg border border-stone px-3 py-1.5 font-sans text-[12px] text-forest hover:bg-sand">Cancel</button>
            </div>
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <Field label="Re-risk dwell (days)" value={f.regime_dwell_days} onChange={numSet("regime_dwell_days")} />
          <p className="sm:col-span-3 self-end font-sans text-[11px] text-ink/45">
            Consecutive clear days required before the engine re-risks after a bear regime (hysteresis). De-risking is always immediate.
          </p>
        </div>
      </Panel>

      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            save({
              regime_enabled: f.regime_enabled,
              regime_dwell_days: f.regime_dwell_days,
              allocation_mode: f.allocation_mode,
              total_capital_ngn: f.total_capital_ngn,
              intraday_pct: f.intraday_pct,
              weekly_pct: f.weekly_pct,
              monthly_pct: f.monthly_pct,
              intraday_capital: f.intraday_capital,
              weekly_capital: f.weekly_capital,
              monthly_capital: f.monthly_capital,
              max_position_pct: f.max_position_pct,
              max_adv_pct: f.max_adv_pct,
              stop_loss_pct: f.stop_loss_pct,
              drawdown_halt_pct: f.drawdown_halt_pct,
              fx_overlay: f.fx_overlay,
            })
          }
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-fresh px-4 py-2 font-sans text-sm font-semibold text-forest hover:brightness-95 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
        </button>
        {msg && <span className="font-sans text-[12px] text-ink/60">{msg}</span>}
      </div>

      {/* Run now */}
      <Panel title="Run now" subtitle="Fire a cadence job on demand (works while paused — for testing / governance)">
        <div className="space-y-2">
          {CADENCES.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <span className="w-20"><CadenceTag cadence={c} /></span>
              <button
                onClick={() => runNow("open", c)}
                disabled={!!running}
                className="inline-flex items-center gap-1 rounded-md border border-stone px-2.5 py-1 font-sans text-[12px] text-forest hover:bg-sand disabled:opacity-50"
              >
                {running === `open:${c}` ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Open
              </button>
              <button
                onClick={() => runNow("close", c)}
                disabled={!!running}
                className="inline-flex items-center gap-1 rounded-md border border-stone px-2.5 py-1 font-sans text-[12px] text-forest hover:bg-sand disabled:opacity-50"
              >
                {running === `close:${c}` ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />} Close
              </button>
            </div>
          ))}
          {runMsg && <p className="mt-2 rounded-lg border border-dashed border-stone bg-sand/40 p-2 font-sans text-[12px] text-ink/70 dark:bg-surface">{runMsg}</p>}
        </div>
      </Panel>

      {/* Danger zone */}
      <section className="rounded-xl border border-loss/30 bg-loss/[0.03] p-4">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-loss">Danger zone</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md font-sans text-[12px] leading-relaxed text-ink/60">
            Permanently delete every simulated trade, monthly profile and run record. Settings (capital &amp;
            risk) are kept. Use this to clear test data or start a clean track record.{" "}
            <span className="font-semibold text-loss/80">Requires your admin password.</span>
          </p>
          {confirmReset ? (
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <input
                type="password"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") resetLedger();
                }}
                placeholder="Admin password"
                autoComplete="current-password"
                autoFocus
                className="w-44 rounded-lg border border-stone bg-surface px-3 py-2 font-sans text-[12px] text-ink outline-none focus:border-loss"
              />
              <button
                onClick={resetLedger}
                disabled={resetting || !resetPw}
                title="Re-enter your admin password to confirm this destructive action"
                className="inline-flex items-center gap-1.5 rounded-lg bg-loss px-3 py-2 font-sans text-[12px] font-semibold text-white hover:brightness-95 disabled:opacity-50"
              >
                {resetting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Confirm reset
              </button>
              <button
                onClick={() => {
                  setConfirmReset(false);
                  setResetPw("");
                  setResetMsg(null);
                }}
                disabled={resetting}
                className="rounded-lg border border-stone px-3 py-2 font-sans text-[12px] text-forest hover:bg-sand"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setConfirmReset(true);
                setResetMsg(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-loss/40 px-3 py-2 font-sans text-[12px] font-semibold text-loss hover:bg-loss/5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Reset engine ledger
            </button>
          )}
        </div>
        {resetMsg && <p className="mt-2 font-sans text-[12px] text-ink/70">{resetMsg}</p>}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={onChange}
        className="mt-1 w-full rounded-lg border border-stone bg-surface px-2.5 py-1.5 font-sans text-[13px] tabular-nums text-ink outline-none focus:border-fresh"
      />
    </label>
  );
}
