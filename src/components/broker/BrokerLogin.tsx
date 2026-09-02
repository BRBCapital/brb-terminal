"use client";

import { useState } from "react";
import Link from "next/link";
import { AS_THEME_CSS } from "@/components/strategies/theme";

const CSS = `
.as-shell .bk-wrap { max-width:1160px; margin:0 auto; padding:22px 26px; }
.as-shell .bk-top { display:flex; align-items:center; justify-content:space-between; height:42px; }
.as-shell .bk-top a.small { font-family:var(--font-mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); text-decoration:none; }
.as-shell .bk-top a.small:hover { color:var(--accent); }
.as-shell .bk-center { display:flex; min-height:calc(100vh - 90px); align-items:center; justify-content:center; padding:20px 26px 60px; }
.as-shell .bk-card { width:100%; max-width:420px; padding:34px 32px 30px; }
.as-shell .bk-eyebrow { display:inline-flex; align-items:center; gap:10px; font-family:var(--font-mono); font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--muted); }
.as-shell .bk-eyebrow::before { content:""; width:24px; height:1px; background:var(--accent); box-shadow:0 0 8px var(--glow); }
.as-shell .bk-card h1 { font-size:1.7rem; margin:14px 0 6px; }
.as-shell .bk-card .sub { color:var(--muted); font-size:.95rem; margin:0 0 22px; }
.as-shell .bk-field { margin-bottom:14px; }
.as-shell .bk-field label { display:block; font-family:var(--font-mono); font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
.as-shell .bk-field input { width:100%; padding:12px 14px; border-radius:7px; border:1px solid var(--line-strong); background:color-mix(in srgb, var(--bg) 60%, transparent); color:var(--ink); font-family:var(--font-sans); font-size:.95rem; outline:none; }
.as-shell .bk-field input:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--glow); }
.as-shell .bk-err { margin:4px 0 14px; padding:10px 12px; border-radius:6px; border:1px solid color-mix(in srgb, var(--loss) 45%, transparent); background:color-mix(in srgb, var(--loss) 12%, transparent); color:var(--loss); font-size:.85rem; }
.as-shell .bk-legal { margin-top:20px; font-family:var(--font-mono); font-size:9.5px; letter-spacing:.05em; color:var(--faint); line-height:1.7; text-align:center; }
`;

export function BrokerLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/broker/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (body.ok) {
        window.location.href = "/broker";
        return;
      }
      setError(body.error ?? "Sign-in failed.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="as-shell">
      <style dangerouslySetInnerHTML={{ __html: AS_THEME_CSS + CSS }} />
      <div className="bk-wrap">
        <div className="bk-top">
          <Link href="/strategies" className="brand">
            <span className="glyph" aria-hidden="true" />
            <span className="name">Alternative&nbsp;<b>Strategies</b></span>
          </Link>
          <Link href="/strategies/api-docs" className="small">API docs →</Link>
        </div>
      </div>
      <div className="bk-center">
        <form className="bk-card glass hud" onSubmit={submit}>
          <span className="bk-eyebrow">Broker portal</span>
          <h1>Execution partner sign-in.</h1>
          <p className="sub">Access your account, allocations and API keys. Accounts are provisioned by Alternative Strategies.</p>
          {error && <div className="bk-err">{error}</div>}
          <div className="bk-field">
            <label htmlFor="bk-email">Email</label>
            <input id="bk-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ops@broker.com" required />
          </div>
          <div className="bk-field">
            <label htmlFor="bk-pw">Password</label>
            <input id="bk-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 6 }} disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="bk-legal">
            Simulated / illustrative execution · not investment advice. Need access? Contact your Alternative Strategies
            representative.
          </p>
        </form>
      </div>
    </div>
  );
}
