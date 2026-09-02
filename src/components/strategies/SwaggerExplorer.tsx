"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import "swagger-ui-react/swagger-ui.css";

// Swagger UI is browser-only — load it client-side (no SSR) and point it at our
// self-hosted OpenAPI 3.1 document. Fully bundled; no external CDN.
const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => <div className="swui-loading">Loading API explorer…</div>,
});

const CSS = `
.swui-root { min-height:100vh; background:#0a130f; }
.swui-bar { position:sticky; top:0; z-index:10; display:flex; align-items:center; justify-content:space-between; gap:14px;
  padding:0 26px; height:60px; border-bottom:1px solid rgba(120,220,165,.16);
  background:rgba(8,17,13,.8); backdrop-filter:blur(12px);
  font-family:var(--font-poppins),system-ui,sans-serif; }
.swui-brand { display:flex; align-items:center; gap:11px; text-decoration:none; }
.swui-brand .gl { width:20px; height:20px; position:relative; }
.swui-brand .gl::before { content:""; position:absolute; inset:0; border:1.5px solid #5fe6a2; border-radius:5px; transform:rotate(45deg); box-shadow:0 0 12px rgba(95,230,162,.45); }
.swui-brand .gl::after { content:""; position:absolute; inset:6px; background:#5fe6a2; border-radius:2px; }
.swui-brand b { font-family:var(--font-lora),Georgia,serif; font-size:16px; font-weight:700; color:#e9f4ee; letter-spacing:-.01em; }
.swui-brand b span { color:#5fe6a2; }
.swui-links { display:flex; gap:18px; align-items:center; }
.swui-links a { font-family:var(--font-mono,ui-monospace),monospace; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:#8fb0a1; text-decoration:none; }
.swui-links a:hover { color:#5fe6a2; }
.swui-note { max-width:1200px; margin:0 auto; padding:16px 26px 0; font-family:var(--font-poppins),system-ui,sans-serif; font-size:13px; color:#8fb0a1; }
.swui-note b { color:#e9f4ee; }
.swui-surface { max-width:1200px; margin:10px auto 40px; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,.4); }
.swui-loading { padding:60px 26px; text-align:center; color:#8fb0a1; font-family:var(--font-poppins),system-ui,sans-serif; }
.swui-surface .swagger-ui .topbar { display:none; }
.swui-surface .swagger-ui { padding:8px 4px; }
`;

export function SwaggerExplorer() {
  return (
    <div className="swui-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="swui-bar">
        <Link href="/strategies" className="swui-brand">
          <span className="gl" aria-hidden="true" />
          <b>Alternative&nbsp;<span>Strategies</span></b>
        </Link>
        <div className="swui-links">
          <Link href="/strategies/api-docs">← Docs</Link>
          <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer">OpenAPI ⤓</a>
          <Link href="/broker/login">Broker sign-in →</Link>
        </div>
      </div>
      <p className="swui-note">
        <b>Try the API in-browser.</b> Click <b>Authorize</b>, paste a sandbox or live key from your{" "}
        <Link href="/broker/settings" style={{ color: "#5fe6a2" }}>broker portal</Link>, then expand an endpoint and{" "}
        <b>Try it out</b>. Calls hit this deployment. Simulated / illustrative.
      </p>
      <div className="swui-surface">
        <SwaggerUI url="/api/v1/openapi.json" docExpansion="list" defaultModelsExpandDepth={-1} tryItOutEnabled />
      </div>
    </div>
  );
}
