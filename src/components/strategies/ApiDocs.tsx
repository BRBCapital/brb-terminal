"use client";

import { useState } from "react";
import Link from "next/link";
import { AS_THEME_CSS } from "./theme";

const DOCS_CSS = `
.as-shell .doc-header { position:sticky; top:0; z-index:30; border-bottom:1px solid var(--line); background:color-mix(in srgb, var(--bg) 72%, transparent); backdrop-filter:blur(12px); }
.as-shell .doc-bar { max-width:1180px; margin:0 auto; padding:0 26px; height:60px; display:flex; align-items:center; justify-content:space-between; gap:14px; }
.as-shell .doc-bar .links { display:flex; gap:18px; align-items:center; }
.as-shell .doc-bar a.nl { font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); text-decoration:none; }
.as-shell .doc-bar a.nl:hover { color:var(--accent); }
.as-shell .doc-wrap { max-width:1180px; margin:0 auto; padding:0 26px; display:grid; grid-template-columns:210px 1fr; gap:40px; }
@media (max-width:900px){ .as-shell .doc-wrap{ grid-template-columns:1fr; } .as-shell .doc-toc{ display:none; } }
.as-shell .doc-toc { position:sticky; top:80px; align-self:start; padding-top:40px; display:flex; flex-direction:column; gap:7px; }
.as-shell .doc-toc a { font-family:var(--font-mono); font-size:11px; letter-spacing:.04em; color:var(--muted); text-decoration:none; padding:3px 0; }
.as-shell .doc-toc a:hover { color:var(--accent); }
.as-shell .doc-toc .grp { font-size:9.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--faint); margin-top:12px; }
.as-shell .doc-body { padding:40px 0 90px; min-width:0; }
.as-shell .doc-body h1 { font-family:var(--font-display); font-size:clamp(2rem,4vw,2.7rem); margin:0 0 6px; }
.as-shell .doc-body .lede { color:var(--muted); font-size:1.08rem; max-width:70ch; }
.as-shell .doc-sec { margin-top:44px; scroll-margin-top:78px; }
.as-shell .doc-sec h2 { font-family:var(--font-display); font-size:1.5rem; margin:0 0 6px; }
.as-shell .doc-sec h3 { font-family:var(--font-mono); font-size:13px; letter-spacing:.02em; margin:22px 0 8px; display:flex; align-items:center; gap:10px; }
.as-shell .doc-body p { color:color-mix(in srgb, var(--ink) 84%, transparent); font-size:.98rem; line-height:1.7; max-width:70ch; margin:10px 0; }
.as-shell .doc-body b { color:var(--ink); }
.as-shell .m { font-family:var(--font-mono); font-size:11px; font-weight:700; padding:2px 7px; border-radius:5px; }
.as-shell .m.get { color:var(--accent); background:color-mix(in srgb, var(--accent) 15%, transparent); }
.as-shell .m.post { color:#e0a44e; background:color-mix(in srgb, #e0a44e 15%, transparent); }
.as-shell .path { font-family:var(--font-mono); font-size:13px; color:var(--ink); }
.as-shell pre { margin:12px 0; background:color-mix(in srgb, var(--bg) 55%, transparent); border:1px solid var(--line); border-radius:10px; padding:0; overflow:hidden; }
.as-shell pre .pre-top { display:flex; justify-content:space-between; align-items:center; padding:7px 12px; border-bottom:1px solid var(--line); }
.as-shell pre .pre-top span { font-family:var(--font-mono); font-size:9.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); }
.as-shell pre .cpy { font-family:var(--font-mono); font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); background:transparent; border:1px solid var(--line-strong); border-radius:5px; padding:3px 8px; cursor:pointer; }
.as-shell pre .cpy:hover { color:var(--accent); border-color:var(--accent); }
.as-shell pre code { display:block; font-family:var(--font-mono); font-size:12.5px; line-height:1.7; color:var(--ink); padding:14px 16px; overflow-x:auto; white-space:pre; }
.as-shell .ck { color:var(--accent); } .as-shell .cs { color:#e0a44e; } .as-shell .cc { color:var(--faint); }
.as-shell .doc-table { overflow-x:auto; margin:12px 0; border:1px solid var(--line); border-radius:10px; }
.as-shell table.dt { border-collapse:collapse; width:100%; min-width:520px; font-size:13px; }
.as-shell table.dt th { text-align:left; font-family:var(--font-mono); font-size:9.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); padding:9px 12px; border-bottom:1px solid var(--line); background:color-mix(in srgb, var(--bg) 50%, transparent); }
.as-shell table.dt td { padding:9px 12px; border-bottom:1px solid var(--line); vertical-align:top; color:color-mix(in srgb, var(--ink) 84%, transparent); }
.as-shell table.dt tr:last-child td { border-bottom:none; }
.as-shell table.dt td.mono, .as-shell table.dt code { font-family:var(--font-mono); font-size:12px; }
.as-shell .callout { margin:14px 0; border:1px solid var(--line-strong); border-left:3px solid var(--accent); border-radius:8px; padding:12px 15px; background:color-mix(in srgb, var(--accent) 6%, transparent); }
.as-shell .callout p { margin:0; font-size:.92rem; }
.as-shell .doc-foot { border-top:1px solid var(--line); margin-top:50px; padding:22px 0 60px; font-family:var(--font-mono); font-size:10px; letter-spacing:.05em; color:var(--faint); line-height:1.8; max-width:80ch; }
`;

function Code({ lang, children }: { lang: string; children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <pre>
      <span className="pre-top">
        <span>{lang}</span>
        <button className="cpy" onClick={async () => { try { await navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* ignore */ } }}>
          {copied ? "Copied" : "Copy"}
        </button>
      </span>
      <code>{children}</code>
    </pre>
  );
}

export function ApiDocs() {
  return (
    <div className="as-shell">
      <style dangerouslySetInnerHTML={{ __html: AS_THEME_CSS + DOCS_CSS }} />
      <header className="doc-header">
        <div className="doc-bar">
          <Link href="/strategies" className="brand">
            <span className="glyph" aria-hidden="true" />
            <span className="name">Alternative&nbsp;<b>Strategies</b></span>
          </Link>
          <div className="links">
            <Link href="/strategies/api-docs/explorer" className="nl">Explorer</Link>
            <a href="/api/v1/openapi.json" className="nl" target="_blank" rel="noreferrer">OpenAPI ⤓</a>
            <Link href="/broker/login" className="nl">Broker sign-in →</Link>
          </div>
        </div>
      </header>

      <div className="doc-wrap">
        <nav className="doc-toc">
          <a href="#intro">Overview</a>
          <a href="#auth">Authentication</a>
          <a href="#envs">Environments</a>
          <a href="#conventions">Conventions</a>
          <span className="grp">Endpoints</span>
          <a href="#account">GET /account</a>
          <a href="#signals">GET /signals</a>
          <a href="#transactions">GET /transactions</a>
          <a href="#reports">POST /execution-reports</a>
          <span className="grp">Reference</span>
          <a href="#lifecycle">Order lifecycle</a>
          <a href="#errors">Errors</a>
        </nav>

        <main className="doc-body">
          <h1>Engine API — broker integration</h1>
          <p className="lede">
            Pull AI-generated trade signals scaled to your firm&rsquo;s AUM, track the transactions allocated to your account,
            and report executions back. You execute, custody and settle on your own regulated rails — the engine provides the
            signals.
          </p>

          <section className="doc-sec" id="intro">
            <h2>Overview</h2>
            <p>
              The Alternative Strategies engine researches, selects and risk-sizes an NGX model book across intraday, weekly
              and monthly horizons. For each active broker, that model is <b>scaled to the AUM</b> you set in your portal and
              exposed as orders. A single AUM ratio preserves the engine&rsquo;s risk limits (single-name cap, liquidity cap,
              stop-loss, drawdown halt, FX overlay).
            </p>
            <div className="callout"><p><b>Simulated / illustrative.</b> Signals are computed factors, not advice or a guarantee. Execution, custody and settlement are performed by you, the regulated broker.</p></div>
          </section>

          <section className="doc-sec" id="auth">
            <h2>Authentication</h2>
            <p>Every request is authenticated with an API key issued in your broker portal (<Link href="/broker/settings">API keys</Link>). Pass it as a bearer token:</p>
            <Code lang="http">{`Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
            <p>The key you use selects the environment: a <b>sandbox key</b> reads/writes sandbox data, a <b>live key</b> reads/writes live data. Rotating a key in the portal immediately invalidates the previous one.</p>
          </section>

          <section className="doc-sec" id="envs">
            <h2>Environments</h2>
            <div className="doc-table">
              <table className="dt">
                <thead><tr><th>Environment</th><th>Key prefix</th><th>Purpose</th></tr></thead>
                <tbody>
                  <tr><td>Sandbox</td><td className="mono">sk_sandbox_…</td><td>Integrate and test end-to-end without affecting your live book.</td></tr>
                  <tr><td>Live</td><td className="mono">sk_live_…</td><td>Production signals for your real execution flow.</td></tr>
                </tbody>
              </table>
            </div>
            <p>Base path: <span className="path">/api/v1</span>. All responses are JSON with an <code>ok</code> boolean.</p>
            <p>Import the machine-readable spec into Postman, Insomnia or Swagger UI: <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer">/api/v1/openapi.json</a> <span className="mono" style={{ color: "var(--faint)" }}>(OpenAPI 3.1)</span>. Or try calls in-browser with the <Link href="/strategies/api-docs/explorer">interactive API explorer</Link>.</p>
          </section>

          <section className="doc-sec" id="conventions">
            <h2>Conventions</h2>
            <p><b>Idempotency.</b> Each allocated order has a stable <code>clientOrderId</code>. Reference it when you report executions; posting the same report twice is safe.</p>
            <p><b>Amounts.</b> Monetary fields are Nigerian naira (<code>_ngn</code> suffix). Quantities are whole shares.</p>
            <p><b>Errors.</b> Non-2xx responses return <code>{`{ "ok": false, "error": "…" }`}</code>. See <a href="#errors">Errors</a>.</p>
          </section>

          {/* ACCOUNT */}
          <section className="doc-sec" id="account">
            <h2>Account</h2>
            <h3><span className="m get">GET</span> <span className="path">/api/v1/account</span></h3>
            <p>Your account, environment and how your AUM is deployed across cadences.</p>
            <Code lang="curl">{`curl https://<host>/api/v1/account \\
  -H "Authorization: Bearer sk_sandbox_xxx"`}</Code>
            <Code lang="200 response">{`{
  "ok": true,
  "account": {
    "firm": "Lagos Alpha Securities",
    "mode": "sandbox",
    "aum_ngn": 250000000,
    "status": "active",
    "engine_model_capital_ngn": 100000000,
    "allocation": { "intraday": 50000000, "weekly": 75000000, "monthly": 125000000 },
    "risk": { "max_position_pct": 15, "max_pct_daily_volume": 10, "stop_loss_pct": 8, "drawdown_halt_pct": 20, "fx_overlay": true }
  }
}`}</Code>
          </section>

          {/* SIGNALS */}
          <section className="doc-sec" id="signals">
            <h2>Signals</h2>
            <h3><span className="m get">GET</span> <span className="path">/api/v1/signals</span></h3>
            <p>The <b>open</b> orders the engine has allocated to you, scaled to your AUM — the instructions to execute now.</p>
            <Code lang="curl">{`curl https://<host>/api/v1/signals \\
  -H "Authorization: Bearer sk_sandbox_xxx"`}</Code>
            <Code lang="200 response">{`{
  "ok": true,
  "mode": "sandbox",
  "count": 1,
  "signals": [
    {
      "clientOrderId": "st_a1b2c3",
      "side": "BUY",
      "symbol": "GTCO",
      "quantity": 30000,
      "notional_ngn": 1750000,
      "referencePrice": 58.40,
      "weightPct": 3.2,
      "tenure": "INTRADAY",
      "factors": { "composite": 78, "momentum": 71, "liquidity": 83, "volatility": 40, "value": 62 },
      "brokerStatus": "allocated"
    }
  ]
}`}</Code>
          </section>

          {/* TRANSACTIONS */}
          <section className="doc-sec" id="transactions">
            <h2>Transactions</h2>
            <h3><span className="m get">GET</span> <span className="path">/api/v1/transactions</span></h3>
            <p>Every order allocated to you — open and closed — with realised P&amp;L, for the key&rsquo;s environment.</p>
            <Code lang="200 response">{`{
  "ok": true,
  "mode": "sandbox",
  "count": 2,
  "transactions": [
    {
      "clientOrderId": "st_a1b2c3",
      "side": "BUY", "symbol": "GTCO", "company": "Guaranty Trust",
      "tenure": "INTRADAY", "quantity": 30000, "entryPrice": 58.40,
      "notional_ngn": 1750000, "status": "closed", "brokerStatus": "filled",
      "closePrice": 59.10, "realizedPnl_ngn": 21000,
      "openedAt": "2026-08-11T09:33:00Z", "closedAt": "2026-08-12T14:05:00Z"
    }
  ]
}`}</Code>
          </section>

          {/* EXECUTION REPORTS */}
          <section className="doc-sec" id="reports">
            <h2>Execution reports</h2>
            <h3><span className="m post">POST</span> <span className="path">/api/v1/execution-reports</span></h3>
            <p>Report what happened to an allocated order. Reference it by <code>clientOrderId</code>.</p>
            <div className="doc-table">
              <table className="dt">
                <thead><tr><th>Field</th><th>Type</th><th>Notes</th></tr></thead>
                <tbody>
                  <tr><td className="mono">clientOrderId</td><td className="mono">string</td><td>The order&rsquo;s id from <code>/signals</code>.</td></tr>
                  <tr><td className="mono">status</td><td className="mono">string</td><td><code>acknowledged</code> · <code>filled</code> · <code>rejected</code> · <code>cancelled</code></td></tr>
                </tbody>
              </table>
            </div>
            <Code lang="curl">{`curl -X POST https://<host>/api/v1/execution-reports \\
  -H "Authorization: Bearer sk_sandbox_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "clientOrderId": "st_a1b2c3", "status": "filled" }'`}</Code>
            <Code lang="200 response">{`{
  "ok": true,
  "clientOrderId": "st_a1b2c3",
  "recorded": "filled",
  "order": { "symbol": "GTCO", "quantity": 30000, "brokerStatus": "filled" }
}`}</Code>
          </section>

          {/* LIFECYCLE */}
          <section className="doc-sec" id="lifecycle">
            <h2>Order lifecycle</h2>
            <p>An allocated order moves through: <code>allocated</code> → <code>acknowledged</code> → <code>filled</code> (or <code>rejected</code> / <code>cancelled</code>). The engine independently marks the position <code>open</code> then <code>closed</code> at the end of its tenure; closing produces a realised P&amp;L on the transaction.</p>
          </section>

          {/* ERRORS */}
          <section className="doc-sec" id="errors">
            <h2>Errors</h2>
            <div className="doc-table">
              <table className="dt">
                <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
                <tbody>
                  <tr><td className="mono">400</td><td>Malformed request (bad JSON, missing field).</td></tr>
                  <tr><td className="mono">401</td><td>Missing or invalid API key.</td></tr>
                  <tr><td className="mono">404</td><td>Referenced order not found in this environment.</td></tr>
                  <tr><td className="mono">422</td><td>Unprocessable — e.g. an unsupported status value.</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <div className="doc-foot">
            Simulated / illustrative · not investment advice, not a recommendation, not an offer. Prices are delayed up to 20
            minutes during NGX hours; past performance does not indicate future results. Execution, custody and settlement are
            performed by the regulated broker. &copy; Alternative Strategies.
          </div>
        </main>
      </div>
    </div>
  );
}
