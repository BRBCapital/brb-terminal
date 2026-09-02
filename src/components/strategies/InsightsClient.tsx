"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Member } from "@/lib/db/members";
import { AS_THEME_CSS } from "./theme";
import { PerformanceSection } from "./PerformanceSection";

const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const INSIGHTS_CSS = `
.as-shell .ins-header { position: sticky; top: 0; z-index: 30; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--bg) 72%, transparent); backdrop-filter: blur(12px); }
.as-shell .ins-bar { max-width: 1160px; margin: 0 auto; padding: 0 26px; height: 62px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.as-shell .ins-who { display: flex; align-items: center; gap: 14px; }
.as-shell .ins-chip { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); text-align: right; line-height: 1.5; }
.as-shell .ins-chip b { display: block; color: var(--ink); font-weight: 600; letter-spacing: 0.06em; }
.as-shell .ins-signout { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); background: transparent; border: 1px solid var(--line-strong); border-radius: 6px; padding: 8px 13px; cursor: pointer; }
.as-shell .ins-signout:hover { color: var(--accent); border-color: var(--accent); }
@media (max-width: 560px) { .as-shell .ins-chip { display: none; } }

.as-shell .ins-hero { max-width: 1160px; margin: 0 auto; padding: 52px 26px 6px; }
.as-shell .ins-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }
.as-shell .ins-eyebrow::before { content:""; width: 24px; height: 1px; background: var(--accent); box-shadow: 0 0 8px var(--glow); }
.as-shell .ins-hero h1 { font-size: clamp(2rem, 4.4vw, 3rem); line-height: 1.06; margin: 14px 0 8px; }
.as-shell .ins-hero h1 em { font-style: italic; color: var(--accent); text-shadow: 0 0 26px var(--glow); }
.as-shell .ins-hero p { color: var(--muted); max-width: 60ch; font-size: 1.04rem; }

.as-shell .thesis { max-width: 1160px; margin: 0 auto; padding: 34px 26px 80px; }
.as-shell .thesis-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.as-shell .thesis-head .rule { display: inline-flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }
.as-shell .thesis-head .rule::before { content:""; width: 24px; height: 1px; background: var(--accent); box-shadow: 0 0 8px var(--glow); }
.as-shell .months { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
.as-shell .month-pill { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; color: var(--muted); background: transparent; border: 1px solid var(--line); border-radius: 999px; padding: 7px 14px; cursor: pointer; transition: all .15s ease; white-space: nowrap; }
.as-shell .month-pill:hover { border-color: var(--line-strong); color: var(--ink); }
.as-shell .month-pill.active { color: var(--accent-ink); background: var(--accent); border-color: var(--accent); font-weight: 600; box-shadow: 0 0 18px var(--glow); }
.as-shell .thesis-panel { padding: 30px 32px; position: relative; min-height: 260px; }
.as-shell .thesis-title { font-family: var(--font-display); font-size: 1.5rem; margin: 0 0 4px; }
.as-shell .thesis-by { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
.as-shell .thesis-by .live { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--glow); animation: as-pulse 1.6s ease-in-out infinite; }
.as-shell .thesis-body h2 { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); margin: 26px 0 10px; display: flex; align-items: center; gap: 8px; }
.as-shell .thesis-body h2::before { content:""; width: 8px; height: 8px; background: var(--accent); border-radius: 2px; box-shadow: 0 0 8px var(--glow); }
.as-shell .thesis-body h2:first-child { margin-top: 0; }
.as-shell .thesis-body h3 { font-family: var(--font-display); font-size: 1.05rem; margin: 18px 0 6px; color: var(--ink); }
.as-shell .thesis-body p { color: color-mix(in srgb, var(--ink) 82%, transparent); font-size: 1.02rem; line-height: 1.75; margin: 0 0 14px; }
.as-shell .thesis-body ul { margin: 0 0 14px; padding: 0; list-style: none; }
.as-shell .thesis-body li { position: relative; padding-left: 18px; margin-bottom: 8px; color: color-mix(in srgb, var(--ink) 82%, transparent); line-height: 1.7; }
.as-shell .thesis-body li::before { content:"▸"; position: absolute; left: 0; color: var(--accent); }
.as-shell .thesis-body strong { color: var(--ink); font-weight: 600; }
.as-shell .thesis-body em { font-style: italic; color: var(--muted); }
.as-shell .thesis-cursor { display: inline-block; width: 8px; height: 1.05rem; background: var(--accent); vertical-align: -2px; margin-left: 2px; animation: as-blink 1s steps(1) infinite; }
@keyframes as-blink { 50% { opacity: 0; } }
.as-shell .thesis-empty { color: var(--muted); font-size: 0.98rem; }
.as-shell .thesis-err { color: var(--loss); font-size: 0.92rem; }
.as-shell .thesis-legal { margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--line); font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.06em; color: var(--faint); line-height: 1.7; }
@media (prefers-reduced-motion: reduce) { .as-shell .thesis-cursor, .as-shell .thesis-by .live, .as-shell .perf-dot.on { animation: none; } }
`;

function recentMonths(n: number): { period: string; label: string; short: string }[] {
  const out: { period: string; label: string; short: string }[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    const y = d.getFullYear();
    const m = d.getMonth();
    out.push({
      period: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: `${MONTHS_FULL[m]} ${y}`,
      short: `${MONTHS_FULL[m].slice(0, 3)} ${String(y).slice(2)}`,
    });
    d.setMonth(m - 1);
  }
  return out;
}

export function InsightsClient({ member }: { member: Member }) {
  const [months, setMonths] = useState<{ period: string; label: string; short: string }[]>([]);
  const [period, setPeriod] = useState<string>("");
  const [content, setContent] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const m = recentMonths(6);
    setMonths(m);
    setPeriod(m[0].period);
  }, []);

  const loadThesis = useCallback(async (p: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setContent("");
    setError(null);
    setStreaming(true);
    try {
      const res = await fetch(`/api/strategies/insight?period=${p}`, { signal: ac.signal, cache: "no-store" });
      if (!res.ok || !res.body) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Could not load the thesis.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: { type: string; text?: string; error?: string };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === "delta" && ev.text) setContent((c) => c + ev.text);
          else if (ev.type === "error") setError(ev.error ?? "The strategist is unavailable right now.");
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message || "Could not load the thesis.");
    } finally {
      if (abortRef.current === ac) {
        setStreaming(false);
        abortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (period) loadThesis(period);
    return () => abortRef.current?.abort();
  }, [period, loadThesis]);

  const signOut = async () => {
    try {
      await fetch("/api/strategies/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    window.location.href = "/strategies";
  };

  const activeLabel = months.find((m) => m.period === period)?.label ?? "";

  return (
    <div className="as-shell">
      <style dangerouslySetInnerHTML={{ __html: AS_THEME_CSS + INSIGHTS_CSS }} />

      <header className="ins-header">
        <div className="ins-bar">
          <a href="/strategies" className="brand">
            <span className="glyph" aria-hidden="true" />
            <span className="name">
              Alternative&nbsp;<b>Strategies</b>
            </span>
          </a>
          <div className="ins-who">
            <span className="ins-chip">
              {member.name}
              <b>{member.company}</b>
            </span>
            <button className="ins-signout" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="ins-hero">
        <span className="ins-eyebrow">Members area</span>
        <h1>
          The monthly <em>Strategist&rsquo;s Thesis.</em>
        </h1>
        <p>
          A high-level, non-proprietary reading of the market regime and the philosophy behind how a systematic frontier
          strategy navigated the month — written to make you think, not to reveal the book.
        </p>
      </section>

      {!member.verified_at && (
        <div className="thesis" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div className="glass hud" style={{ padding: "14px 18px" }}>
            <p style={{ margin: 0, fontSize: ".92rem", color: "var(--muted)" }}>
              <b style={{ color: "var(--ink)" }}>Verify your email to unlock the monthly thesis.</b>{" "}
              We sent a verification link to {member.email}. Live performance below is available now.
            </p>
          </div>
        </div>
      )}

      {/* live simulated performance (public aggregates) */}
      <PerformanceSection
        title="Simulated performance, in real time."
        blurb="Headline return, monthly P&L and a yearly summary — marked to live NGX prices. Aggregates only; positions are never shown."
      />

      {/* the thesis */}
      <section className="thesis">
        <div className="thesis-head">
          <span className="rule">Strategist&rsquo;s thesis</span>
        </div>
        <div className="months">
          {months.map((m) => (
            <button key={m.period} className={`month-pill ${m.period === period ? "active" : ""}`} onClick={() => setPeriod(m.period)}>
              {m.short}
            </button>
          ))}
        </div>

        <div className="thesis-panel glass hud">
          <h2 className="thesis-title">{activeLabel || "This month"}</h2>
          <div className="thesis-by">
            {streaming && <span className="live" aria-hidden="true" />}
            {streaming ? "The strategist is writing…" : "AI-authored · Alternative Strategies"}
          </div>

          {error ? (
            <p className="thesis-err">{error}</p>
          ) : content ? (
            <div className="thesis-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              {streaming && <span className="thesis-cursor" aria-hidden="true" />}
            </div>
          ) : streaming ? (
            <p className="thesis-empty">Composing this month&rsquo;s thesis…</p>
          ) : (
            <p className="thesis-empty">Select a month to read its thesis.</p>
          )}

          <p className="thesis-legal">
            Simulated / illustrative and for information only — not investment advice, not a recommendation, and not an offer.
            No proprietary positions, weights or figures are disclosed. Prices are delayed up to 20 minutes during NGX hours;
            past performance does not indicate future results.
          </p>
        </div>
      </section>
    </div>
  );
}
