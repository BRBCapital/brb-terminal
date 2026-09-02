// Shared types for the NGN Market API envelope and the dashboard payloads.
// Contract reference: docs/ngnmarket-api.md

export type Plan = "free" | "starter" | "growth" | "business" | "enterprise";

export interface QuotaMeta {
  plan: Plan;
  calls_used: number;
  calls_remaining: number;
  reset_at: string; // ISO 8601 UTC
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta: QuotaMeta;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  required_plan?: Plan;
  current_plan?: Plan;
  validCurrencies?: string[];
}

export interface ErrorEnvelope {
  success: false;
  error: ApiErrorBody;
}

export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

// Normalized error codes we branch on across the UI.
export type NgxErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_API_KEY"
  | "PLAN_REQUIRED"
  | "IP_NOT_ALLOWED"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "NOT_FOUND"
  | "SERVER_ERROR"
  | "INVALID_CURRENCY"
  | "UPSTREAM_UNAVAILABLE" // network/parse failure on our side
  | "UNKNOWN";

// The shape our proxy route returns to the browser. We wrap data with quota +
// freshness metadata so the client always knows how stale a value is.
export interface ProxyOk<T> {
  ok: true;
  data: T;
  meta: QuotaMeta | null;
  cached: boolean;
  fetchedAt: string; // ISO — when our cache last hit the upstream
}

export interface ProxyErr {
  ok: false;
  error: {
    code: NgxErrorCode;
    message: string;
    status: number;
    required_plan?: Plan;
    current_plan?: Plan;
  };
  meta: QuotaMeta | null;
}

export type ProxyResult<T> = ProxyOk<T> | ProxyErr;

// ---------------------------------------------------------------------------
// Dashboard payloads (subset of the API — see docs/ngnmarket-api.md)
// ---------------------------------------------------------------------------

export interface MarketSnapshot {
  date: string;
  asi: number;
  asi_change: number;
  asi_change_percent: number;
  ytd_asi_change_percent: number;
  deals: number;
  volume: number;
  value_traded: number;
  turnover_rate: number;
  market_cap: { equity: number; bonds: number; etfs: number; total: number };
  breadth: {
    advancers: number;
    decliners: number;
    unchanged: number;
    total: number;
    adv_dec_ratio: number;
  };
  total_listed_securities: number;
  session: { open_time: string; close_time: string; timezone: string };
  updated_at: string;
}

export type MarketStatusReason =
  | "open"
  | "weekend"
  | "holiday"
  | "pre_market"
  | "after_hours";

export interface MarketStatus {
  is_open: boolean;
  status: "open" | "closed";
  reason: MarketStatusReason;
  session: { open_time: string; close_time: string; timezone: string };
  holiday: { name: string; date: string } | null;
  next_open: { date: string; datetime: string; label: string } | null;
  closes_in: { hours: number; minutes: number; total_minutes: number } | null;
  as_of: string;
}

export interface MoverRow {
  symbol: string;
  company_name: string;
  logo_url: string;
  sector: string;
  market_cap: number;
  last_close: number;
  todays_close: number;
  change: number;
  change_percent: number;
  volume: number;
  value_traded: number;
  trades: number;
  updated_at: string;
}

export interface MarketMovers {
  trade_date: string;
  summary: {
    total_gainers: number;
    total_losers: number;
    biggest_gainer: { symbol: string; change_percent: number };
    biggest_loser: { symbol: string; change_percent: number };
  };
  top_gainers: MoverRow[];
  top_losers: MoverRow[];
}

export interface TopTradeRow {
  rank: number;
  symbol: string;
  company_name: string;
  logo_url: string;
  sector: string;
  market_cap: number;
  volume: number;
  value_traded: number;
  price: number;
  price_change_percent: number;
  trades: number;
}

export interface TopTrades {
  date: string;
  data: TopTradeRow[];
}

export interface SectorRow {
  sector: string;
  company_count: number;
  total_market_cap: number;
  total_value_traded: number;
  total_volume: number;
  change_1d: number;
  change_7d: number;
  change_52w: number;
  breadth: { advancers: number; decliners: number; unchanged: number };
}

export interface SectorRotation {
  summary: { top_sector_1d: string; top_sector_7d: string };
  sectors: SectorRow[];
}

export interface BreadthRow {
  date: string;
  label: string | null;
  gainers_count: number;
  losers_count: number;
  unchanged_count: number;
  total_records: number;
  formatted_date: string;
}

export interface MarketBreadth {
  count: number;
  latest: string;
  earliest: string;
  data: BreadthRow[];
}

export interface YtdRow {
  symbol: string;
  company_name: string;
  sector: string;
  year_start_price: number;
  year_start_date: string;
  current_price: number;
  end_date: string;
  ytd_pct: number;
}

export interface YtdPerformers {
  type: "best" | "worst";
  year: number;
  is_past_year: boolean;
  year_start_date: string;
  total: number;
  data: YtdRow[];
}

export interface ForexRate {
  currency: string;
  rate: number; // /forex/current: already NGN-per-foreign-unit
  inverse_rate: number; // what NGN 1 buys
  daily_change: number;
  daily_change_percent: number;
  last_updated: string;
}

export interface ForexCurrent {
  target: string; // "NGN"
  date: string;
  rates: ForexRate[];
}

// NOTE: the live /indices response wraps the array and uses different field
// names than the OpenAPI example (index_name / current_value /
// price_change_percent). Verified against the live API 2026-07-11.
export interface IndexSummary {
  id: number;
  symbol: string;
  index_name: string;
  description?: string;
  current_value: number;
  prev_close: number;
  price_change: number;
  price_change_percent: number;
  change_7d_percent?: number;
  change_52w_percent?: number;
  change_ytd_percent?: number;
  high_52wk?: number;
  low_52wk?: number;
  price_last_updated: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// Endpoints that paginate wrap their rows like this.
export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

// ---------------------------------------------------------------------------
// Phase 2 — company research / screener payloads
// All verified against the live API 2026-07-11 (shapes differ from OpenAPI).
// ---------------------------------------------------------------------------

// Row from GET /companies (paginated). Rich enough to power the screener
// directly — price, market cap, and trailing returns are all present.
export interface CompanyListRow {
  id: number;
  symbol: string;
  name: string;
  logo_url: string;
  sector: string;
  sub_sector: string | null;
  market_classification: string | null;
  shares_outstanding: number | null;
  website: string | null;
  price: number | null;
  prev_close: number | null;
  day_high: number | null;
  day_low: number | null;
  volume: number | null;
  market_cap: number | null;
  price_change: number | null;
  price_change_percent: number | null;
  change_7d_percent: number | null;
  change_52w_percent: number | null;
  change_1m_percent: number | null;
  change_ytd_percent: number | null;
  high_52wk: number | null;
  low_52wk: number | null;
  last_updated: string | null;
}

// Lightweight identifier for search/lookup (GET /companies/identifiers).
export interface CompanyIdentifier {
  id: number;
  symbol: string;
  name: string;
  international_sec_id: string | null;
  logo_url: string | null;
}
export interface CompanyIdentifiers {
  data: CompanyIdentifier[];
  count: number;
}

// GET /companies/{symbol} — full profile + quote + headline ratios.
export interface CompanyDetail {
  id: number;
  symbol: string;
  logo_url: string;
  international_sec_id: string | null;
  name: string;
  sector: string;
  sub_sector: string | null;
  market_classification: string | null;
  shares_outstanding: number | null;
  date_listed: string | null;
  date_incorporated: string | null;
  about: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  nature_of_business: string | null;
  current_price: number | null;
  prev_close: number | null;
  open_price: number | null;
  day_high: number | null;
  day_low: number | null;
  volume: number | null;
  value_traded: number | null;
  market_cap: number | null;
  price_change: number | null;
  price_change_percent: number | null;
  high_52wk: number | null;
  high_52wk_date: string | null;
  low_52wk: number | null;
  low_52wk_date: string | null;
  ttm_eps: number | null;
  latest_equity: number | null;
  ttm_dividends: number | null;
  last_updated: string | null;
  pb_ratio: number | null;
  debt_to_equity: number | null;
  current_ratio: number | null;
  dividend_yield: number | null;
}

// GET /companies/{symbol}/chart — full OHLCV history (older rows are
// close-only; recent rows carry OHLC). We fetch once and slice ranges client-side.
export interface ChartPoint {
  timestamp: number; // epoch ms
  date: string; // YYYY-MM-DD
  price: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  value_traded: number | null;
  vwap: number | null;
  trade_count: number | null;
  change: number | null;
  change_percent: number | null;
  source?: string;
}
export interface ChartStatistics {
  first_price: number;
  last_price: number;
  min_price: number;
  max_price: number;
  price_change: number;
  price_change_percent: number;
  start_date: string;
  end_date: string;
}
export interface CompanyChart {
  symbol: string;
  company_name: string;
  format: string;
  period: string;
  data: ChartPoint[];
  count: number;
  statistics: ChartStatistics;
}

// GET /companies/{symbol}/dividends
export interface DividendRow {
  ex_dividend_date: string;
  dividend: number;
  type: string; // Annual / Interim / ...
  payment_date: string | null;
  yield: number | null;
}
export interface CompanyDividends {
  symbol: string;
  dividends: DividendRow[];
  count: number;
}

// GET /companies/{symbol}/news
export interface NewsItem {
  title: string;
  link: string;
  source: string;
  pub_date: string;
  days_old: number;
  time_ago: string;
  guid?: string;
}
export interface CompanyNews {
  company: string;
  data: NewsItem[];
  total: string | number;
}

// GET /companies/{symbol}/disclosures (paginated)
export interface DisclosureRow {
  title: string;
  company_name: string;
  company_symbol: string;
  isin: string | null;
  submission_type: string;
  document_url: string;
  disclosed_at: string;
  modified_at: string;
}

// GET /dividends/upcoming — { dividends, page, total, total_pages }
export interface UpcomingDividend {
  symbol: string;
  ex_dividend_date: string;
  dividend: number;
  type: string;
  payment_date: string | null;
  yield: number | null;
  company_name: string;
  sector: string | null;
}
export interface UpcomingDividends {
  dividends: UpcomingDividend[];
  page: number;
  total: number;
  total_pages: number;
}

// GET /indices/{symbol}/chart — benchmark series for portfolio backtests.
export interface IndexChartPoint {
  date: string;
  timestamp: number;
  index_value: number;
  normalized_value: number;
  daily_change: number;
  daily_change_percent: number;
}
export interface IndexChart {
  format: string;
  period: string;
  data: IndexChartPoint[];
  count: number;
  statistics?: unknown;
}

// GET /bonds (paginated)
export interface BondRow {
  id: number;
  isin: string | null;
  name: string;
  issuer: string;
  type: string; // government | corporate | ...
  coupon: number | null;
  issue_date: string | null;
  maturity_date: string | null;
  open_price: number | null;
}

// GET /etfs (paginated)
export interface EtfRow {
  id: number;
  symbol: string;
  isin: string | null;
  name: string;
  fund_manager: string | null;
  index_tracked: string | null;
  current_price: number | null;
  prev_close: number | null;
  price_change: number | null;
  price_change_percent: number | null;
  volume: number | null;
  value_traded: number | null;
  high_52wk: number | null;
  low_52wk: number | null;
  change_7d_percent: number | null;
  change_ytd_percent: number | null;
  change_52w_percent: number | null;
  avg_vol_3m: number | null;
  stats_date: string | null;
}
