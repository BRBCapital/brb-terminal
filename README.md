# BRB NGX Analyst Platform

Internal analytical tool for investment analysts at **BRB Capital Group**. Research NGX-listed equities, run fundamental & market-trend analysis, build and manage model portfolios, and produce forward-looking scenarios. All market data comes from the [NGN Market API](https://docs.ngnmarket.com).

> Internal analytical tool. **Not investment advice.** Prices are delayed up to 20 minutes during NGX hours.

## Stack

- **Next.js 14** (App Router) + **TypeScript** — single app that also hosts the authenticated API proxy
- **TailwindCSS** — BRB house brand (Forest / Fresh / Sand palette, Lora + Poppins)
- **TanStack Query** — client data fetching/caching
- **Recharts** — charts
- In-memory TTL cache for the API proxy (Redis/Postgres arrive in phase 3)

## Authentication

Email/password auth with three roles — **Analyst** (read/build), **Portfolio Manager**
(approve/rebalance), **Admin** (quota, audit, users). Sessions are httpOnly cookies;
passwords are scrypt-hashed. Route protection: middleware gates pages, API routes enforce
per-user ownership (Admins see all), and the audit trail is Admin-only.

On first boot three staff accounts are seeded with `BRB_SEED_PASSWORD` (see `.env.local`):

| Email | Role |
|---|---|
| `analyst@brb.local` | Analyst |
| `pm@brb.local` | Portfolio Manager |
| `admin@brb.local` | Admin |

**⚠️ Change `BRB_SEED_PASSWORD` and rotate these accounts before any real use.**

## Getting started

Requires **Node 20+**.

```bash
# 1. Install dependencies
npm install

# 2. Configure your API key (server-side only — never committed)
cp .env.local.example .env.local
#   then edit .env.local and set NGNMARKET_API_KEY=ngm_live_...

# 3. Run the dev server
npm run dev
# open http://localhost:3000
```

Without a valid key the dashboard renders but every tile shows an
"API key not configured" state — that's expected.

## Testing

Unit tests (Vitest) cover the pure, correctness-critical financial engines — **57 tests**
over cost-basis/positions, portfolio validation, weighted metrics, the benchmark backtest,
the Monte Carlo forecast engine, fundamental/dividend projection, technical indicators,
formatting, and CSV export.

```bash
npm test          # run once
npm run test:watch
```

## Architecture

```
Browser ──▶ /api/ngx/[...path]  ──▶  NGN Market API
            (Next.js route)         (Bearer key injected server-side)
                │
                └── in-memory TTL cache (20-min prices, longer for static data)
```

- **The API key never reaches the browser.** All requests go through the proxy
  route, which injects the `Authorization: Bearer` header server-side.
- Every proxied response is normalized to a `ProxyResult` envelope carrying the
  data, quota `meta`, and a freshness timestamp. Errors (`PLAN_REQUIRED`,
  `QUOTA_EXCEEDED`, `MISSING_API_KEY`, …) come back as `{ ok: false }` so each
  dashboard tile degrades independently.
- The contract our proxy relies on is documented in
  [`docs/ngnmarket-api.md`](docs/ngnmarket-api.md).

### Key paths

| Path | Purpose |
|---|---|
| `src/app/api/ngx/[...path]/route.ts` | Authenticated catch-all proxy |
| `src/lib/ngx/client.ts` | Server fetch + envelope/error normalization |
| `src/lib/ngx/cache.ts` | In-memory TTL cache + per-endpoint TTLs |
| `src/lib/ngx/types.ts` | Envelope + payload types |
| `src/hooks/useNgx.ts` | Client query hook |
| `src/components/dashboard/*` | Market Dashboard tiles |

## Plan gating

Dashboard tiles depend on your NGN Market plan tier:

- **Free**: market status, snapshot, indices strip, FX
- **Starter**: top trades, movers
- **Growth**: sector heatmap, market breadth, YTD performers

Tiles above your tier show a "Not on your plan" state rather than failing.

## Delivery roadmap

1. ✅ API proxy + cache + **Market Dashboard**
2. ✅ **Stock Analysis** (`/stocks/[symbol]` — Overview, Price chart with candlesticks +
   SMA/RSI/drawdown, Fundamentals, Dividends, News & disclosures, Peers) + **Screener** (`/screener`)
3. ✅ **Portfolio Construction** (`/portfolios` — build model portfolios, weight/units modes,
   ₦/USD view, live validation + concentration warnings, weighted yield/PE, sector donut,
   backtest vs benchmark index). Persisted in **PGlite** (embedded Postgres).
4. ✅ **Portfolio Management** (`/portfolios/[id]/manage` — transactions ledger driving cost
   basis, live holdings with unrealised P&L & drift, rebalancing assistant, performance vs
   benchmark with contribution, price/ex-div alerts, ₦/USD FX overlay)
5. ✅ **Forecasting & Scenario** (`/forecasting/[symbol]` — AI price forecast via Monte Carlo
   ensemble with probability bands + model diagnostics, fundamental scenario builder with
   sensitivity grid, dividend forecast, macro context). Every output labelled illustrative.
6. ✅ **Exports, audit trail, admin/quota** — CSV export on tables (screener, holdings,
   transactions, audit), PNG export on charts, print-ready PDF one-pagers (`/admin`, portfolio
   & research pages), audit-trail viewer, and API quota/usage dashboard.

**All six phases shipped.**

### Forecasting model — important
The "AI price forecast" is a **Monte Carlo ensemble** (fitted drift/volatility + log-linear
trend, 2,000 simulated GBM paths → P10/P50/P90 bands) with a walk-forward backtest error
shown for honesty. It is a **statistical scenario model, not a prediction** — every output
carries the mandated disclaimer. No model reliably predicts prices; the bands express
uncertainty, they do not remove it.

### Plan notes (phase 2)
- Company detail, chart, dividends, news, disclosures work on **Starter**.
- Full financial **statements** (`/companies/{symbol}/financials`) require the **Business**
  plan; the Fundamentals tab shows headline ratios from the detail endpoint and a
  plan-gated state for the statements until then.

## Compliance

No output states or implies guaranteed returns. Forecasts are labelled
illustrative scenarios. Rebalancing/screening outputs require PM/IC approval.
Data timestamps are always visible so a delayed price is never mistaken for a
live quote.
