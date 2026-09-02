# NGN Market API — contract reference

Source: https://docs.ngnmarket.com (OpenAPI: https://docs.ngnmarket.com/openapi.yaml).
This file records the facts our proxy depends on. Verify against the live spec if behaviour surprises you.

## Base + auth
- Base URL: `https://api.ngnmarket.com/v1`
- Header: `Authorization: Bearer ngm_live_YOUR_KEY` on **every** request. Server-side only — never in browser code.
- Manage keys: https://ngnmarket.com/developer

## Response envelope
Success:
```json
{ "success": true, "data": {}, "meta": { "plan": "starter", "calls_used": 4821, "calls_remaining": 95179, "reset_at": "2026-05-01T00:00:00.000Z" } }
```
- `meta.plan`: free | starter | growth | business | enterprise
- `meta.calls_used` / `calls_remaining`: monthly quota (shared across all keys on the account)
- `meta.reset_at`: ISO 8601 UTC, 1st of next month 00:00 UTC

Error:
```json
{ "success": false, "error": { "code": "PLAN_REQUIRED", "message": "...", "required_plan": "starter", "current_plan": "free" } }
```
`required_plan`/`current_plan` only present on PLAN_REQUIRED. `validCurrencies` array present on INVALID_CURRENCY (forex/history).

## Error codes → HTTP status
| code | status | notes |
|---|---|---|
| MISSING_API_KEY | 401 | header missing/malformed. Does NOT consume quota. |
| INVALID_API_KEY | 401 | key not found/revoked/not `ngm_`. Does NOT consume quota. |
| PLAN_REQUIRED | 403 | endpoint needs a higher tier. Per-tile handling required. |
| IP_NOT_ALLOWED | 403 | request IP not in key allowlist |
| RATE_LIMITED | 429 | per-minute limit. Does NOT consume quota. |
| QUOTA_EXCEEDED | 429 | monthly quota reached. Show "monthly quota reached" state. |
| NOT_FOUND | 404 | route/resource missing |
| SERVER_ERROR | 500 | server error (counts against quota) |
| INVALID_CURRENCY | 400 | forex/history bad currency code |

Note: auth failures + rate-limit blocks do NOT consume quota; validation + server errors DO.

## Data freshness
- Equity/ETF prices: refresh every 20 min during NGX hours (Mon–Fri 09:00–16:00 WAT / Africa/Lagos). Outside hours → last session close.
- Historical charts: end-of-day. Forex: daily. Disclosures: twice daily.
- Surface `last_updated` / `updated_at` / `as_of` on every price display.

## Plan gating (phase-1 dashboard endpoints)
- **Free**: `/market/snapshot`, `/market/available-dates`, `/market/status`, `/market/holidays`, `/forex/current`, `/indices`, `/companies`, `/companies/identifiers`, `/companies/{symbol}`
- **Starter**: `/market/top-trades`, `/market/movers`, `/forex/history`, `/indices/{symbol}`, `/indices/{symbol}/chart`
- **Growth**: `/market/breadth`, `/market/sectors`, `/market/ytd-performers`
Proxy must degrade per-tile on 403 PLAN_REQUIRED rather than failing the whole dashboard.

## Endpoint payload shapes (dashboard set)

### GET /market/snapshot  (query: date? YYYY-MM-DD; omit = latest)
`data`: { date, asi, asi_change, asi_change_percent, ytd_asi_change_percent, deals, volume, value_traded, turnover_rate,
market_cap:{equity,bonds,etfs,total}, breadth:{advancers,decliners,unchanged,total,adv_dec_ratio}, total_listed_securities,
session:{open_time,close_time,timezone}, updated_at }

### GET /market/status
`data`: { is_open, status: open|closed, reason: open|weekend|holiday|pre_market|after_hours,
session:{open_time,close_time,timezone}, holiday:null|{name,date}, next_open:null|{date,datetime,label},
closes_in:null|{hours,minutes,total_minutes}, as_of }

### GET /market/available-dates  (query: limit 1–365, default 90)
`data`: { count, latest, earliest, data:[{ date, label:today|yesterday|latest|previous|null, asi, formatted_date }] }

### GET /market/top-trades  (Starter; query: date?, limit 1–50 default 10)
`data`: { date, data:[{ rank, symbol, company_name, logo_url, sector, market_cap, volume, value_traded, price, price_change_percent, trades }] }

### GET /market/movers  (Starter; query: date?, limit 1–50 default 10, type? gainers|losers)
`data`: { trade_date, summary:{ total_gainers, total_losers, biggest_gainer:{symbol,change_percent}, biggest_loser:{symbol,change_percent} },
top_gainers:[{ symbol, company_name, logo_url, sector, market_cap, last_close, todays_close, change, change_percent, volume, value_traded, trades, updated_at }],
top_losers:[ ...same shape ] }

### GET /market/breadth  (Growth; query: from?, to?, limit 1–365 default 90)
`data`: { count, latest, earliest, data:[{ date, label, gainers_count, losers_count, unchanged_count, total_records, formatted_date }] }

### GET /market/sectors  (Growth)
`data`: { summary:{ top_sector_1d, top_sector_7d },
sectors:[{ sector, company_count, total_market_cap, total_value_traded, total_volume, change_1d, change_7d, change_52w, breadth:{advancers,decliners,unchanged} }] }

### GET /market/ytd-performers  (Growth; query: type best|worst default best, limit 1–30 default 10, year?)
`data`: { type, year, is_past_year, year_start_date, total, data:[{ symbol, company_name, sector, year_start_price, year_start_date, current_price, end_date, ytd_pct }] }

### GET /forex/current  (Free)
`data`: { target:"NGN", date, rates:[{ currency, rate, inverse_rate, daily_change, daily_change_percent, last_updated }] }
IMPORTANT: here `rate` is ALREADY ₦-per-foreign-unit (USD 1603.5 = ₦1603.5 per $1). `inverse_rate` (0.000624) = what ₦1 buys. Use `rate` directly for "₦ per USD" display.

### GET /forex/history  (Starter; query: source=USD, target=NGN, currency?, from?, to?, limit?)
`data`: [{ date, currency, rate }]  — here `rate` is the INVERTED value (0.000623 = what ₦1 buys). For ₦-per-USD display use `1/rate`. (Differs from /forex/current!)

### GET /indices  (Free)
`data`: [{ symbol, name, value, change_pct }]

### GET /indices/{symbol}  (Starter)
`data`: { symbol, name, description, value, change_pct, constituents:[{ ticker, name, weight }] }

### GET /indices/{symbol}/chart  (Starter; query: period preset or from/to)
`data`: { statistics block, data:[...daily closes] } — read full spec before using.

## Other paths (later phases) — see openapi.yaml
/companies, /companies/identifiers, /companies/{symbol}(+/chart,/financials,/news,/dividends,/disclosures),
/dividends/upcoming, /dividends/recent, /bonds, /disclosures(+/types), /blog/posts(+/search,/{slug}),
/account/usage, /account/logs, /etfs(+/{symbol}(+/chart)), /market/holidays.
