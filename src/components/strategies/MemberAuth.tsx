"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AS_THEME_CSS } from "./theme";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

const AUTH_CSS = `
.as-shell .auth-wrap { max-width: 1160px; margin: 0 auto; padding: 22px 26px; }
.as-shell .auth-top { display: flex; align-items: center; justify-content: space-between; height: 42px; }
.as-shell .auth-top a.small { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.as-shell .auth-top a.small:hover { color: var(--accent); }
.as-shell .auth-center { display: flex; min-height: calc(100vh - 90px); align-items: center; justify-content: center; padding: 20px 26px 60px; }
.as-shell .auth-card { width: 100%; max-width: 428px; padding: 34px 32px 30px; }
.as-shell .auth-eyebrow { display: inline-flex; align-items: center; gap: 10px; }
.as-shell .auth-eyebrow::before { content:""; width: 24px; height: 1px; background: var(--accent); box-shadow: 0 0 8px var(--glow); }
.as-shell .auth-card h1 { font-size: 1.7rem; line-height: 1.12; margin: 14px 0 6px; }
.as-shell .auth-card .sub { color: var(--muted); font-size: 0.95rem; margin: 0 0 22px; }
.as-shell .field { margin-bottom: 14px; }
.as-shell .field label { display: block; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.as-shell .field input { width: 100%; padding: 12px 14px; border-radius: 7px; border: 1px solid var(--line-strong); background: color-mix(in srgb, var(--bg) 60%, transparent); color: var(--ink); font-family: var(--font-sans); font-size: 0.95rem; outline: none; transition: border-color .15s ease, box-shadow .15s ease; }
.as-shell .field input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--glow); }
.as-shell .field input::placeholder { color: var(--faint); }
.as-shell .hint { font-family: var(--font-mono); font-size: 10px; letter-spacing: .04em; color: var(--faint); margin-top: 5px; }
.as-shell .auth-err { margin: 4px 0 14px; padding: 10px 12px; border-radius: 6px; border: 1px solid color-mix(in srgb, var(--loss) 45%, transparent); background: color-mix(in srgb, var(--loss) 12%, transparent); color: var(--loss); font-size: 0.85rem; }
.as-shell .auth-submit { width: 100%; margin-top: 6px; }
.as-shell .auth-alt { margin-top: 18px; text-align: center; font-size: 0.86rem; color: var(--muted); }
.as-shell .auth-alt a { color: var(--accent); text-decoration: none; font-weight: 600; }
.as-shell .auth-legal { margin-top: 22px; font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.05em; color: var(--faint); line-height: 1.7; text-align: center; }
`;

export function MemberAuth({ mode }: { mode: "signup" | "login" }) {
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement | null>(null);

  // Render the Cloudflare Turnstile widget on the signup form when configured.
  useEffect(() => {
    if (!isSignup || !TURNSTILE_SITE_KEY) return;
    const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    const render = () => {
      const ts = (window as unknown as { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string } }).turnstile;
      if (ts && turnstileRef.current && turnstileRef.current.childElementCount === 0) {
        ts.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (t: string) => setTurnstileToken(t),
          "error-callback": () => setTurnstileToken(""),
        });
      }
    };
    if (!document.querySelector(`script[src="${SRC}"]`)) {
      const s = document.createElement("script");
      s.src = SRC;
      s.async = true;
      s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    } else {
      render();
    }
  }, [isSignup]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/strategies/${isSignup ? "signup" : "login"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(isSignup ? { name, company, email, password, turnstileToken } : { email, password }),
      });
      const body = await res.json();
      if (body.ok) {
        window.location.href = "/strategies/insights";
        return;
      }
      setError(body.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="as-shell">
      <style dangerouslySetInnerHTML={{ __html: AS_THEME_CSS + AUTH_CSS }} />
      <div className="auth-wrap">
        <div className="auth-top">
          <Link href="/strategies" className="brand">
            <span className="glyph" aria-hidden="true" />
            <span className="name">
              Alternative&nbsp;<b>Strategies</b>
            </span>
          </Link>
          <Link href="/strategies" className="small">
            ← Back
          </Link>
        </div>
      </div>

      <div className="auth-center">
        <form className="auth-card glass hud" onSubmit={submit}>
          <span className="auth-eyebrow mono">{isSignup ? "Request access" : "Member sign-in"}</span>
          <h1>{isSignup ? "Follow the programme." : "Welcome back."}</h1>
          <p className="sub">
            {isSignup
              ? "Create an account to read the monthly Strategist's Thesis and track simulated performance."
              : "Sign in to your Alternative Strategies member area."}
          </p>

          {error && <div className="auth-err">{error}</div>}

          {isSignup && (
            <>
              <div className="field">
                <label htmlFor="as-name">Full name</label>
                <input id="as-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" required />
              </div>
              <div className="field">
                <label htmlFor="as-company">Company</label>
                <input id="as-company" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Firm or institution" required />
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="as-email">Work email</label>
            <input id="as-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@firm.com" required />
          </div>

          <div className="field">
            <label htmlFor="as-password">Password</label>
            <input
              id="as-password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
            {isSignup && <p className="hint">At least 8 characters.</p>}
          </div>

          {isSignup && TURNSTILE_SITE_KEY && <div ref={turnstileRef} style={{ marginBottom: 14 }} />}

          <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
            {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
          </button>

          <p className="auth-alt">
            {isSignup ? (
              <>
                Already have access? <Link href="/strategies/login">Sign in</Link>
              </>
            ) : (
              <>
                New here? <Link href="/strategies/signup">Request access</Link>
              </>
            )}
          </p>

          <p className="auth-legal">
            Simulated / illustrative · not investment advice. By continuing you agree we may contact you about Alternative
            Strategies.
          </p>
        </form>
      </div>
    </div>
  );
}
