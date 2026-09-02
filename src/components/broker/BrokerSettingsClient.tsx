"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Broker } from "@/lib/db/brokers";
import { AS_THEME_CSS } from "@/components/strategies/theme";
import { BROKER_CSS } from "./brokerStyles";

type Keys = { sandbox_key: string; live_key: string; mode: "sandbox" | "live" };

function KeyRow({ label, value, onRotate, busy }: { label: "sandbox" | "live"; value: string; onRotate: () => void; busy: boolean }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const masked = value.slice(0, 12) + "•".repeat(18);
  return (
    <div className="bk-key">
      <div className="bk-key-head">
        <span className={`lbl ${label}`}>{label} key</span>
      </div>
      <div className="bk-key-row">
        <code className="bk-key-val">{shown ? value : masked}</code>
        <button className="bk-btn-sm" onClick={() => setShown((s) => !s)}>{shown ? "Hide" : "Reveal"}</button>
        <button
          className="bk-btn-sm"
          onClick={async () => {
            try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button className="bk-btn-sm" onClick={onRotate} disabled={busy}>{busy ? "…" : "Rotate"}</button>
      </div>
    </div>
  );
}

export function BrokerSettingsClient({ broker }: { broker: Broker }) {
  const [keys, setKeys] = useState<Keys | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/broker/me", { cache: "no-store" });
    const body = await res.json();
    if (body.ok) setKeys({ sandbox_key: body.broker.sandbox_key, live_key: body.broker.live_key, mode: body.broker.mode });
  }, []);
  useEffect(() => { load(); }, [load]);

  const mode = keys?.mode ?? broker.mode;

  async function rotate(which: "sandbox" | "live") {
    setBusy(which);
    setMsg(null);
    try {
      const res = await fetch("/api/broker/settings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "rotateKey", which }),
      });
      const body = await res.json();
      if (body.ok) { await load(); setMsg(`${which} key rotated — update your integration.`); }
    } finally {
      setBusy(null);
    }
  }

  async function switchMode(next: "sandbox" | "live") {
    if (next === mode) return;
    setBusy("mode");
    try {
      await fetch("/api/broker/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "setMode", mode: next }) });
      await load();
    } finally { setBusy(null); }
  }

  async function signOut() {
    try { await fetch("/api/broker/logout", { method: "POST" }); } catch { /* ignore */ }
    window.location.href = "/broker/login";
  }

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
            <Link href="/broker" className="bk-navlink">Dashboard</Link>
            <span className="bk-navlink active">API keys</span>
            <Link href="/strategies/api-docs" className="bk-navlink">Docs</Link>
          </nav>
          <div className="bk-right">
            <div className="bk-modes" role="group" aria-label="Environment">
              {(["sandbox", "live"] as const).map((m) => (
                <button key={m} disabled={busy === "mode"} onClick={() => switchMode(m)} className={`bk-mode ${mode === m ? "on " + m : ""}`}>{m}</button>
              ))}
            </div>
            <button className="bk-signout" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="bk-main">
        <div className="bk-hero">
          <span className="bk-eyebrow">API keys</span>
          <h1>Integration credentials.</h1>
          <p>Authenticate every request with your key as <span className="mono">Authorization: Bearer &lt;key&gt;</span>. The key you use selects the environment — sandbox for testing, live for production.</p>
        </div>

        <section className="bk-panel glass hud" style={{ marginTop: 22 }}>
          <h2>Your keys</h2>
          <p className="bk-note">Treat these like passwords. Rotating a key immediately invalidates the previous one.</p>
          {keys ? (
            <>
              <KeyRow label="sandbox" value={keys.sandbox_key} onRotate={() => rotate("sandbox")} busy={busy === "sandbox"} />
              <KeyRow label="live" value={keys.live_key} onRotate={() => rotate("live")} busy={busy === "live"} />
              <p className="bk-base">Base URL&nbsp; <b>/api/v1</b> &nbsp;·&nbsp; e.g. <span>GET /api/v1/signals</span></p>
              {msg && <p className="bk-base" style={{ color: "var(--accent)" }}>{msg}</p>}
              <div className="bk-warn">
                <b>Live is real to your systems.</b> Sandbox and live return the same engine model scaled to your AUM, but keep
                integration testing on the sandbox key until you have reconciled fills end-to-end. Execution, custody and
                settlement are performed by you (the regulated broker) — the engine only provides signals.
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/strategies/api-docs" className="btn btn-ghost">Read the API documentation</Link>
                <Link href="/strategies/api-docs/explorer" className="btn btn-primary">Open API explorer →</Link>
              </div>
            </>
          ) : (
            <p className="bk-empty">Loading…</p>
          )}
        </section>
      </main>
    </div>
  );
}
