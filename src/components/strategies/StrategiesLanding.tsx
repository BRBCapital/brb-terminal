"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PerformanceSection } from "./PerformanceSection";

// All styles are scoped under `.as-landing` so nothing leaks into the app when
// the page unmounts, and the CSS variables can't collide with the app's tokens.
// Dark is the default (the app runs dark-first); `html:not(.dark)` opts into the
// light palette so the landing follows the app-wide theme toggle. The token
// NAMES (--bg/--accent/--glow/--line/--panel + .glass/.hud/.mono primitives) are
// a shared contract relied on by <PerformanceSection/> and the canvas JS below —
// values and treatment change here, names must not.
const LANDING_CSS = `
.as-landing {
  --bg:#04090b; --bg2:#07130f; --panel:rgba(10,26,20,0.5); --panel-solid:#081512;
  --line:rgba(90,230,180,0.15); --line-strong:rgba(90,230,180,0.36);
  --ink:#e9f6ef; --muted:#89aa9c; --faint:#577465;
  --accent:#4ff2a6; --accent-2:#37dcff; --accent-ink:#03130c;
  --grid:rgba(90,230,180,0.06);
  --glow:rgba(79,242,166,0.5); --glow-2:rgba(55,220,255,0.42); --loss:#ff6f5b;
  --font-display: var(--font-poppins), system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  --font-sans: var(--font-poppins), system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --maxw: 1180px;
  position: relative; min-height: 100vh; width: 100%;
  background: var(--bg); color: var(--ink);
  font-family: var(--font-sans); line-height: 1.62; -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
html:not(.dark) .as-landing {
  --bg:#eef3ef; --bg2:#f6f9f5; --panel:rgba(255,255,255,0.72); --panel-solid:#ffffff;
  --line:rgba(15,95,58,0.16); --line-strong:rgba(15,120,72,0.32);
  --ink:#071d15; --muted:#4a655a; --faint:#7a9488;
  --accent:#0a9a5b; --accent-2:#0f8fb0; --accent-ink:#ffffff;
  --grid:rgba(15,95,58,0.06);
  --glow:rgba(10,154,91,0.24); --glow-2:rgba(15,143,176,0.2); --loss:#c0392b;
}
.as-landing * { box-sizing: border-box; }

/* layered backdrop: aurora bloom + blueprint grid + neural mesh */
.as-landing::before {
  content:""; position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(760px 460px at 84% -6%, var(--glow-2), transparent 60%),
    radial-gradient(820px 560px at 4% -2%, var(--glow), transparent 62%),
    linear-gradient(180deg, var(--bg), var(--bg2));
  opacity: 0.92;
}
.as-landing .grid-bg {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 48px 48px; background-position: center;
  -webkit-mask-image: radial-gradient(130% 100% at 50% -8%, #000 32%, transparent 80%);
  mask-image: radial-gradient(130% 100% at 50% -8%, #000 32%, transparent 80%);
}
.as-landing .mesh { position: fixed; inset: 0; z-index: 0; width: 100%; height: 100%; pointer-events: none; opacity: 0.5; }
.as-landing > header, .as-landing > main, .as-landing > footer { position: relative; z-index: 2; }
.as-landing .wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 28px; }
.as-landing .mono { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
.as-landing h1, .as-landing h2, .as-landing h3 { font-family: var(--font-display); font-weight: 700; letter-spacing: -0.02em; margin: 0; }
.as-landing a { color: inherit; }

/* glass panels + HUD corner brackets (hardware feel) */
.as-landing .glass { position: relative; background: var(--panel); backdrop-filter: blur(15px) saturate(1.15); -webkit-backdrop-filter: blur(15px) saturate(1.15); border: 1px solid var(--line); border-radius: 4px; }
.as-landing .hud { position: relative; }
.as-landing .hud::before, .as-landing .hud::after { content:""; position: absolute; width: 13px; height: 13px; border-color: var(--accent); border-style: solid; pointer-events: none; opacity: .5; transition: opacity .2s ease; }
.as-landing .hud::before { top:-1px; left:-1px; border-width: 1px 0 0 1px; }
.as-landing .hud::after { bottom:-1px; right:-1px; border-width: 0 1px 1px 0; }
.as-landing .glass.hud:hover::before, .as-landing .glass.hud:hover::after { opacity: 1; }

/* thin glowing section divider */
.as-landing .sep { height: 1px; border: 0; margin: 0; background: linear-gradient(90deg, transparent, var(--line-strong) 18%, var(--line-strong) 82%, transparent); position: relative; }
.as-landing .sep::after { content:""; position: absolute; left: 50%; top: -1px; width: 90px; height: 2px; transform: translateX(-50%); background: linear-gradient(90deg, transparent, var(--accent), transparent); box-shadow: 0 0 14px var(--glow); opacity: .8; }

/* ---- header ---- */
.as-landing header { position: sticky; top: 0; z-index: 30; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--bg) 68%, transparent); backdrop-filter: blur(14px); }
.as-landing .bar { display: flex; align-items: center; justify-content: space-between; height: 66px; }
.as-landing .brand { display: flex; align-items: center; gap: 11px; }
.as-landing .glyph { width: 24px; height: 24px; position: relative; }
.as-landing .glyph::before { content:""; position: absolute; inset: 0; border: 1.5px solid var(--accent); border-radius: 5px; transform: rotate(45deg); box-shadow: 0 0 14px var(--glow); animation: as-spin 9s linear infinite; }
.as-landing .glyph::after { content:""; position: absolute; inset: 8px; background: var(--accent); border-radius: 2px; box-shadow: 0 0 12px var(--glow); }
@keyframes as-spin { to { transform: rotate(405deg); } }
.as-landing .brand .name { font-family: var(--font-display); font-weight: 700; font-size: 16px; letter-spacing: 0.01em; text-transform: uppercase; }
.as-landing .brand .name b { color: var(--accent); font-weight: 700; }
.as-landing .navlinks { display: flex; gap: 26px; }
.as-landing .navlinks a { text-decoration: none; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); transition: color .2s ease; }
.as-landing .navlinks a:hover { color: var(--accent); }
@media (max-width: 860px) { .as-landing .navlinks { display: none; } }
.as-landing .hdr-cta { display: inline-flex; align-items: center; gap: 16px; }
.as-landing .signin { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); text-decoration: none; white-space: nowrap; }
.as-landing .signin:hover { color: var(--accent); }
@media (max-width: 480px) { .as-landing .signin { display: none; } }

/* ---- buttons ---- */
.as-landing .btn { position: relative; display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.11em; text-transform: uppercase; text-decoration: none; padding: 12px 20px; border-radius: 3px; cursor: pointer; overflow: hidden; transition: transform .15s ease, box-shadow .22s ease, border-color .2s ease, color .2s ease; }
.as-landing .btn-primary { background: linear-gradient(120deg, var(--accent), var(--accent-2)); color: var(--accent-ink); border: 1px solid var(--accent); font-weight: 700; box-shadow: 0 0 0 rgba(0,0,0,0); }
.as-landing .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 30px var(--glow); }
.as-landing .btn-primary::after { content:""; position: absolute; top: 0; left: -60%; width: 40%; height: 100%; background: linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent); transform: skewX(-18deg); transition: left .5s ease; }
.as-landing .btn-primary:hover::after { left: 130%; }
.as-landing .btn-ghost { border: 1px solid var(--line-strong); color: var(--ink); background: color-mix(in srgb, var(--panel-solid) 26%, transparent); }
.as-landing .btn-ghost:hover { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 24px var(--glow); }

/* ---- hero ---- */
.as-landing .hero { padding: 78px 0 26px; }
.as-landing .hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 46px; align-items: center; }
@media (max-width: 940px) { .as-landing .hero-grid { grid-template-columns: 1fr; gap: 30px; } }
.as-landing .eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 7px 13px; border: 1px solid var(--line); border-radius: 3px; background: color-mix(in srgb, var(--panel-solid) 34%, transparent); }
.as-landing .cursor { display: inline-block; width: 7px; height: 13px; background: var(--accent); box-shadow: 0 0 8px var(--glow); animation: as-blink 1.1s steps(1) infinite; vertical-align: -1px; }
@keyframes as-blink { 50% { opacity: 0; } }
.as-landing .hero h1 { font-size: clamp(2.7rem, 5.8vw, 4.5rem); line-height: 1.0; margin-top: 20px; text-transform: none;
  background: linear-gradient(178deg, var(--ink), color-mix(in srgb, var(--ink) 62%, var(--accent)));
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.as-landing .hero h1 em { font-style: normal; color: var(--accent); -webkit-text-fill-color: var(--accent); text-shadow: 0 0 34px var(--glow); }
.as-landing .lede { font-size: 1.14rem; color: var(--muted); max-width: 47ch; margin: 24px 0 26px; }
.as-landing .cta-row { display: flex; flex-wrap: wrap; gap: 12px; }
.as-landing .readout { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
.as-landing .readout span { display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); padding: 6px 11px; border: 1px solid var(--line); border-radius: 3px; background: color-mix(in srgb, var(--panel-solid) 40%, transparent); }
.as-landing .rd-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 9px var(--glow); animation: as-pulse 1.8s ease-in-out infinite; }
@keyframes as-pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
.as-landing .hero-stats { display: flex; flex-wrap: wrap; gap: 32px; margin-top: 34px; padding-top: 26px; border-top: 1px solid var(--line); }
.as-landing .stat .n { font-family: var(--font-mono); font-size: 1.55rem; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; text-shadow: 0 0 22px var(--glow); }
.as-landing .stat .l { display: block; margin-top: 5px; }
.as-landing .viz { position: relative; padding: 16px; min-height: 344px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 28px 70px rgba(0,0,0,0.42); }
.as-landing .viz-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.as-landing .viz canvas { width: 100%; flex: 1; display: block; }
.as-landing .viz .scan { position: absolute; left: 8px; right: 8px; top: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--accent), transparent); opacity: .5; filter: blur(.4px); animation: as-scan 4.8s ease-in-out infinite; pointer-events: none; }
@keyframes as-scan { 0% { top: 8%; opacity: 0; } 18% { opacity: .55; } 82% { opacity: .55; } 100% { top: 90%; opacity: 0; } }
.as-landing .viz-legend { display: flex; gap: 18px; margin-top: 10px; }
.as-landing .viz-legend span { display: inline-flex; align-items: center; gap: 6px; }
.as-landing .dot { width: 8px; height: 8px; border-radius: 2px; box-shadow: 0 0 8px currentColor; }

/* ---- data tape ---- */
.as-landing .ticker { margin-top: 32px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); overflow: hidden; white-space: nowrap; position: relative; -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); }
.as-landing .ticker .track { display: inline-flex; gap: 36px; padding: 12px 0; animation: as-scroll 36s linear infinite; }
.as-landing .ticker span { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; color: var(--faint); }
.as-landing .ticker span b { color: var(--muted); }
@keyframes as-scroll { to { transform: translateX(-50%); } }

/* ---- sections ---- */
.as-landing section { padding: 84px 0; position: relative; }
.as-landing .sec-head { max-width: 64ch; }
.as-landing .sec-head h2 { font-size: clamp(1.9rem, 3.6vw, 2.7rem); line-height: 1.1; margin-top: 16px; }
.as-landing .sec-head p { color: var(--muted); font-size: 1.05rem; margin-top: 16px; }
.as-landing .rule { display: inline-flex; align-items: center; gap: 10px; padding: 5px 12px 5px 0; }
.as-landing .rule::before { content:""; width: 28px; height: 1px; background: var(--accent); box-shadow: 0 0 10px var(--glow); }

.as-landing .gap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 46px; align-items: center; margin-top: 46px; }
@media (max-width: 880px) { .as-landing .gap-grid { grid-template-columns: 1fr; gap: 28px; } }
.as-landing .gap-lead { font-family: var(--font-display); font-weight: 500; font-size: 1.5rem; line-height: 1.35; letter-spacing: -0.01em; }
.as-landing .gap-lead b { color: var(--accent); font-weight: 700; }
.as-landing .regime { padding: 18px; }
.as-landing .regime canvas { width: 100%; height: 156px; display: block; }
.as-landing .regime-tags { display: flex; justify-content: space-between; margin-top: 10px; }
.as-landing .regime-tags b { color: var(--loss); font-family: var(--font-mono); font-size: 12px; letter-spacing: .06em; }

/* ---- pillars ---- */
.as-landing .pillars { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 48px; }
@media (max-width: 780px) { .as-landing .pillars { grid-template-columns: 1fr; } }
.as-landing .pillar { padding: 27px 25px; transition: transform .18s ease, box-shadow .22s ease, border-color .2s ease; }
.as-landing .pillar::before { content:""; position: absolute; top: 0; left: 0; height: 2px; width: 0; background: linear-gradient(90deg, var(--accent), var(--accent-2)); box-shadow: 0 0 12px var(--glow); transition: width .3s ease; border-radius: 4px 4px 0 0; }
.as-landing .pillar:hover { transform: translateY(-4px); border-color: var(--line-strong); box-shadow: 0 20px 46px rgba(0,0,0,0.36), 0 0 32px var(--glow); }
.as-landing .pillar:hover::before { width: 100%; }
.as-landing .pillar .k { display: flex; align-items: center; gap: 10px; }
.as-landing .pillar .k .mono { color: var(--accent); }
.as-landing .pillar h3 { font-size: 1.3rem; margin: 14px 0 8px; }
.as-landing .pillar p { color: var(--muted); margin: 0 0 16px; font-size: 0.98rem; }
.as-landing .proof { font-family: var(--font-mono); font-size: 11.5px; line-height: 1.55; letter-spacing: .02em; color: var(--faint); border-top: 1px dashed var(--line-strong); padding-top: 12px; }
.as-landing .proof b { color: var(--accent); font-weight: 600; }

/* ---- pipeline ---- */
.as-landing .pipe { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 48px; position: relative; }
@media (max-width: 920px) { .as-landing .pipe { grid-template-columns: 1fr 1fr; } }
@media (max-width: 560px) { .as-landing .pipe { grid-template-columns: 1fr; } }
.as-landing .step { padding: 22px 18px; transition: border-color .2s ease, box-shadow .2s ease, transform .18s ease; }
.as-landing .step:hover { border-color: var(--line-strong); box-shadow: 0 0 26px var(--glow); transform: translateY(-3px); }
.as-landing .step .num { font-family: var(--font-mono); font-size: 12px; color: var(--accent); letter-spacing: .12em; text-shadow: 0 0 10px var(--glow); }
.as-landing .step h3 { font-size: 1.02rem; margin: 12px 0 6px; }
.as-landing .step p { color: var(--muted); font-size: 0.86rem; margin: 0; }

/* ---- audience ---- */
.as-landing .aud { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 46px; }
@media (max-width: 840px) { .as-landing .aud { grid-template-columns: repeat(2, 1fr); } }
.as-landing .aud > div { padding: 20px; transition: border-color .2s ease, box-shadow .2s ease; }
.as-landing .aud > div:hover { border-color: var(--line-strong); box-shadow: 0 0 24px var(--glow); }
.as-landing .aud .mono { color: var(--accent-2); }
.as-landing .aud p { margin: 8px 0 0; font-size: 0.92rem; color: var(--muted); }

/* ---- CTA ---- */
.as-landing .cta { text-align: center; }
.as-landing .cta-inner { padding: 62px 30px; }
.as-landing .cta h2 { font-size: clamp(2rem, 4.4vw, 3.1rem); margin: 12px auto 0; max-width: 22ch; line-height: 1.08; }
.as-landing .cta p { color: var(--muted); max-width: 54ch; margin: 18px auto 30px; }
.as-landing .cta .cta-row { justify-content: center; }

/* ---- footer ---- */
.as-landing footer { padding: 44px 0 60px; border-top: 1px solid var(--line); }
.as-landing .foot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 20px; align-items: flex-start; }
.as-landing .disclaimer { max-width: 60ch; font-size: 12px; color: var(--faint); line-height: 1.7; }
.as-landing .disclaimer b { color: var(--muted); }

.as-landing .reveal { opacity: 0; transform: translateY(18px); transition: opacity .7s ease, transform .7s ease; }
.as-landing .reveal.in { opacity: 1; transform: none; }
.as-landing :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  .as-landing .cursor, .as-landing .ticker .track, .as-landing .perf-dot.on, .as-landing .glyph::before, .as-landing .viz .scan, .as-landing .rd-dot { animation: none; }
  .as-landing .reveal { opacity: 1; transform: none; transition: none; }
}
`;

export function StrategiesLanding() {
  useEffect(() => {
    const root = document.querySelector(".as-landing");
    if (!root) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const q = (id: string) => root.querySelector<HTMLElement>(id);
    const tokenEl = root as HTMLElement;
    const tok = (n: string) => getComputedStyle(tokenEl).getPropertyValue(n).trim() || "#5fe6a2";

    let stopped = false;
    let meshRAF = 0;
    const cleanups: Array<() => void> = [];

    // ---- ambient neural mesh ----
    const mesh = q(".mesh") as HTMLCanvasElement | null;
    if (mesh) {
      const mctx = mesh.getContext("2d")!;
      let W = 0;
      let H = 0;
      let nodes: { x: number; y: number; vx: number; vy: number }[] = [];
      const sizeMesh = () => {
        W = mesh.clientWidth;
        H = mesh.clientHeight;
        mesh.width = W * dpr;
        mesh.height = H * dpr;
        mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const count = Math.min(60, Math.round((W * H) / 27000));
        nodes = [];
        for (let i = 0; i < count; i++) {
          nodes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22 });
        }
      };
      const drawMesh = () => {
        const acc = tok("--accent");
        mctx.clearRect(0, 0, W, H);
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > W) n.vx *= -1;
          if (n.y < 0 || n.y > H) n.vy *= -1;
        }
        for (let a = 0; a < nodes.length; a++) {
          for (let b = a + 1; b < nodes.length; b++) {
            const dx = nodes[a].x - nodes[b].x;
            const dy = nodes[a].y - nodes[b].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 130) {
              mctx.globalAlpha = (1 - d / 130) * 0.5;
              mctx.strokeStyle = acc;
              mctx.lineWidth = 0.6;
              mctx.beginPath();
              mctx.moveTo(nodes[a].x, nodes[a].y);
              mctx.lineTo(nodes[b].x, nodes[b].y);
              mctx.stroke();
            }
          }
        }
        mctx.globalAlpha = 0.9;
        for (const n of nodes) {
          mctx.beginPath();
          mctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2);
          mctx.fillStyle = acc;
          mctx.fill();
        }
        mctx.globalAlpha = 1;
      };
      const loopMesh = () => {
        if (stopped) return;
        drawMesh();
        meshRAF = requestAnimationFrame(loopMesh);
      };
      sizeMesh();
      if (reduce) drawMesh();
      else loopMesh();
      const onResizeMesh = () => sizeMesh();
      cleanups.push(() => {}); // mesh resize handled in shared resize below
      (root as HTMLElement & { __meshResize?: () => void }).__meshResize = onResizeMesh;
    }

    // ---- shared drawing helpers ----
    const series = (n: number, drift: number, vol: number, seed: number) => {
      const out: number[] = [];
      let v = 0;
      let s = seed;
      for (let i = 0; i < n; i++) {
        s = (s * 9301 + 49297) % 233280;
        v += drift + (s / 233280 - 0.5) * vol;
        out.push(v);
      }
      return out;
    };
    const fit = (c: HTMLCanvasElement) => {
      const r = c.getBoundingClientRect();
      const ctx = c.getContext("2d")!;
      c.width = Math.max(1, r.width * dpr);
      c.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, w: r.width, h: r.height };
    };

    // ---- hero equity curve ----
    const eq = q("#equity") as HTMLCanvasElement | null;
    const retEl = q("#viz-ret");
    const engine = series(120, 0.92, 3.4, 7);
    const bench = series(120, 0.34, 3.0, 21);
    const drawEq = (p: number) => {
      if (!eq) return;
      const { ctx, w, h } = fit(eq);
      const pad = 6;
      const acc = tok("--accent");
      const acc2 = tok("--accent-2");
      ctx.clearRect(0, 0, w, h);
      const all = engine.concat(bench);
      const lo = Math.min(...all);
      const hi = Math.max(...all);
      const rng = hi - lo || 1;
      const pt = (arr: number[], i: number): [number, number] => [pad + (i / (arr.length - 1)) * (w - pad * 2), h - pad - ((arr[i] - lo) / rng) * (h - pad * 2)];
      const count = Math.max(2, Math.floor(engine.length * p));
      ctx.beginPath();
      for (let b = 0; b < count; b++) {
        const pb = pt(bench, b);
        b ? ctx.lineTo(pb[0], pb[1]) : ctx.moveTo(pb[0], pb[1]);
      }
      ctx.strokeStyle = acc2;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
      const last = pt(engine, count - 1);
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const p2 = pt(engine, i);
        i ? ctx.lineTo(p2[0], p2[1]) : ctx.moveTo(p2[0], p2[1]);
      }
      ctx.lineTo(last[0], h - pad);
      ctx.lineTo(pt(engine, 0)[0], h - pad);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, acc + "55");
      g.addColorStop(1, acc + "00");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.beginPath();
      for (let j = 0; j < count; j++) {
        const qq = pt(engine, j);
        j ? ctx.lineTo(qq[0], qq[1]) : ctx.moveTo(qq[0], qq[1]);
      }
      ctx.strokeStyle = acc;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = "round";
      ctx.shadowColor = acc;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(last[0], last[1], 3.6, 0, Math.PI * 2);
      ctx.fillStyle = acc;
      ctx.shadowColor = acc;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
      if (retEl) {
        const pct = ((engine[count - 1] - engine[0]) / (Math.abs(engine[0]) + 8)) * 100;
        retEl.textContent = (pct >= 0 ? "▲ +" : "▼ ") + Math.abs(pct).toFixed(1) + "%";
      }
    };
    let startTs: number | null = null;
    const animEq = (ts: number) => {
      if (stopped) return;
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / 1500);
      drawEq(1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(animEq);
    };

    // ---- FX regime mini-chart ----
    const drawRegime = () => {
      const c = q("#regime") as HTMLCanvasElement | null;
      if (!c) return;
      const { ctx, w, h } = fit(c);
      const pad = 4;
      const d = series(90, -0.14, 1.1, 4);
      for (let i = 30; i < 90; i++) d[i] -= 6;
      for (let k = 60; k < 90; k++) d[k] -= 9;
      const lo = Math.min(...d);
      const hi = Math.max(...d);
      const rng = hi - lo || 1;
      ctx.clearRect(0, 0, w, h);
      [30, 60].forEach((mx) => {
        const x = pad + (mx / (d.length - 1)) * (w - pad * 2);
        ctx.beginPath();
        ctx.moveTo(x, pad);
        ctx.lineTo(x, h - pad);
        ctx.strokeStyle = tok("--loss");
        ctx.globalAlpha = 0.4;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      });
      ctx.beginPath();
      for (let j = 0; j < d.length; j++) {
        const x = pad + (j / (d.length - 1)) * (w - pad * 2);
        const y = h - pad - ((d[j] - lo) / rng) * (h - pad * 2);
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = tok("--muted");
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.stroke();
    };

    // ---- ticker ----
    const ticker = q("#ticker");
    if (ticker) {
      const syms = ["GTCO", "DANGCEM", "MTNN", "SEPLAT", "ZENITHBANK", "AIRTELAFRI", "BUAFOODS", "ACCESSCORP", "NESTLE", "ARADEL", "FBNH", "UBA", "STANBIC", "TRANSCORP", "OKOMUOIL", "PRESCO"];
      let html = "";
      for (let r = 0; r < 2; r++) {
        html += "<span><b>SIGNAL UNIVERSE</b></span>";
        for (const s of syms) html += `<span>${s} <b style="color:var(--accent)">◈</b></span>`;
      }
      ticker.innerHTML = html;
    }

    // ---- counters ----
    root.querySelectorAll<HTMLElement>(".n[data-count]").forEach((el) => {
      const target = parseInt(el.getAttribute("data-count") || "0", 10);
      const suf = el.getAttribute("data-suffix") || "";
      if (reduce) {
        el.textContent = target + suf;
        return;
      }
      let s: number | null = null;
      const stepFn = (ts: number) => {
        if (stopped) return;
        if (s === null) s = ts;
        const t = Math.min(1, (ts - s) / 900);
        el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))) + suf;
        if (t < 1) requestAnimationFrame(stepFn);
      };
      requestAnimationFrame(stepFn);
    });

    // ---- boot draws ----
    if (reduce) drawEq(1);
    else requestAnimationFrame(animEq);
    drawRegime();

    // ---- resize ----
    let rt: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        (root as HTMLElement & { __meshResize?: () => void }).__meshResize?.();
        drawEq(1);
        drawRegime();
      }, 160);
    };
    window.addEventListener("resize", onResize);

    // ---- scroll reveal ----
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    root.querySelectorAll<HTMLElement>("section .sec-head, .pillar, .step, .aud > div, .gap-grid > *, .perf-kpi, .perf-panel").forEach((el, i) => {
      el.classList.add("reveal");
      el.style.transitionDelay = (i % 5) * 45 + "ms";
      obs.observe(el);
    });

    return () => {
      stopped = true;
      cancelAnimationFrame(meshRAF);
      clearTimeout(rt);
      window.removeEventListener("resize", onResize);
      obs.disconnect();
    };
  }, []);

  return (
    <div className="as-landing">
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      <canvas className="mesh" aria-hidden="true" />
      <div className="grid-bg" aria-hidden="true" />

      <header>
        <div className="wrap bar">
          <div className="brand">
            <span className="glyph" aria-hidden="true" />
            <span className="name">
              Alternative&nbsp;<b>Strategies</b>
            </span>
          </div>
          <nav className="navlinks">
            <a href="#gap">The gap</a>
            <a href="#pillars">Platform</a>
            <a href="#performance">Performance</a>
            <a href="#pipeline">How it works</a>
            <Link href="/strategies/api-docs">API</Link>
          </nav>
          <div className="hdr-cta">
            <Link href="/strategies/login" className="signin">
              Sign in
            </Link>
            <Link href="/strategies/signup" className="btn btn-primary">
              Request access
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <div className="hero">
          <div className="wrap hero-grid">
            <div>
              <span className="eyebrow mono">
                {"// AI-native quant · frontier markets "}
                <span className="cursor" aria-hidden="true" />
              </span>
              <h1>
                Systematic strategies, <em>native to the frontier.</em>
              </h1>
              <p className="lede">
                An AI-native quantitative platform that carries a strategy from signal to governed execution — engineered for the
                liquidity, data gaps and FX regimes of emerging markets. Starting with the NGX.
              </p>
              <div className="cta-row">
                <Link href="/strategies/signup" className="btn btn-primary">
                  Request access
                </Link>
                <a href="#performance" className="btn btn-ghost">
                  View live performance
                </a>
              </div>
              <div className="readout" aria-hidden="true">
                <span>
                  <i className="rd-dot" />
                  System online
                </span>
                <span>Mode · Simulated</span>
                <span>Market · NGX</span>
                <span>Quotes · 20-min delay</span>
              </div>
              <div className="hero-stats">
                <div className="stat">
                  <span className="n" data-count="3">3</span>
                  <span className="l mono">Trading cadences</span>
                </div>
                <div className="stat">
                  <span className="n" data-count="40" data-suffix="+">40+</span>
                  <span className="l mono">Signal universe</span>
                </div>
                <div className="stat">
                  <span className="n">FX-aware</span>
                  <span className="l mono">Risk overlay</span>
                </div>
                <div className="stat">
                  <span className="n">Governed</span>
                  <span className="l mono">Paused by default</span>
                </div>
              </div>
            </div>

            <div className="viz glass hud" aria-hidden="true">
              <span className="scan" />
              <div className="viz-head">
                <span className="mono">Simulated equity curve</span>
                <span className="mono" id="viz-ret" style={{ color: "var(--accent)" }}>
                  —
                </span>
              </div>
              <canvas id="equity" />
              <div className="viz-legend mono">
                <span style={{ color: "var(--accent)" }}>
                  <i className="dot" />
                  Engine
                </span>
                <span style={{ color: "var(--accent-2)" }}>
                  <i className="dot" />
                  ASI benchmark
                </span>
              </div>
            </div>
          </div>

          <div className="wrap">
            <div className="ticker" aria-hidden="true">
              <div className="track" id="ticker" />
            </div>
          </div>
        </div>

        {/* GAP */}
        <section id="gap">
          <div className="wrap">
            <div className="sec-head">
              <span className="rule mono">The problem</span>
              <h2>Global quant assumes deep, liquid markets. The frontier isn&rsquo;t that.</h2>
            </div>
            <div className="gap-grid">
              <p className="gap-lead">
                Data is thin and fragmented, liquidity is shallow and uneven, and naïve models break at regime shifts. The{" "}
                <b>2016</b> and <b>2023</b> Nigerian FX resets erased strategies that never priced the currency. We build{" "}
                <b>for</b> those constraints — not in spite of them.
              </p>
              <div className="regime glass hud">
                <span className="mono">NGN devaluation shock · illustrative</span>
                <canvas id="regime" />
                <div className="regime-tags">
                  <b>2016 · float</b>
                  <b>2023 · unification</b>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="wrap">
          <hr className="sep" />
        </div>

        {/* PILLARS */}
        <section id="pillars">
          <div className="wrap">
            <div className="sec-head">
              <span className="rule mono">The platform</span>
              <h2>Four things that make it different.</h2>
              <p>Intelligence native to the loop, risk built for frontier depth, and governance a regulator recognises.</p>
            </div>
            <div className="pillars">
              <article className="pillar glass hud">
                <div className="k">
                  <span className="mono">01 · AI</span>
                </div>
                <h3>AI-native, not AI-bolted-on</h3>
                <p>A frontier LLM runs the whole loop — factor-signal research, portfolio construction, a written performance analyst, and a conversational desk assistant.</p>
                <div className="proof">
                  <b>Live:</b> 40-name factor leaderboard · AI-selected books · streamed monthly &amp; annual performance reports
                </div>
              </article>
              <article className="pillar glass hud">
                <div className="k">
                  <span className="mono">02 · Flow</span>
                </div>
                <h3>Research → execution, governed</h3>
                <p>Signals become a risk-sized book and scheduled, simulated execution — with humans on the governance and compliance gates only.</p>
                <div className="proof">
                  <b>Live:</b> intraday / weekly / monthly cadences · holiday-aware scheduler · paused-by-default with step-up auth
                </div>
              </article>
              <article className="pillar glass hud">
                <div className="k">
                  <span className="mono">03 · Risk</span>
                </div>
                <h3>Frontier-market risk, by design</h3>
                <p>Single-name and liquidity caps calibrated to real NGX depth, volatility-scaled sizing, an FX-devaluation overlay and drawdown halts.</p>
                <div className="proof">
                  <b>Live:</b> risk overlay trimmed 3 of 4 positions to the 15% single-name cap in testing
                </div>
              </article>
              <article className="pillar glass hud">
                <div className="k">
                  <span className="mono">04 · Trust</span>
                </div>
                <h3>Built for a dual-regulated desk</h3>
                <p>Simulated and illustrative by default, delayed-quote disclosure, PM/IC approval workflows and audit logging throughout.</p>
                <div className="proof">
                  <b>Posture:</b> FCA-UK / SEC-Nigeria across every AI and trading surface
                </div>
              </article>
            </div>
          </div>
        </section>

        <div className="wrap">
          <hr className="sep" />
        </div>

        {/* PIPELINE */}
        <section id="pipeline">
          <div className="wrap">
            <div className="sec-head">
              <span className="rule mono">How it works</span>
              <h2>An automated research-to-execution architecture.</h2>
              <p>One pipeline, five stages — every strategy is validated on the record before capital is committed.</p>
            </div>
            <div className="pipe">
              <div className="step glass hud">
                <span className="num">01</span>
                <h3>Ingest &amp; signal</h3>
                <p>NGX prices, fundamentals and FX, normalised; factors scored across price, value, liquidity and volatility.</p>
              </div>
              <div className="step glass hud">
                <span className="num">02</span>
                <h3>AI construction</h3>
                <p>Candidate books assembled from the signal set, reconciled to live prices.</p>
              </div>
              <div className="step glass hud">
                <span className="num">03</span>
                <h3>Frontier risk</h3>
                <p>Position caps, ADV-liquidity limits, vol scaling and the FX overlay size the book.</p>
              </div>
              <div className="step glass hud">
                <span className="num">04</span>
                <h3>Governed execution</h3>
                <p>Scheduled simulated fills at open/close windows — paused until an admin enables it.</p>
              </div>
              <div className="step glass hud">
                <span className="num">05</span>
                <h3>Performance feedback</h3>
                <p>Monthly &amp; annual statements and AI reviews compound into the track record.</p>
              </div>
            </div>
          </div>
        </section>

        {/* LIVE PERFORMANCE */}
        <PerformanceSection />

        {/* AUDIENCE */}
        <section id="who">
          <div className="wrap">
            <div className="sec-head">
              <span className="rule mono">Who it&rsquo;s for</span>
              <h2>The desks that need Nigeria-native systematic capability.</h2>
            </div>
            <div className="aud">
              <div className="glass hud">
                <span className="mono">EM / frontier funds</span>
                <p>Asset managers hunting alpha where global tools go blind.</p>
              </div>
              <div className="glass hud">
                <span className="mono">Fund &amp; portfolio mgrs</span>
                <p>Nigerian PFAs, CIS managers and family offices seeking a systematic edge.</p>
              </div>
              <div className="glass hud">
                <span className="mono">Corridor investors</span>
                <p>Diaspora and Nigeria–UK capital that wants disciplined NGX exposure.</p>
              </div>
              <div className="glass hud">
                <span className="mono">Internal quant / BD</span>
                <p>Research and business-development desks building Nigeria-native strategy.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="contact" className="cta">
          <div className="wrap">
            <div className="cta-inner glass hud">
              <span className="rule mono" style={{ display: "inline-flex" }}>
                Get started
              </span>
              <h2>Bring quant discipline to the frontier.</h2>
              <p>Create an account to read the monthly Strategist&rsquo;s Thesis and follow the simulated programme across intraday, weekly and monthly cadences in real time.</p>
              <div className="cta-row">
                <Link href="/strategies/signup" className="btn btn-primary">
                  Request access
                </Link>
                <Link href="/strategies/login" className="btn btn-ghost">
                  Member sign-in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap foot">
          <div className="brand">
            <span className="glyph" aria-hidden="true" />
            <span className="name">
              Alternative&nbsp;<b>Strategies</b>
            </span>
          </div>
          <p className="disclaimer">
            <b>Simulated / illustrative.</b> The platform paper-trades only — it places no real orders and holds no client
            assets. Signals are computed factors, not predictions; performance shown is marked simulated performance, not
            realised client returns. Not investment advice, not a recommendation, and not an offer. Prices are delayed up to
            20 minutes during NGX hours; past performance does not indicate future results. © Alternative Strategies.
          </p>
        </div>
      </footer>
    </div>
  );
}
