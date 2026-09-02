"use client";

import { useEffect, useState } from "react";
import { formatNairaCompact } from "@/lib/format";

interface Perf {
  ok: boolean;
  as_of: string;
  enabled: boolean;
  has_data: boolean;
  totals: {
    capital: number;
    total_pnl: number;
    return_pct: number;
    realized: number;
    unrealized: number;
    win_rate: number | null;
    max_drawdown: number;
    sharpe: number | null;
    open_count: number;
    closed_count: number;
  };
  equity_curve: { date: string; cum: number }[];
  monthly: { month: string; pnl: number; return_pct: number }[];
  yearly: { year: string; pnl: number; return_pct: number }[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Self-contained styles (scoped under `.as-perf`) so this section is portable
// between the public landing (`.as-landing`) and the member insights page
// (`.as-shell`). It relies on the ancestor only for design tokens and the shared
// `.glass/.hud/.mono` primitives, which both scopes provide.
const PERF_CSS = `
.as-perf { padding: 78px 0; position: relative; }
.as-perf .wrap { max-width: 1160px; margin: 0 auto; padding: 0 26px; }
.as-perf .sec-head { max-width: 64ch; }
.as-perf .sec-head h2 { font-size: clamp(1.7rem, 3.5vw, 2.5rem); line-height: 1.12; margin-top: 14px; }
.as-perf .sec-head p { color: var(--muted); font-size: 1.02rem; margin-top: 16px; }
.as-perf .rule { display: inline-flex; align-items: center; gap: 10px; }
.as-perf .rule::before { content:""; width: 26px; height: 1px; background: var(--accent); box-shadow: 0 0 8px var(--glow); }
.as-perf .perf-statusbar { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; align-items: center; margin-top: 30px; }
.as-perf .perf-live { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.as-perf .perf-dot { width: 8px; height: 8px; border-radius: 50%; }
.as-perf .perf-dot.on { background: var(--accent); box-shadow: 0 0 10px var(--glow); animation: as-pulse 1.8s ease-in-out infinite; }
.as-perf .perf-dot.off { background: var(--faint); }
@keyframes as-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
.as-perf .perf-asof { color: var(--faint); }
.as-perf .perf-empty { margin-top: 16px; padding: 34px 28px; display: flex; flex-direction: column; gap: 8px; color: var(--muted); font-size: 0.98rem; }
.as-perf .perf-empty strong { font-family: var(--font-display); font-size: 1.2rem; color: var(--ink); }
.as-perf .perf-kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-top: 16px; }
@media (max-width: 820px) { .as-perf .perf-kpis { grid-template-columns: repeat(2, 1fr); } }
.as-perf .perf-kpi { padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; }
.as-perf .perf-kpi b { font-family: var(--font-mono); font-size: 1.42rem; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ink); }
.as-perf .perf-kpi .pos { color: var(--accent); }
.as-perf .perf-kpi .neg { color: var(--loss); }
.as-perf .perf-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 14px; margin-top: 14px; }
@media (max-width: 880px) { .as-perf .perf-grid { grid-template-columns: 1fr; } }
.as-perf .perf-panel { padding: 20px 20px 16px; }
.as-perf .perf-panel-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
.as-perf .perf-sub { color: var(--faint); }
.as-perf .perf-eq { width: 100%; height: 74px; display: block; margin-bottom: 14px; }
.as-perf .perf-bars { display: flex; align-items: flex-end; gap: 5px; height: 108px; }
.as-perf .perf-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; }
.as-perf .perf-bar-track { flex: 1; width: 100%; display: flex; align-items: flex-end; }
.as-perf .perf-bar { width: 100%; border-radius: 3px 3px 1px 1px; min-height: 3px; }
.as-perf .perf-bar.pos { background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 55%, transparent)); box-shadow: 0 0 12px var(--glow); }
.as-perf .perf-bar.neg { background: linear-gradient(180deg, var(--loss), color-mix(in srgb, var(--loss) 45%, transparent)); }
.as-perf .perf-bar-x { font-family: var(--font-mono); font-size: 9px; letter-spacing: .04em; color: var(--faint); }
.as-perf .perf-years { display: flex; flex-direction: column; gap: 8px; }
.as-perf .perf-year { display: grid; grid-template-columns: auto 1fr auto; align-items: baseline; gap: 12px; padding: 10px 0; border-bottom: 1px dashed var(--line); }
.as-perf .perf-year:last-child { border-bottom: none; }
.as-perf .perf-year-y { color: var(--muted); }
.as-perf .perf-year-ret { font-family: var(--font-mono); font-size: 1.16rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.as-perf .perf-year-ret.pos { color: var(--accent); }
.as-perf .perf-year-ret.neg { color: var(--loss); }
.as-perf .perf-year-pnl { color: var(--faint); text-align: right; }
.as-perf .perf-context { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--faint); letter-spacing: .04em; }
.as-perf .perf-note { color: var(--faint); font-size: 0.9rem; }
.as-perf .perf-disclaimer { margin-top: 22px; color: var(--faint); font-size: 10px; letter-spacing: 0.08em; }
`;

function fmtPct(v: number | null | undefined) {
  if (v == null || !isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function monthShort(m: string) {
  const mm = Number(m.split("-")[1]);
  return MONTHS[mm - 1] ?? m;
}
function toneClass(v: number) {
  return v > 0 ? "pos" : v < 0 ? "neg" : "flat";
}

function EquityCurve({ points }: { points: { date: string; cum: number }[] }) {
  if (points.length < 2) return null;
  const w = 100;
  const h = 30;
  const vals = points.map((p) => p.cum);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const rng = hi - lo || 1;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - ((v - lo) / rng) * h;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(p.cum).toFixed(2)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="perf-eq" aria-hidden="true">
      <defs>
        <linearGradient id="perf-eq-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#perf-eq-g)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function MonthlyBars({ data }: { data: { month: string; pnl: number; return_pct: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.pnl)));
  return (
    <div className="perf-bars" role="img" aria-label="Monthly profit and loss">
      {data.map((d) => {
        const hpct = Math.max(3, (Math.abs(d.pnl) / max) * 100);
        return (
          <div className="perf-bar-col" key={d.month} title={`${monthShort(d.month)} ${d.month.slice(0, 4)}: ${formatNairaCompact(d.pnl)} (${fmtPct(d.return_pct)})`}>
            <div className="perf-bar-track">
              <div className={`perf-bar ${d.pnl >= 0 ? "pos" : "neg"}`} style={{ height: `${hpct}%` }} />
            </div>
            <span className="perf-bar-x">{monthShort(d.month)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function PerformanceSection({ title, blurb }: { title?: string; blurb?: string } = {}) {
  const [perf, setPerf] = useState<Perf | null>(null);
  const [error, setError] = useState(false);
  const [stamp, setStamp] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/strategies/performance", { cache: "no-store" });
        const body = (await res.json()) as Perf;
        if (!alive) return;
        if (body.ok) {
          setPerf(body);
          setError(false);
          setStamp(
            new Date(body.as_of).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
              " · " +
              new Date(body.as_of).toLocaleDateString([], { day: "2-digit", month: "short" })
          );
        } else {
          setError(true);
        }
      } catch {
        if (alive) setError(true);
      }
    };
    load();
    const t = setInterval(load, 60_000); // realtime mark-to-market refresh
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const t = perf?.totals;
  const hasData = perf?.has_data && (perf.monthly.length > 0 || (t?.closed_count ?? 0) > 0 || (t?.open_count ?? 0) > 0);

  return (
    <section id="performance" className="as-perf">
      <style dangerouslySetInnerHTML={{ __html: PERF_CSS }} />
      <div className="wrap">
        <div className="sec-head">
          <span className="rule mono">Live performance</span>
          <h2>{title ?? "The simulated track record, in real time."}</h2>
          <p>{blurb ?? "A high-level review of the engine’s books — headline return, monthly P&L and a yearly summary — marked to live NGX prices. Every figure is simulated."}</p>
        </div>

        <div className="perf-statusbar">
          <span className="perf-live">
            <i className={`perf-dot ${perf?.enabled ? "on" : "off"}`} />
            {perf?.enabled ? "Engine active" : "Engine paused"}
          </span>
          <span className="mono perf-asof">{error ? "Reconnecting…" : stamp ? `As of ${stamp} · auto-refreshing` : "Loading…"}</span>
        </div>

        {!perf ? (
          <div className="perf-empty glass hud">{error ? "Performance feed is momentarily unavailable." : "Loading performance…"}</div>
        ) : !hasData ? (
          <div className="perf-empty glass hud">
            <strong>Track record is accruing.</strong>
            <span>
              The engine is provisioned with {formatNairaCompact(t?.capital ?? 0)} of simulated capital across intraday, weekly
              and monthly cadences. Once the first cadence settles, live monthly and yearly performance appears here.
            </span>
          </div>
        ) : (
          <>
            <div className="perf-kpis">
              <div className="perf-kpi glass hud">
                <span className="mono">Total return</span>
                <b className={toneClass(t!.return_pct)}>{fmtPct(t!.return_pct)}</b>
              </div>
              <div className="perf-kpi glass hud">
                <span className="mono">Net P&L</span>
                <b className={toneClass(t!.total_pnl)}>{formatNairaCompact(t!.total_pnl)}</b>
              </div>
              <div className="perf-kpi glass hud">
                <span className="mono">Win rate</span>
                <b>{t!.win_rate == null ? "—" : `${t!.win_rate.toFixed(0)}%`}</b>
              </div>
              <div className="perf-kpi glass hud">
                <span className="mono">Max drawdown</span>
                <b className="neg">{t!.max_drawdown > 0 ? `−${formatNairaCompact(t!.max_drawdown)}` : "—"}</b>
              </div>
              <div className="perf-kpi glass hud">
                <span className="mono">Sharpe</span>
                <b>{t!.sharpe == null ? "—" : t!.sharpe.toFixed(2)}</b>
              </div>
            </div>

            <div className="perf-grid">
              <div className="perf-panel glass hud">
                <div className="perf-panel-head">
                  <span className="mono">Monthly P&L</span>
                  <span className="mono perf-sub">last {perf.monthly.length} mo</span>
                </div>
                {perf.equity_curve.length >= 2 && <EquityCurve points={perf.equity_curve} />}
                {perf.monthly.length > 0 ? <MonthlyBars data={perf.monthly} /> : <p className="perf-note">No settled months yet.</p>}
              </div>

              <div className="perf-panel glass hud">
                <div className="perf-panel-head">
                  <span className="mono">Yearly performance</span>
                  <span className="mono perf-sub">{perf.yearly.length} yr</span>
                </div>
                {perf.yearly.length > 0 ? (
                  <div className="perf-years">
                    {perf.yearly.map((y) => (
                      <div className="perf-year" key={y.year}>
                        <span className="perf-year-y mono">{y.year}</span>
                        <span className={`perf-year-ret ${toneClass(y.return_pct)}`}>{fmtPct(y.return_pct)}</span>
                        <span className="perf-year-pnl mono">{formatNairaCompact(y.pnl)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="perf-note">No full-year record yet.</p>
                )}
                <div className="perf-context mono">
                  {t!.open_count} open · {t!.closed_count} closed · {formatNairaCompact(t!.capital)} book
                </div>
              </div>
            </div>
          </>
        )}

        <p className="perf-disclaimer mono">
          Simulated / illustrative · marked to delayed NGX prices · not investment advice · past performance does not indicate
          future results.
        </p>
      </div>
    </section>
  );
}
