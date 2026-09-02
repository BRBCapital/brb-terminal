// Schema DDL for the portfolio store. Plain Postgres SQL so this runs
// identically on PGlite (local, WASM) and a networked Postgres in production.
// Idempotent — safe to run on every boot.

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS portfolios (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  mandate_notes TEXT NOT NULL DEFAULT '',
  benchmark_symbol TEXT NOT NULL DEFAULT 'ASI',
  base_currency TEXT NOT NULL DEFAULT 'NGN',
  created_by    TEXT NOT NULL DEFAULT 'analyst',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-shot stamp: set the first time the live-management ledger is auto-seeded
-- from the model holdings, so opening the Manage view repopulates the ledger
-- exactly once and never re-books after the analyst deliberately empties it.
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS ledger_seeded_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS holdings (
  id           TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  sector       TEXT NOT NULL DEFAULT '',
  -- 'weight' portfolios are specified in % that must sum to 100; 'units'
  -- portfolios in share counts. A portfolio's holdings share one mode.
  mode         TEXT NOT NULL DEFAULT 'weight',
  weight       DOUBLE PRECISION,          -- percent, when mode = 'weight'
  units        DOUBLE PRECISION,          -- share count, when mode = 'units'
  entry_price  DOUBLE PRECISION NOT NULL, -- naira per share at entry
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS holdings_portfolio_idx ON holdings(portfolio_id);

-- Lightweight audit trail (phase 6 expands this; we start capturing now since
-- the group is dual-regulated and portfolio actions must be traceable).
CREATE TABLE IF NOT EXISTS audit_log (
  id           TEXT PRIMARY KEY,
  actor        TEXT NOT NULL DEFAULT 'analyst',
  action       TEXT NOT NULL,            -- portfolio.create | portfolio.update | ...
  portfolio_id TEXT,
  detail       TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions ledger — drives cost basis and live positions (phase 4).
CREATE TABLE IF NOT EXISTS transactions (
  id           TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  kind         TEXT NOT NULL,            -- 'buy' | 'sell' | 'dividend'
  trade_date   DATE NOT NULL,
  units        DOUBLE PRECISION NOT NULL DEFAULT 0, -- shares (buy/sell)
  price        DOUBLE PRECISION NOT NULL DEFAULT 0, -- naira per share (buy/sell)
  fees         DOUBLE PRECISION NOT NULL DEFAULT 0, -- naira
  amount       DOUBLE PRECISION NOT NULL DEFAULT 0, -- naira (dividend income)
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_portfolio_idx ON transactions(portfolio_id);

-- Per-holding alerts (phase 4). Evaluated client-side against the latest price
-- on each load (the app has no background worker yet).
CREATE TABLE IF NOT EXISTS alerts (
  id           TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  kind         TEXT NOT NULL,            -- 'price_above' | 'price_below' | 'pct_move' | 'ex_div'
  threshold    DOUBLE PRECISION,         -- price level or percent move (null for ex_div)
  active       BOOLEAN NOT NULL DEFAULT true,
  note         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Fire-once stamp: once an alert triggers it stays fired (until deleted/recreated)
-- instead of re-notifying every worker cycle after the user reads it.
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS alerts_portfolio_idx ON alerts(portfolio_id);

-- Staff users + sessions (auth). Roles: analyst | pm | admin.
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'analyst',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- Per-analyst watchlists.
CREATE TABLE IF NOT EXISTS watchlists (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id           TEXT PRIMARY KEY,
  watchlist_id TEXT NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (watchlist_id, symbol)
);

CREATE INDEX IF NOT EXISTS watchlist_items_idx ON watchlist_items(watchlist_id);

-- Saved screener presets (filter + sort state as JSON).
CREATE TABLE IF NOT EXISTS screen_presets (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_by TEXT NOT NULL,
  config     TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rebalancing proposals — analyst submits a trade list, a PM/Admin signs off.
-- Analytical only: approval records a decision, it never executes trades.
CREATE TABLE IF NOT EXISTS rebalance_proposals (
  id             TEXT PRIMARY KEY,
  portfolio_id   TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  portfolio_name TEXT NOT NULL DEFAULT '',
  created_by     TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  trades         TEXT NOT NULL DEFAULT '[]',      -- JSON array of proposed trades
  turnover       DOUBLE PRECISION NOT NULL DEFAULT 0,
  note           TEXT NOT NULL DEFAULT '',
  decided_by     TEXT,
  decision_note  TEXT NOT NULL DEFAULT '',
  decided_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rebalance_status_idx ON rebalance_proposals(status);

-- AI daily market summaries (one per trading day, generated via the Claude API).
CREATE TABLE IF NOT EXISTS ai_summaries (
  trade_date   TEXT PRIMARY KEY,          -- YYYY-MM-DD of the session summarized
  content      TEXT NOT NULL,             -- markdown
  model        TEXT NOT NULL DEFAULT '',
  generated_by TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Paper trades opened from the AI portfolio builder (simulated positions).
CREATE TABLE IF NOT EXISTS paper_trades (
  id           TEXT PRIMARY KEY,
  created_by   TEXT NOT NULL,
  symbol       TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  sector       TEXT NOT NULL DEFAULT '',
  horizon      TEXT NOT NULL,               -- intraday | weekly | monthly | yearly
  currency     TEXT NOT NULL DEFAULT 'NGN',
  entry_price  NUMERIC NOT NULL,            -- ₦ per share at open
  shares       NUMERIC NOT NULL,
  amount_ngn   NUMERIC NOT NULL,            -- ₦ invested
  rationale    TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'open',-- open | closed
  opened_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  close_price  NUMERIC,
  closed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS paper_trades_owner_idx ON paper_trades(created_by, status);

-- A named group of paper trades saved as a unit from the AI builder — each build
-- is recorded separately. Its positions are paper_trades rows linked back via
-- paper_portfolio_id (added below); deleting the portfolio removes them (handled
-- in the repo, not an FK, so the column can be added to an existing table).
CREATE TABLE IF NOT EXISTS paper_portfolios (
  id             TEXT PRIMARY KEY,
  created_by     TEXT NOT NULL,
  name           TEXT NOT NULL,
  horizon        TEXT NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'NGN',
  amount_input   NUMERIC NOT NULL DEFAULT 0,   -- capital as entered (NGN or USD)
  budget_ngn     NUMERIC NOT NULL DEFAULT 0,   -- ₦ budget deployed
  market_context TEXT NOT NULL DEFAULT '',
  risk_note      TEXT NOT NULL DEFAULT '',
  model          TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS paper_portfolios_owner_idx ON paper_portfolios(created_by, created_at);

ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS paper_portfolio_id TEXT;
CREATE INDEX IF NOT EXISTS paper_trades_portfolio_idx ON paper_trades(paper_portfolio_id);

-- Latest AI analysis per (stock, kind): dividend_forecast | sector_momentum |
-- trade_signal. One cached row per pair, regenerable.
CREATE TABLE IF NOT EXISTS ai_stock_analyses (
  symbol       TEXT NOT NULL,
  kind         TEXT NOT NULL,
  content      TEXT NOT NULL,
  model        TEXT NOT NULL DEFAULT '',
  generated_by TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, kind)
);

-- Latest AI portfolio review per portfolio (Claude-generated optimisation ideas).
CREATE TABLE IF NOT EXISTS ai_portfolio_reviews (
  portfolio_id   TEXT PRIMARY KEY,
  cash_available NUMERIC NOT NULL DEFAULT 0,
  content        TEXT NOT NULL,
  model          TEXT NOT NULL DEFAULT '',
  generated_by   TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Server-side platform settings (e.g. the Anthropic API key entered via the
-- admin Settings panel). Secrets live here, never on the client.
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI extractions of official NGX filing PDFs (one per document URL).
CREATE TABLE IF NOT EXISTS ai_filings (
  document_url TEXT PRIMARY KEY,
  symbol       TEXT NOT NULL,
  title        TEXT NOT NULL DEFAULT '',
  content      TEXT NOT NULL,             -- markdown with page citations
  model        TEXT NOT NULL DEFAULT '',
  generated_by TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_filings_symbol_idx ON ai_filings(symbol);

-- Notifications produced by the background alert worker.
CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY,
  user_email   TEXT NOT NULL,
  portfolio_id TEXT,
  alert_id     TEXT,
  symbol       TEXT NOT NULL DEFAULT '',
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_email, read_at);

-- Watchlist price alerts: analyst-scoped buy/sell price levels, NOT tied to a
-- portfolio (unlike the portfolio-scoped alerts table). The worker fires a
-- notification when the live price reaches a level, then stamps *_triggered_at
-- so each side fires once until re-armed. A single alert can carry a buy level,
-- a sell level, or both.
CREATE TABLE IF NOT EXISTS price_alerts (
  id                TEXT PRIMARY KEY,
  created_by        TEXT NOT NULL,
  watchlist_id      TEXT,
  symbol            TEXT NOT NULL,
  company_name      TEXT NOT NULL DEFAULT '',
  buy_price         NUMERIC,                     -- notify when price <= buy_price
  sell_price        NUMERIC,                     -- notify when price >= sell_price
  buy_triggered_at  TIMESTAMPTZ,
  sell_triggered_at TIMESTAMPTZ,
  active            BOOLEAN NOT NULL DEFAULT true,
  note              TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_alerts_owner_idx ON price_alerts(created_by, active);

-- ===========================================================================
-- Alternative Strategies Engine — an admin-only, firm-level automated
-- paper-trading quant app. Dedicated tables, isolated from users' manual
-- paper_trades. Everything here is SIMULATED / illustrative, never real orders.
-- ===========================================================================

-- Single-row engine configuration (id = 'default'). Ships PAUSED (enabled=false):
-- an admin must explicitly enable it before any scheduled trade fires (governance).
CREATE TABLE IF NOT EXISTS strategy_settings (
  id                TEXT PRIMARY KEY DEFAULT 'default',
  enabled           BOOLEAN NOT NULL DEFAULT false,      -- governance gate (engine on/off)
  execution_mode    TEXT NOT NULL DEFAULT 'manual',      -- auto (full automation) | manual (human approval)
  allocation_mode   TEXT NOT NULL DEFAULT 'auto',        -- auto | manual
  total_capital_ngn NUMERIC NOT NULL DEFAULT 100000000,
  intraday_pct      NUMERIC NOT NULL DEFAULT 20,
  weekly_pct        NUMERIC NOT NULL DEFAULT 30,
  monthly_pct       NUMERIC NOT NULL DEFAULT 50,
  intraday_capital  NUMERIC NOT NULL DEFAULT 0,          -- used when allocation_mode = 'manual'
  weekly_capital    NUMERIC NOT NULL DEFAULT 0,
  monthly_capital   NUMERIC NOT NULL DEFAULT 0,
  max_position_pct  NUMERIC NOT NULL DEFAULT 15,         -- single-name cap (% of bucket)
  max_adv_pct       NUMERIC NOT NULL DEFAULT 10,         -- liquidity cap (% of daily volume)
  stop_loss_pct     NUMERIC NOT NULL DEFAULT 8,
  fx_overlay        BOOLEAN NOT NULL DEFAULT true,       -- haircut FX-sensitive sectors on FX moves
  drawdown_halt_pct NUMERIC NOT NULL DEFAULT 20,         -- halt a cadence if cumulative loss breaches this
  regime_enabled    BOOLEAN NOT NULL DEFAULT false,      -- Phase 2: regime scales sizing & gates entries (OFF = shadow only)
  regime_dwell_days NUMERIC NOT NULL DEFAULT 2,          -- consecutive clear days required to re-risk (hysteresis)
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        TEXT NOT NULL DEFAULT ''
);

-- One trading profile per (cadence, month) — groups the trades booked that month.
CREATE TABLE IF NOT EXISTS strategy_portfolios (
  id             TEXT PRIMARY KEY,
  cadence        TEXT NOT NULL,                          -- intraday | weekly | monthly
  period         TEXT NOT NULL,                          -- YYYY-MM
  capital_ngn    NUMERIC NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active',         -- active | closed
  model          TEXT NOT NULL DEFAULT '',
  market_context TEXT NOT NULL DEFAULT '',
  risk_note      TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS strategy_portfolios_idx ON strategy_portfolios(cadence, period);

-- The simulated positions the engine books.
CREATE TABLE IF NOT EXISTS strategy_trades (
  id                    TEXT PRIMARY KEY,
  strategy_portfolio_id TEXT NOT NULL,
  cadence               TEXT NOT NULL,
  period                TEXT NOT NULL,                   -- YYYY-MM (opening month)
  symbol                TEXT NOT NULL,
  company_name          TEXT NOT NULL DEFAULT '',
  sector                TEXT NOT NULL DEFAULT '',
  entry_price           NUMERIC NOT NULL,
  shares                NUMERIC NOT NULL,
  amount_ngn            NUMERIC NOT NULL,
  target_price          NUMERIC,
  stop_loss             NUMERIC,
  signal                TEXT NOT NULL DEFAULT '',        -- JSON: factor scores at entry
  rationale             TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'open',    -- pending | open | closed | rejected
  opened_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_on             DATE NOT NULL,                   -- WAT trading date the position opened (proposed/executed)
  close_price           NUMERIC,
  closed_at             TIMESTAMPTZ,
  realized_pnl          NUMERIC,
  close_reason          TEXT NOT NULL DEFAULT '',
  decided_by            TEXT NOT NULL DEFAULT '',         -- admin who approved/rejected (manual execution)
  decided_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS strategy_trades_portfolio_idx ON strategy_trades(strategy_portfolio_id);
CREATE INDEX IF NOT EXISTS strategy_trades_status_idx ON strategy_trades(cadence, status);

-- Scheduler run log AND job-dedup ledger. A scheduled job is claimed atomically
-- with INSERT ... ON CONFLICT (kind, run_key) DO NOTHING RETURNING id, so
-- overlapping 60s ticks / restarts never double-fire a cadence on the same day.
CREATE TABLE IF NOT EXISTS strategy_runs (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,                           -- open_intraday | close_intraday | ...
  run_key       TEXT NOT NULL,                           -- trading date (YYYY-MM-DD) or YYYY-MM
  status        TEXT NOT NULL DEFAULT 'running',         -- running | success | error | skipped
  trigger       TEXT NOT NULL DEFAULT 'schedule',        -- schedule | manual
  trades_opened INTEGER NOT NULL DEFAULT 0,
  trades_closed INTEGER NOT NULL DEFAULT 0,
  pnl           NUMERIC NOT NULL DEFAULT 0,
  detail        TEXT NOT NULL DEFAULT '',
  fired_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  UNIQUE (kind, run_key)
);
CREATE INDEX IF NOT EXISTS strategy_runs_fired_idx ON strategy_runs(fired_at DESC);

-- Market-regime snapshots (Phase 1 = shadow mode: computed & displayed, does
-- NOT yet drive allocation). One row per WAT trading date.
CREATE TABLE IF NOT EXISTS strategy_regime (
  date          TEXT PRIMARY KEY,                         -- YYYY-MM-DD (WAT)
  score         NUMERIC NOT NULL,                         -- 0..1 risk-on composite
  state         TEXT NOT NULL,                            -- RISK_ON | NEUTRAL | RISK_OFF | CRISIS
  exposure_mult NUMERIC NOT NULL,                         -- shadow: exposure it WOULD apply
  trend         NUMERIC NOT NULL,                         -- component sub-scores (0..1)
  breadth       NUMERIC NOT NULL,
  volatility    NUMERIC NOT NULL,
  fx            NUMERIC NOT NULL,
  detail        TEXT NOT NULL DEFAULT '',                 -- JSON: raw inputs + narrative
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── External prospect portal (Alternative Strategies landing) ──────────────
-- Completely separate from the internal users/sessions tables: these are
-- self-service signups from the public /strategies page. They can ONLY see the
-- members' insights page — never the internal analyst terminal (they hold a
-- different session cookie that the internal getSession() never reads).
CREATE TABLE IF NOT EXISTS strategy_members (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  company       TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  verified_at   TIMESTAMPTZ,
  verify_token  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS strategy_members_email_idx ON strategy_members(lower(email));

CREATE TABLE IF NOT EXISTS strategy_member_sessions (
  token      TEXT PRIMARY KEY,
  member_id  TEXT NOT NULL REFERENCES strategy_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Cached, non-proprietary monthly "thesis" narratives shown to signed-in
-- members. Generated by the AI, scrubbed of positions/weights/figures, and
-- keyed by period so every prospect sees the same consistent commentary.
CREATE TABLE IF NOT EXISTS strategy_theses (
  period       TEXT PRIMARY KEY,                            -- YYYY-MM
  content      TEXT NOT NULL,
  model        TEXT NOT NULL DEFAULT '',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Migrations (idempotent; bring existing databases up to the current shape) ──
ALTER TABLE strategy_settings ADD COLUMN IF NOT EXISTS execution_mode TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE strategy_settings ADD COLUMN IF NOT EXISTS regime_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE strategy_settings ADD COLUMN IF NOT EXISTS regime_dwell_days NUMERIC NOT NULL DEFAULT 2;
ALTER TABLE strategy_trades   ADD COLUMN IF NOT EXISTS decided_by TEXT NOT NULL DEFAULT '';
ALTER TABLE strategy_trades   ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;

-- ── Broker accounts (execution partners integrating the engine API) ─────────
-- Admin-created from the engine Settings tab. Brokers log into their own portal
-- (a separate identity + cookie from staff and members), set the AUM they trade
-- with the engine, hold sandbox + live API keys, and see the trades the engine
-- allocated to them scaled to that AUM.
CREATE TABLE IF NOT EXISTS broker_accounts (
  id            TEXT PRIMARY KEY,
  firm_name     TEXT NOT NULL,
  contact_name  TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',        -- active | suspended
  aum_ngn       NUMERIC NOT NULL DEFAULT 0,
  mode          TEXT NOT NULL DEFAULT 'sandbox',       -- sandbox | live (portal active view)
  sandbox_key      TEXT,                                 -- legacy plaintext (unused; kept nullable for upgrades)
  live_key         TEXT,
  -- API keys are never stored in the clear. *_key_hash is a SHA-256 for auth
  -- lookup; *_key_enc is an AES-256-GCM copy so the owner can re-reveal it.
  sandbox_key_hash TEXT,
  live_key_hash    TEXT,
  sandbox_key_enc  TEXT,
  live_key_enc     TEXT,
  created_by    TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS broker_accounts_email_idx ON broker_accounts(lower(email));
-- Hash-column indexes are created in the migration block below, after the
-- columns are guaranteed to exist on both fresh and upgraded databases.

CREATE TABLE IF NOT EXISTS broker_sessions (
  token      TEXT PRIMARY KEY,
  broker_id  TEXT NOT NULL REFERENCES broker_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- The engine's model trades, scaled to each broker's AUM. One row per
-- (broker, source model trade, mode). Kept in sync lazily on portal / API read.
CREATE TABLE IF NOT EXISTS broker_transactions (
  id              TEXT PRIMARY KEY,
  broker_id       TEXT NOT NULL REFERENCES broker_accounts(id) ON DELETE CASCADE,
  mode            TEXT NOT NULL,                        -- sandbox | live
  source_trade_id TEXT NOT NULL,                        -- strategy_trades.id
  cadence         TEXT NOT NULL,
  symbol          TEXT NOT NULL,
  company_name    TEXT NOT NULL DEFAULT '',
  side            TEXT NOT NULL DEFAULT 'BUY',
  entry_price     NUMERIC NOT NULL,
  shares          NUMERIC NOT NULL,
  amount_ngn      NUMERIC NOT NULL,
  weight_pct      NUMERIC NOT NULL DEFAULT 0,
  signal          TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'open',         -- open | closed
  broker_status   TEXT NOT NULL DEFAULT 'allocated',    -- allocated | acknowledged | filled | rejected
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  close_price     NUMERIC,
  closed_at       TIMESTAMPTZ,
  realized_pnl    NUMERIC
);
CREATE UNIQUE INDEX IF NOT EXISTS broker_txn_unique ON broker_transactions(broker_id, source_trade_id, mode);
CREATE INDEX IF NOT EXISTS broker_txn_broker_idx ON broker_transactions(broker_id, mode);

-- Migrate broker API keys from plaintext to hashed (auth) + encrypted (reveal).
ALTER TABLE broker_accounts ADD COLUMN IF NOT EXISTS sandbox_key_hash TEXT;
ALTER TABLE broker_accounts ADD COLUMN IF NOT EXISTS live_key_hash    TEXT;
ALTER TABLE broker_accounts ADD COLUMN IF NOT EXISTS sandbox_key_enc  TEXT;
ALTER TABLE broker_accounts ADD COLUMN IF NOT EXISTS live_key_enc     TEXT;
ALTER TABLE broker_accounts ALTER COLUMN sandbox_key DROP NOT NULL;
ALTER TABLE broker_accounts ALTER COLUMN live_key DROP NOT NULL;
ALTER TABLE strategy_members ADD COLUMN IF NOT EXISTS verified_at  TIMESTAMPTZ;
ALTER TABLE strategy_members ADD COLUMN IF NOT EXISTS verify_token TEXT;
CREATE INDEX IF NOT EXISTS broker_accounts_skh_idx ON broker_accounts(sandbox_key_hash);
CREATE INDEX IF NOT EXISTS broker_accounts_lkh_idx ON broker_accounts(live_key_hash);
`;
