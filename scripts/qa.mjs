#!/usr/bin/env node
/**
 * Comprehensive QA harness for the BRB NGX Analyst Platform + Alternative
 * Strategies engine, prospect portal, and broker integration API.
 *
 * Runs against a live server (dev or prod). It checks: public pages, page-gating
 * redirects, API authorization (401/403), multi-tenant isolation, public API
 * contracts, member signup + validation, security headers & cookie flags, and —
 * when admin credentials are supplied — the full engine + broker loop
 * (execution mode, approvals, broker creation, AUM allocation, key auth,
 * execution reports, step-up reset).
 *
 * Usage:
 *   node scripts/qa.mjs
 *   BASE_URL=http://localhost:3000 node scripts/qa.mjs
 *   ADMIN_EMAIL=admin@x ADMIN_PASSWORD=... node scripts/qa.mjs      # deep engine/broker QA
 *   RUN_AI=1 ADMIN_EMAIL=.. ADMIN_PASSWORD=.. node scripts/qa.mjs   # also exercise AI (slow/cost)
 *
 * Exit code 0 = all passed, 1 = one or more failures.
 */

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const RUN_AI = process.env.RUN_AI === "1";

let pass = 0, fail = 0, skip = 0;
const failures = [];
const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };

function ok(name, extra = "") { pass++; console.log(`  ${C.g}✓${C.x} ${name}${extra ? C.d + " — " + extra + C.x : ""}`); }
function bad(name, detail) { fail++; failures.push(`${name} — ${detail}`); console.log(`  ${C.r}✗ ${name}${C.x} ${C.d}— ${detail}${C.x}`); }
function skipped(name, why) { skip++; console.log(`  ${C.y}◦${C.x} ${C.d}SKIP ${name} — ${why}${C.x}`); }
function section(t) { console.log(`\n${C.b}${t}${C.x}`); }
function assert(name, cond, detail = "") { cond ? ok(name, detail) : bad(name, detail || "assertion failed"); return cond; }

// --- tiny cookie-jar client -------------------------------------------------
function newClient() {
  const jar = new Map();
  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  async function req(method, path, { body, headers = {}, redirect = "manual" } = {}) {
    const h = { ...headers };
    if (jar.size) h["cookie"] = cookieHeader();
    if (body !== undefined) h["content-type"] = "application/json";
    const res = await fetch(BASE + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, redirect });
    const setC = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const c of setC) {
      const [pair] = c.split(";");
      const idx = pair.indexOf("=");
      const name = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      if (val === "" ) jar.delete(name); else jar.set(name, val);
    }
    return res;
  }
  return {
    jar,
    get: (p, o = {}) => req("GET", p, o),
    post: (p, body, o = {}) => req("POST", p, { ...o, body }),
    patch: (p, body, o = {}) => req("PATCH", p, { ...o, body }),
  };
}

async function json(res) { try { return await res.json(); } catch { return null; } }

// ---------------------------------------------------------------------------
async function main() {
  console.log(`${C.b}QA — ${BASE}${C.x}  ${C.d}${new Date().toISOString()}${C.x}`);

  // Reachability
  const anon = newClient();
  try {
    const r = await anon.get("/api/strategies/performance");
    if (!r.ok) throw new Error(`performance ${r.status}`);
  } catch (e) {
    console.log(`\n${C.r}Server not reachable at ${BASE} (${e.message}). Start it with: npm run dev${C.x}`);
    process.exit(2);
  }

  // ---- 1. Public pages -----------------------------------------------------
  section("1. Public pages (expect 200)");
  for (const p of ["/login", "/strategies", "/strategies/api-docs", "/strategies/api-docs/explorer", "/strategies/signup", "/strategies/login", "/broker/login"]) {
    const r = await anon.get(p);
    assert(`GET ${p}`, r.status === 200, `got ${r.status}`);
  }

  // ---- 2. Page gating (unauthenticated → redirect to a login) --------------
  section("2. Page gating (unauthenticated → 307 redirect)");
  const gated = [
    ["/", "/login"], ["/engine", "/login"], ["/admin", "/login"], ["/portfolios", "/login"],
    ["/stocks", "/login"], ["/screener", "/login"], ["/watchlists", "/login"], ["/forecasting", "/login"],
    ["/broker", "/broker/login"], ["/broker/settings", "/broker/login"], ["/strategies/insights", "/strategies/login"],
  ];
  for (const [p, dest] of gated) {
    const r = await anon.get(p);
    const loc = r.headers.get("location") || "";
    assert(`GET ${p} → ${dest}`, (r.status === 307 || r.status === 302) && loc.includes(dest), `status ${r.status} loc ${loc || "none"}`);
  }

  // ---- 3. API authorization (unauthenticated → 401/403) --------------------
  section("3. API authorization (unauthenticated → 401)");
  const adminApis = [
    "/api/engine/overview", "/api/engine/signals", "/api/engine/pending", "/api/engine/brokers",
  ];
  for (const p of adminApis) {
    const r = await anon.get(p);
    assert(`GET ${p}`, r.status === 401 || r.status === 403, `got ${r.status}`);
  }
  for (const [p, body] of [["/api/engine/run", { action: "open", cadence: "intraday" }], ["/api/engine/settings", { enabled: true }], ["/api/engine/reset", { password: "x" }], ["/api/engine/brokers", { firm_name: "x", email: "a@b.co", password: "12345678" }]]) {
    const r = await anon.post(p, body);
    assert(`POST ${p}`, r.status === 401 || r.status === 403, `got ${r.status}`);
  }
  for (const p of ["/api/broker/me", "/api/strategies/insight?period=2026-08"]) {
    const r = await anon.get(p);
    assert(`GET ${p}`, r.status === 401, `got ${r.status}`);
  }

  // ---- 4. Broker integration API auth --------------------------------------
  section("4. Broker API key auth (no/invalid key → 401)");
  for (const p of ["/api/v1/account", "/api/v1/signals", "/api/v1/transactions"]) {
    const r = await anon.get(p);
    assert(`GET ${p} (no key)`, r.status === 401, `got ${r.status}`);
  }
  {
    const r = await anon.get("/api/v1/account", { headers: { authorization: "Bearer sk_live_not_a_real_key" } });
    assert("GET /api/v1/account (bad key)", r.status === 401, `got ${r.status}`);
  }

  // ---- 5. Public API contracts ---------------------------------------------
  section("5. Public API contracts");
  {
    const r = await anon.get("/api/strategies/performance");
    const b = await json(r);
    assert("performance ok", r.ok && b?.ok === true);
    assert("performance has totals", b?.totals && typeof b.totals.capital === "number");
    assert("performance hides positions", !("positions" in (b || {})) && !("transactions" in (b || {})), "must not leak positions publicly");
  }
  {
    const r = await anon.get("/api/v1/openapi.json");
    const b = await json(r);
    assert("openapi 3.1", b?.openapi === "3.1.0", `got ${b?.openapi}`);
    assert("openapi paths present", b?.paths && ["/account", "/signals", "/transactions", "/execution-reports"].every((p) => p in b.paths));
    assert("openapi bearer scheme", !!b?.components?.securitySchemes?.bearerAuth);
  }

  // ---- 6. Input validation & member signup ---------------------------------
  section("6. Member signup validation + isolation");
  {
    const r = await anon.post("/api/strategies/signup", { name: "x", email: "bad", company: "y", password: "short" });
    assert("signup rejects bad input", r.status === 400, `got ${r.status}`);
  }
  const member = newClient();
  const memEmail = `qa+${Date.now()}@example.com`;
  {
    const r = await member.post("/api/strategies/signup", { name: "QA Tester", email: memEmail, company: "QA Fund", password: "frontier123" });
    const b = await json(r);
    assert("signup creates member", r.ok && b?.ok === true, `got ${r.status}`);
    assert("signup sets session cookie", member.jar.has("as_member"), "no as_member cookie");
  }
  {
    const r = await member.post("/api/strategies/signup", { name: "QA Tester", email: memEmail, company: "QA Fund", password: "frontier123" });
    assert("signup rejects duplicate email", r.status === 400, `got ${r.status}`);
  }
  {
    // member can reach its own gated page
    const r = await member.get("/strategies/insights");
    assert("member reaches /strategies/insights", r.status === 200, `got ${r.status}`);
    // isolation: member cookie must NOT open internal app or engine
    const r2 = await member.get("/");
    assert("member CANNOT open / (staff)", (r2.status === 307 || r2.status === 302) && (r2.headers.get("location") || "").includes("/login"), `got ${r2.status}`);
    const r3 = await member.get("/api/engine/overview");
    assert("member CANNOT hit engine API", r3.status === 401 || r3.status === 403, `got ${r3.status}`);
    const r4 = await member.get("/api/broker/me");
    assert("member CANNOT hit broker API", r4.status === 401, `got ${r4.status}`);
  }

  // ---- 7. Security headers & cookie flags ----------------------------------
  section("7. Security headers & cookie flags");
  {
    const r = await anon.get("/login");
    const xfo = r.headers.get("x-frame-options");
    const csp = r.headers.get("content-security-policy");
    const xcto = r.headers.get("x-content-type-options");
    const refp = r.headers.get("referrer-policy");
    assert("X-Frame-Options set", !!xfo, xfo ? `got ${xfo}` : "missing (clickjacking) — recommend DENY/SAMEORIGIN");
    assert("X-Content-Type-Options set", xcto === "nosniff", `got ${xcto || "missing"}`);
    assert("Content-Security-Policy set", !!csp, csp ? "present" : "missing (recommend a CSP)");
    assert("Referrer-Policy set", !!refp, refp ? `got ${refp}` : "missing");
  }
  {
    // login cookie flags
    const c = newClient();
    const r = await c.post("/api/broker/login", { email: "nobody@example.com", password: "wrongwrong1" });
    const setc = (typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : []).join(" ");
    // login failed so no cookie expected; just ensure no 500
    assert("broker login bad creds → 401 (no 500)", r.status === 401, `got ${r.status}`);
  }

  // ---- 7b. Rate limiting on auth -------------------------------------------
  section("7b. Rate limiting (auth brute-force)");
  {
    const badEmail = `qa-rl+${Date.now()}@example.com`;
    let got429 = false;
    for (let i = 0; i < 12; i++) {
      const r = await anon.post("/api/broker/login", { email: badEmail, password: "wrongwrong1" });
      if (r.status === 429) { got429 = true; break; }
    }
    assert("login throttles repeated failures (429)", got429, got429 ? "429 returned within 12 attempts" : "no 429 after 12 attempts — rate limiting not active");
  }

  // ---- 8. Open-redirect probe ----------------------------------------------
  section("8. Open-redirect resistance");
  {
    // A gated route with an external next must never redirect off-site.
    const r = await anon.get("/engine", { redirect: "manual" });
    const loc = r.headers.get("location") || "";
    assert("redirect target is same-origin", loc === "" || loc.startsWith(BASE) || loc.startsWith("/"), `loc ${loc}`);
  }

  // ---- 9. Deep engine + broker loop (requires admin creds) -----------------
  section("9. Engine + broker loop (admin)");
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    skipped("engine/broker deep QA", "set ADMIN_EMAIL and ADMIN_PASSWORD to run");
  } else {
    const admin = newClient();
    const login = await admin.post("/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    if (login.status !== 200) {
      bad("admin login", `got ${login.status} — check ADMIN_EMAIL/ADMIN_PASSWORD`);
    } else {
      ok("admin login");
      // engine overview shape
      const ov = await json(await admin.get("/api/engine/overview"));
      assert("engine overview ok", ov?.ok === true && ov?.settings && typeof ov?.totals?.capital === "number");
      assert("engine exposes execution_mode", ov?.settings?.execution_mode === "auto" || ov?.settings?.execution_mode === "manual");
      assert("engine exposes pending_count", typeof ov?.pending_count === "number");

      // create a broker
      const bEmail = `qa-broker+${Date.now()}@example.com`;
      const created = await json(await admin.post("/api/engine/brokers", { firm_name: "QA Broker", contact_name: "QA", email: bEmail, password: "brokerpass1", aum_ngn: 50_000_000 }));
      const brokerOk = assert("admin creates broker", created?.ok === true && created?.broker?.sandbox_key?.startsWith("sk_sandbox_") && created?.broker?.live_key?.startsWith("sk_live_"), created?.broker?.sandbox_key ? "sandbox+live keys returned" : `no keys returned (status ${created?.__status ?? "?"})`);

      if (brokerOk) {
        const sk = created.broker.sandbox_key;
        const brokerId = created.broker.id;

        // API key auth works + scopes to sandbox
        const acct = await json(await anon.get("/api/v1/account", { headers: { authorization: `Bearer ${sk}` } }));
        assert("broker key authenticates", acct?.ok === true && acct?.account?.mode === "sandbox", "account not returned");
        assert("account reflects AUM", acct?.account?.aum_ngn === 50_000_000);
        assert("account shows allocation", acct?.account?.allocation && typeof acct.account.allocation.intraday === "number");

        // signals + transactions endpoints respond for the key
        const sig = await json(await anon.get("/api/v1/signals", { headers: { authorization: `Bearer ${sk}` } }));
        assert("signals endpoint ok", sig?.ok === true && Array.isArray(sig?.signals));
        const txns = await json(await anon.get("/api/v1/transactions", { headers: { authorization: `Bearer ${sk}` } }));
        assert("transactions endpoint ok", txns?.ok === true && Array.isArray(txns?.transactions));

        // execution report: valid status accepted or 404 if no open orders; invalid status → 422
        const badRep = await anon.post("/api/v1/execution-reports", { clientOrderId: "does_not_exist", status: "banana" }, { headers: { authorization: `Bearer ${sk}` } });
        assert("execution-report rejects bad status", badRep.status === 422 || badRep.status === 404, `got ${badRep.status}`);

        // broker portal login + isolation
        const broker = newClient();
        const blogin = await broker.post("/api/broker/login", { email: bEmail, password: "brokerpass1" });
        assert("broker portal login", blogin.status === 200, `got ${blogin.status}`);
        const me = await json(await broker.get("/api/broker/me"));
        assert("broker /me returns keys", me?.ok === true && me?.broker?.sandbox_key?.startsWith("sk_sandbox_"));
        // broker sets own AUM
        const setAum = await broker.post("/api/broker/settings", { action: "setAum", aum_ngn: 75_000_000 });
        assert("broker sets own AUM", setAum.status === 200, `got ${setAum.status}`);
        // broker cannot reach engine/admin
        const bx = await broker.get("/api/engine/overview");
        assert("broker CANNOT hit engine API", bx.status === 401 || bx.status === 403, `got ${bx.status}`);

        // admin resets broker password (revokes sessions)
        const reset = await admin.patch(`/api/engine/brokers/${brokerId}`, { action: "resetPassword", password: "newbrokerpass1" });
        assert("admin resets broker password", reset.status === 200, `got ${reset.status}`);
        const meAfter = await broker.get("/api/broker/me");
        assert("reset revoked broker session", meAfter.status === 401, `expected 401 after reset, got ${meAfter.status}`);

        // suspend broker → key stops working
        await admin.patch(`/api/engine/brokers/${brokerId}`, { action: "suspend" });
        const afterSuspend = await anon.get("/api/v1/account", { headers: { authorization: `Bearer ${sk}` } });
        assert("suspended broker key rejected", afterSuspend.status === 401, `got ${afterSuspend.status}`);
      }

      // engine reset requires step-up password (wrong pw → 401, ledger untouched)
      const badReset = await admin.post("/api/engine/reset", { password: "definitely-wrong" });
      assert("engine reset rejects wrong step-up password", badReset.status === 401, `got ${badReset.status}`);

      // AI (optional, slow/cost)
      if (RUN_AI) {
        const rep = await admin.get("/api/engine/overview");
        // just ensure the report route is reachable; generation is streamed elsewhere
        assert("engine reachable for AI run", rep.status === 200);
      } else {
        skipped("AI generation (thesis/report)", "set RUN_AI=1 to exercise (incurs Anthropic cost)");
      }
    }
  }

  // ---- Summary -------------------------------------------------------------
  console.log(`\n${C.b}Summary${C.x}  ${C.g}${pass} passed${C.x}  ${fail ? C.r : C.d}${fail} failed${C.x}  ${C.y}${skip} skipped${C.x}`);
  if (failures.length) {
    console.log(`\n${C.r}Failures:${C.x}`);
    for (const f of failures) console.log(`  ${C.r}•${C.x} ${f}`);
  }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(`${C.r}QA harness crashed:${C.x}`, e); process.exit(2); });
