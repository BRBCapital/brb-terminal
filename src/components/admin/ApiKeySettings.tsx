"use client";

import { useEffect, useState } from "react";
import { KeyRound, Check, RefreshCw, Trash2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Panel } from "@/components/ui/Tile";

interface KeyStatus {
  provider: string;
  label: string;
  subtitle: string;
  placeholder: string;
  docUrl: string;
  docLabel: string;
  configured: boolean;
  source: "database" | "env" | null;
  masked: string | null;
  updatedBy?: string;
  updatedAt?: string;
}

export function ApiKeySettings({ provider }: { provider: "anthropic" | "ngnmarket" }) {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);

  const url = `/api/settings/keys/${provider}`;

  async function load() {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const b = await res.json();
      if (b.ok) setStatus(b.status);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  async function save() {
    if (!value.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: value.trim() }),
      });
      const b = await res.json();
      if (b.ok) {
        setStatus(b.status);
        setValue("");
        setShow(false);
        if (b.tested) setMsg({ kind: "ok", text: "Key saved and verified with a live call. It's active now." });
        else setMsg({ kind: "warn", text: b.testError ?? "Key saved. It will be used on the next request." });
      } else {
        setMsg({ kind: "err", text: b.error ?? "Could not save the key." });
      }
    } catch {
      setMsg({ kind: "err", text: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "DELETE" });
      const b = await res.json();
      if (b.ok) {
        setStatus(b.status);
        setMsg({ kind: "ok", text: "Stored key removed." });
      }
    } finally {
      setBusy(false);
    }
  }

  const label = status?.label ?? "API key";

  return (
    <Panel title={label} subtitle={status?.subtitle ?? ""}>
      <div className="space-y-4">
        {/* Current status */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone bg-sand/40 px-3 py-2.5">
          <KeyRound className="h-4 w-4 text-ink/40" />
          {status === null ? (
            <span className="font-sans text-[13px] text-ink/45">Checking…</span>
          ) : status.configured ? (
            <>
              <span className="inline-flex items-center gap-1 font-sans text-[12px] font-semibold text-forest">
                <Check className="h-3.5 w-3.5" /> Configured
              </span>
              <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink/70">
                {status.masked}
              </code>
              <span className="font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">
                {status.source === "database" ? "saved in app · encrypted" : "from server env"}
              </span>
              {status.source === "database" && (
                <button
                  onClick={remove}
                  disabled={busy}
                  title="Remove the stored key"
                  className="ml-auto inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1 font-sans text-[11px] text-loss hover:bg-loss/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-1 font-sans text-[12px] font-semibold text-loss">
              <AlertTriangle className="h-3.5 w-3.5" /> Not configured
            </span>
          )}
        </div>

        {/* Entry form */}
        <div>
          <label
            htmlFor={`key-${provider}`}
            className="mb-1 block font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-ink/55"
          >
            {status?.configured ? "Replace key" : "Add key"}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-64 flex-1">
              <input
                id={`key-${provider}`}
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                placeholder={status?.placeholder ?? "…"}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-stone bg-surface px-3 py-2 pr-9 font-mono text-[13px] outline-none focus:border-fresh"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                title={show ? "Hide" : "Show"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/40 hover:text-forest"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={save}
              disabled={busy || !value.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-fresh px-4 py-2 font-sans text-sm font-semibold text-forest hover:brightness-95 disabled:opacity-50"
            >
              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {busy ? "Saving…" : "Save key"}
            </button>
          </div>
        </div>

        {msg && (
          <p
            className={`flex items-start gap-2 rounded-lg border border-dashed p-3 font-sans text-[12px] ${
              msg.kind === "ok"
                ? "border-fresh/60 bg-fresh/10 text-forest"
                : msg.kind === "warn"
                  ? "border-amber-400/60 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                  : "border-loss/50 bg-loss/10 text-loss"
            }`}
          >
            {msg.kind === "ok" ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            {msg.text}
          </p>
        )}

        <div className="rounded-lg border border-stone bg-sand/30 p-3">
          <p className="font-sans text-[11px] leading-relaxed text-ink/55">
            {status && (
              <>
                Get a key at{" "}
                <a href={status.docUrl} target="_blank" rel="noreferrer" className="text-forest-soft underline">
                  {status.docLabel}
                </a>
                .{" "}
              </>
            )}
            The key is <strong className="font-semibold text-forest">encrypted at rest</strong> and stored
            server-side only — never sent back to the browser (this panel shows a
            masked preview). It takes effect immediately, with no server restart.
            A key set in the server environment is used only when none is saved
            here.
          </p>
        </div>
      </div>
    </Panel>
  );
}
