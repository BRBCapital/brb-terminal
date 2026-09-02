// Broker portal styles, scoped under `.as-shell` (shared with the strategies
// theme tokens). Used by the dashboard and the API-keys settings page.
export const BROKER_CSS = `
.as-shell .bk-header { position:sticky; top:0; z-index:30; border-bottom:1px solid var(--line); background:color-mix(in srgb, var(--bg) 72%, transparent); backdrop-filter:blur(12px); }
.as-shell .bk-bar { max-width:1160px; margin:0 auto; padding:0 26px; height:62px; display:flex; align-items:center; gap:18px; }
.as-shell .bk-nav { display:flex; gap:18px; margin-left:14px; }
.as-shell .bk-navlink { font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); text-decoration:none; }
.as-shell .bk-navlink:hover { color:var(--accent); }
.as-shell .bk-navlink.active { color:var(--ink); }
.as-shell .bk-right { margin-left:auto; display:flex; align-items:center; gap:12px; }
.as-shell .bk-modes { display:inline-flex; border:1px solid var(--line-strong); border-radius:999px; padding:2px; }
.as-shell .bk-mode { font-family:var(--font-mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); background:transparent; border:none; border-radius:999px; padding:5px 12px; cursor:pointer; }
.as-shell .bk-mode.on.sandbox { background:var(--accent); color:var(--accent-ink); font-weight:600; }
.as-shell .bk-mode.on.live { background:#e0a44e; color:#241300; font-weight:700; box-shadow:0 0 14px rgba(224,164,78,.5); }
.as-shell .bk-signout { font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); background:transparent; border:1px solid var(--line-strong); border-radius:6px; padding:8px 12px; cursor:pointer; }
.as-shell .bk-signout:hover { color:var(--accent); border-color:var(--accent); }
@media (max-width:680px){ .as-shell .bk-nav{ display:none; } }

.as-shell .bk-main { max-width:1160px; margin:0 auto; padding:40px 26px 80px; }
.as-shell .bk-eyebrow { display:inline-flex; align-items:center; gap:10px; font-family:var(--font-mono); font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--muted); }
.as-shell .bk-eyebrow::before { content:""; width:24px; height:1px; background:var(--accent); box-shadow:0 0 8px var(--glow); }
.as-shell .bk-hero h1 { font-family:var(--font-display); font-size:clamp(1.8rem,4vw,2.6rem); margin:14px 0 8px; }
.as-shell .bk-hero p { color:var(--muted); max-width:60ch; }
.as-shell .bk-hero b.live { color:#e0a44e; text-transform:uppercase; } .as-shell .bk-hero b.sand { color:var(--accent); text-transform:uppercase; }

.as-shell .bk-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:24px; }
@media (max-width:720px){ .as-shell .bk-kpis{ grid-template-columns:repeat(2,1fr); } }
.as-shell .bk-kpi { padding:15px 17px; display:flex; flex-direction:column; gap:7px; }
.as-shell .bk-kpi b { font-family:var(--font-mono); font-size:1.35rem; font-weight:600; font-variant-numeric:tabular-nums; }
.as-shell .pos { color:var(--accent); } .as-shell .neg { color:var(--loss); }

.as-shell .bk-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:14px; }
@media (max-width:820px){ .as-shell .bk-grid{ grid-template-columns:1fr; } }
.as-shell .bk-panel { padding:22px 24px; }
.as-shell .bk-panel h2 { font-family:var(--font-display); font-size:1.15rem; margin:0; }
.as-shell .bk-note { color:var(--muted); font-size:.9rem; margin:6px 0 14px; }
.as-shell .bk-panel-head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px; }
.as-shell .bk-sub { color:var(--faint); }
.as-shell .bk-modetag { text-transform:uppercase; color:var(--faint); font-size:10px; border:1px solid var(--line); border-radius:999px; padding:2px 8px; margin-left:6px; }

.as-shell .bk-aum { display:flex; align-items:center; gap:10px; }
.as-shell .bk-cur { font-family:var(--font-display); font-size:1.5rem; color:var(--muted); }
.as-shell .bk-aum input { flex:1; min-width:0; padding:12px 14px; border-radius:8px; border:1px solid var(--line-strong); background:color-mix(in srgb, var(--bg) 60%, transparent); color:var(--ink); font-family:var(--font-mono); font-size:1.15rem; outline:none; }
.as-shell .bk-aum input:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--glow); }

.as-shell .bk-alloc { display:flex; flex-direction:column; gap:2px; }
.as-shell .bk-alloc-row { display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:1px dashed var(--line); }
.as-shell .bk-alloc-row:last-child { border-bottom:none; }
.as-shell .bk-alloc-c { text-transform:uppercase; color:var(--muted); }
.as-shell .bk-alloc-v { font-size:1.02rem; color:var(--ink); font-variant-numeric:tabular-nums; }
.as-shell .bk-risk { margin-top:14px; padding-top:12px; border-top:1px solid var(--line); color:var(--faint); font-size:10.5px; letter-spacing:.03em; line-height:1.6; }

.as-shell .bk-tablewrap { overflow-x:auto; }
.as-shell .bk-table { width:100%; min-width:640px; border-collapse:collapse; font-size:13px; }
.as-shell .bk-table th { text-align:left; font-family:var(--font-mono); font-size:9.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); padding:8px 10px; border-bottom:1px solid var(--line); }
.as-shell .bk-table th.r, .as-shell .bk-table td.r { text-align:right; }
.as-shell .bk-table td { padding:10px; border-bottom:1px solid var(--line); }
.as-shell .bk-table td b { font-weight:600; }
.as-shell .bk-co { display:block; font-size:10px; color:var(--faint); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.as-shell .bk-st { font-family:var(--font-mono); font-size:10px; text-transform:uppercase; padding:2px 8px; border-radius:999px; }
.as-shell .bk-st.open { background:var(--brb-soft, color-mix(in srgb, var(--accent) 16%, transparent)); color:var(--accent); }
.as-shell .bk-st.closed { background:color-mix(in srgb, var(--faint) 22%, transparent); color:var(--muted); }
.as-shell .bk-empty { color:var(--muted); font-size:.95rem; line-height:1.7; }

.as-shell .bk-disclaimer { margin-top:22px; color:var(--faint); font-size:10px; letter-spacing:.06em; }

/* settings / keys */
.as-shell .bk-key { margin-top:16px; }
.as-shell .bk-key-head { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
.as-shell .bk-key-head .lbl { font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; }
.as-shell .bk-key-head .lbl.sandbox { color:var(--accent); } .as-shell .bk-key-head .lbl.live { color:#e0a44e; }
.as-shell .bk-key-row { display:flex; gap:8px; align-items:center; }
.as-shell .bk-key-val { flex:1; min-width:0; font-family:var(--font-mono); font-size:12.5px; padding:11px 13px; border:1px solid var(--line-strong); border-radius:8px; background:color-mix(in srgb, var(--bg) 55%, transparent); color:var(--ink); overflow-x:auto; white-space:nowrap; }
.as-shell .bk-btn-sm { font-family:var(--font-mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase; padding:9px 12px; border-radius:7px; border:1px solid var(--line-strong); background:transparent; color:var(--ink); cursor:pointer; white-space:nowrap; }
.as-shell .bk-btn-sm:hover { border-color:var(--accent); color:var(--accent); }
.as-shell .bk-base { margin-top:6px; font-family:var(--font-mono); font-size:11px; color:var(--faint); }
.as-shell .bk-warn { margin-top:16px; border:1px solid color-mix(in srgb, #e0a44e 50%, transparent); background:color-mix(in srgb, #e0a44e 10%, transparent); border-radius:8px; padding:12px 14px; font-size:12.5px; color:var(--muted); line-height:1.6; }
`;
