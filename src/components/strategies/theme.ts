// Shared scoped design tokens + primitives for the Alternative Strategies
// prospect portal (auth + member insights pages). Everything is scoped under
// `.as-shell` so it never leaks into the app and can't collide with app tokens.
// Dark is the default; `html:not(.dark)` opts into light, following the app-wide
// theme toggle — mirrors the landing's `.as-landing` treatment.
export const AS_THEME_CSS = `
.as-shell {
  --bg:#050f0c; --bg2:#081711; --panel:rgba(13,30,23,0.55); --panel-solid:#0b1a14;
  --line:rgba(120,220,165,0.14); --line-strong:rgba(120,220,165,0.30);
  --ink:#e9f4ee; --muted:#8fb0a1; --faint:#5f7d70;
  --accent:#5fe6a2; --accent-2:#45cfe0; --accent-ink:#041009;
  --glow:rgba(95,230,162,0.45); --glow-2:rgba(69,207,224,0.40); --loss:#ff7a63;
  --font-display: var(--font-lora), Georgia, "Times New Roman", serif;
  --font-sans: var(--font-poppins), system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  position: relative; min-height: 100vh; width: 100%;
  background: var(--bg); color: var(--ink); font-family: var(--font-sans);
  line-height: 1.6; -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
html:not(.dark) .as-shell {
  --bg:#eaf0ea; --bg2:#f2f6f1; --panel:rgba(255,255,255,0.72); --panel-solid:#ffffff;
  --line:rgba(20,80,50,0.16); --line-strong:rgba(20,110,66,0.34);
  --ink:#0a1f16; --muted:#4f6a5d; --faint:#7c9488;
  --accent:#12925a; --accent-2:#1596ac; --accent-ink:#ffffff;
  --glow:rgba(18,146,90,0.24); --glow-2:rgba(21,150,172,0.22); --loss:#c0392b;
}
.as-shell * { box-sizing: border-box; }
.as-shell::before {
  content:""; position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(680px 420px at 82% 0%, var(--glow-2), transparent 60%),
    radial-gradient(720px 520px at 8% 2%, var(--glow), transparent 62%),
    linear-gradient(180deg, var(--bg), var(--bg2));
  opacity: 0.9;
}
.as-shell > * { position: relative; z-index: 1; }
.as-shell a { color: inherit; }
.as-shell .mono { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }
.as-shell h1, .as-shell h2, .as-shell h3 { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.012em; margin: 0; }
.as-shell .glass { background: var(--panel); backdrop-filter: blur(14px) saturate(1.1); -webkit-backdrop-filter: blur(14px) saturate(1.1); border: 1px solid var(--line); border-radius: 8px; }
.as-shell .hud { position: relative; }
.as-shell .hud::before, .as-shell .hud::after { content:""; position: absolute; width: 12px; height: 12px; border-color: var(--line-strong); border-style: solid; pointer-events: none; }
.as-shell .hud::before { top:-1px; left:-1px; border-width: 1px 0 0 1px; }
.as-shell .hud::after { bottom:-1px; right:-1px; border-width: 0 1px 1px 0; }
.as-shell .glyph { width: 22px; height: 22px; position: relative; display: inline-block; }
.as-shell .glyph::before { content:""; position: absolute; inset: 0; border: 1.5px solid var(--accent); border-radius: 5px; transform: rotate(45deg); box-shadow: 0 0 12px var(--glow); }
.as-shell .glyph::after { content:""; position: absolute; inset: 7px; background: var(--accent); border-radius: 2px; box-shadow: 0 0 10px var(--glow); }
.as-shell .brand { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; }
.as-shell .brand .name { font-family: var(--font-display); font-weight: 700; font-size: 17px; letter-spacing: -0.01em; color: var(--ink); }
.as-shell .brand .name b { color: var(--accent); font-weight: 700; }
.as-shell .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.09em; text-transform: uppercase; text-decoration: none; padding: 11px 18px; border-radius: 6px; cursor: pointer; transition: transform .15s ease, box-shadow .2s ease, border-color .2s ease, color .2s ease; }
.as-shell .btn:disabled { opacity: .55; cursor: not-allowed; }
.as-shell .btn-primary { background: var(--accent); color: var(--accent-ink); border: 1px solid var(--accent); font-weight: 600; }
.as-shell .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 26px var(--glow); }
.as-shell .btn-ghost { border: 1px solid var(--line-strong); color: var(--ink); background: transparent; }
.as-shell .btn-ghost:hover { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 22px var(--glow); }
.as-shell :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
`;
