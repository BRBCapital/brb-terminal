"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Plus, RefreshCw, KeyRound, Copy, Check } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { formatNairaCompact } from "@/lib/format";
import type { Broker, BrokerWithKeys } from "@/lib/db/brokers";

export function BrokersPanel() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firm_name: "", contact_name: "", email: "", password: "", aum_ngn: "" });
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<BrokerWithKeys | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<Broker | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/engine/brokers", { cache: "no-store" });
      const body = await res.json();
      if (body.ok) setBrokers(body.brokers);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setCreating(true);
    setErr(null);
    setCreated(null);
    try {
      const res = await fetch("/api/engine/brokers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, aum_ngn: Number(form.aum_ngn) || 0 }),
      });
      const body = await res.json();
      if (body.ok) {
        setCreated(body.broker);
        setForm({ firm_name: "", contact_name: "", email: "", password: "", aum_ngn: "" });
        setShowForm(false);
        await load();
      } else {
        setErr(body.error ?? "Could not create broker.");
      }
    } catch {
      setErr("Could not reach the server.");
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: string, action: "suspend" | "activate") {
    setBusy(id);
    try {
      await fetch(`/api/engine/brokers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword() {
    if (!resetFor) return;
    if (resetPw.length < 8) { setResetMsg("Password must be at least 8 characters."); return; }
    setBusy(resetFor.id);
    setResetMsg(null);
    try {
      const res = await fetch(`/api/engine/brokers/${resetFor.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetPassword", password: resetPw }),
      });
      const body = await res.json();
      if (body.ok) { setResetMsg(`Password reset for ${resetFor.firm_name} — their active sessions were revoked.`); setResetFor(null); setResetPw(""); }
      else setResetMsg(body.error ?? "Could not reset password.");
    } catch {
      setResetMsg("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  const copy = async (label: string, val: string) => {
    try { await navigator.clipboard.writeText(val); setCopied(label); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  return (
    <Panel
      title="Broker accounts"
      subtitle="Execution partners that integrate the engine API"
      right={
        <button
          onClick={() => { setShowForm((s) => !s); setCreated(null); setErr(null); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-1.5 font-sans text-[12px] font-semibold text-[#F5F2EC] hover:brightness-110"
        >
          <Plus className="h-3.5 w-3.5" /> New broker
        </button>
      }
    >
      {/* one-time key reveal after creation */}
      {created && (
        <div className="mb-3 rounded-xl border border-fresh/40 bg-fresh/[0.06] p-3">
          <p className="flex items-center gap-1.5 font-sans text-[12px] font-semibold text-forest">
            <KeyRound className="h-3.5 w-3.5" /> {created.firm_name} created — share these keys securely (shown once)
          </p>
          {(["sandbox_key", "live_key"] as const).map((k) => (
            <div key={k} className="mt-2 flex items-center gap-2">
              <span className="w-16 font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">{k === "sandbox_key" ? "Sandbox" : "Live"}</span>
              <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-stone bg-surface px-2 py-1.5 font-mono text-[11px] text-ink">{created[k]}</code>
              <button onClick={() => copy(k, created[k])} className="inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1.5 font-sans text-[11px] text-forest hover:bg-sand">
                {copied === k ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          ))}
          <p className="mt-2 font-sans text-[11px] text-ink/50">Login: <b>{created.email}</b> at <b>/broker/login</b>. The broker sets their own AUM and can rotate keys.</p>
        </div>
      )}

      {/* create form */}
      {showForm && (
        <div className="mb-3 rounded-xl border border-stone bg-sand/30 p-3 dark:bg-surface">
          {err && <p className="mb-2 rounded-md bg-loss/10 px-2 py-1.5 font-sans text-[12px] text-loss">{err}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <TextField label="Firm name" value={form.firm_name} onChange={(v) => setForm((f) => ({ ...f, firm_name: v }))} placeholder="Lagos Alpha Securities" />
            <TextField label="Contact name" value={form.contact_name} onChange={(v) => setForm((f) => ({ ...f, contact_name: v }))} placeholder="Desk contact" />
            <TextField label="Login email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="ops@broker.com" type="email" />
            <TextField label="Temp password (min 8)" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} placeholder="••••••••" type="password" />
            <TextField label="Initial AUM (₦, optional)" value={form.aum_ngn} onChange={(v) => setForm((f) => ({ ...f, aum_ngn: v.replace(/[^0-9.]/g, "") }))} placeholder="0" />
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <button onClick={create} disabled={creating} className="inline-flex items-center gap-1.5 rounded-lg bg-fresh px-3 py-1.5 font-sans text-[12px] font-semibold text-forest hover:brightness-95 disabled:opacity-50">
              {creating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create broker
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-stone px-3 py-1.5 font-sans text-[12px] text-forest hover:bg-sand">Cancel</button>
          </div>
        </div>
      )}

      {/* reset password */}
      {resetFor && (
        <div className="mb-3 rounded-xl border border-amber-400/50 bg-amber-50/70 p-3 dark:bg-amber-950/20">
          <p className="font-sans text-[12px] font-semibold text-forest">Reset password — {resetFor.firm_name}</p>
          <p className="mb-2 font-sans text-[11px] text-ink/55">Sets a new temporary password and signs the broker out everywhere. Share it securely; they can change it later.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              placeholder="New temp password (min 8)"
              className="w-56 rounded-lg border border-stone bg-surface px-3 py-2 font-sans text-[12px] text-ink outline-none focus:border-amber-400"
            />
            <button onClick={resetPassword} disabled={busy === resetFor.id || resetPw.length < 8} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 font-sans text-[12px] font-semibold text-white hover:brightness-95 disabled:opacity-50">
              {busy === resetFor.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />} Reset password
            </button>
            <button onClick={() => { setResetFor(null); setResetPw(""); }} className="rounded-lg border border-stone px-3 py-2 font-sans text-[12px] text-forest hover:bg-sand">Cancel</button>
          </div>
        </div>
      )}
      {resetMsg && !resetFor && <p className="mb-3 font-sans text-[12px] text-ink/70">{resetMsg}</p>}

      {/* list */}
      {loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-stone/60" />
      ) : brokers.length === 0 ? (
        <p className="flex items-center gap-2 py-6 text-center font-sans text-[12px] text-ink/45"><Building2 className="h-4 w-4" /> No broker accounts yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left font-sans text-[12.5px]">
            <thead>
              <tr className="border-b border-stone text-[10px] uppercase tracking-eyebrow text-ink/45">
                <th className="py-2 pr-2">Firm</th><th className="px-2">Email</th><th className="px-2 text-right">AUM</th><th className="px-2">Mode</th><th className="px-2">Status</th><th className="pl-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {brokers.map((b) => (
                <tr key={b.id} className="border-b border-stone/60">
                  <td className="py-2 pr-2 font-medium text-forest">{b.firm_name}</td>
                  <td className="px-2 text-ink/70">{b.email}</td>
                  <td className="px-2 text-right tabular-nums">{formatNairaCompact(b.aum_ngn)}</td>
                  <td className="px-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${b.mode === "live" ? "bg-amber-400/20 text-amber-700 dark:text-amber-300" : "bg-fresh/15 text-forest"}`}>{b.mode}</span></td>
                  <td className="px-2"><span className={`text-[11px] font-medium ${b.status === "active" ? "text-forest" : "text-loss"}`}>{b.status}</span></td>
                  <td className="pl-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => { setResetFor(b); setResetPw(""); setResetMsg(null); }}
                        disabled={busy === b.id}
                        className="rounded-md border border-stone px-2 py-1 font-sans text-[11px] text-forest hover:bg-sand disabled:opacity-50"
                      >
                        Reset PW
                      </button>
                      <button
                        onClick={() => setStatus(b.id, b.status === "active" ? "suspend" : "activate")}
                        disabled={busy === b.id}
                        className="rounded-md border border-stone px-2 py-1 font-sans text-[11px] text-forest hover:bg-sand disabled:opacity-50"
                      >
                        {b.status === "active" ? "Suspend" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function TextField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-stone bg-surface px-2.5 py-1.5 font-sans text-[13px] text-ink outline-none focus:border-fresh"
      />
    </label>
  );
}
