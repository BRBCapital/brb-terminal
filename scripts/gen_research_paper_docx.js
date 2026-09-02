// Editable Word (.docx) version of the BRB NGX Analyst research/methodology paper.
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat,
  BorderStyle, ShadingType, ImageRun, PageNumber, Footer, PageBreak,
} = require("docx");

const FOREST = "052A22", FOREST_SOFT = "1A4D40", FRESH = "8AC873", INK = "1F2A26", MUTED = "5B6B64";
const SERIF = "Georgia", SANS = "Calibri";

const P = (text, opts = {}) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 140, line: 268 },
    children: [new TextRun({ text, font: SERIF, size: 20, color: INK, ...opts })],
    ...(opts.para || {}),
  });

const RUNS = (runs, para = {}) =>
  new Paragraph({ spacing: { after: 140, line: 268 }, children: runs, ...para });

let secN = 0;
const H1 = (text) => {
  secN += 1;
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 260, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: FRESH, space: 3 } },
    children: [new TextRun({ text: `${secN}.  ${text}`, font: SERIF, bold: true, size: 26, color: FOREST })],
  });
};
const H1x = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 260, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: FRESH, space: 3 } },
    children: [new TextRun({ text, font: SERIF, bold: true, size: 26, color: FOREST })],
  });
const H2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 160, after: 40 },
    children: [new TextRun({ text, font: SERIF, bold: true, size: 22, color: FOREST_SOFT })],
  });

// Equation: centered italic, subtle shaded band with a fresh left border.
const EQ = (runs) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 120, line: 300 },
    shading: { type: ShadingType.CLEAR, fill: "F2F5EF" },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: FRESH, space: 6 } },
    children: runs,
  });
const er = (t, o = {}) => new TextRun({ text: t, font: SERIF, italics: true, size: 21, color: FOREST, ...o });
const sub = (t) => er(t, { subScript: true });
const sup = (t) => er(t, { superScript: true });

const BULLETS = (items) =>
  items.map((t) =>
    new Paragraph({
      numbering: { reference: "bul", level: 0 },
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 70, line: 260 },
      children: parseBold(t),
    })
  );

// Minimal **bold** parser so bullet/body emphasis carries over.
function parseBold(t) {
  const out = [];
  for (const part of t.split(/(\*\*[^*]+\*\*)/g)) {
    if (!part) continue;
    const b = part.startsWith("**") && part.endsWith("**");
    out.push(new TextRun({ text: b ? part.slice(2, -2) : part, font: SERIF, size: 20, color: INK, bold: b }));
  }
  return out;
}

const REF = (t) =>
  new Paragraph({
    spacing: { after: 60, line: 240 },
    indent: { left: 300, hanging: 300 },
    children: parseItalic(t),
  });
function parseItalic(t) {
  const out = [];
  for (const part of t.split(/(<i>[^<]+<\/i>)/g)) {
    if (!part) continue;
    const it = part.startsWith("<i>");
    out.push(new TextRun({ text: it ? part.slice(3, -4) : part, font: SERIF, size: 18, color: INK, italics: it }));
  }
  return out;
}

const SMALL = (t, o = {}) =>
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: t, font: SANS, size: 15, color: MUTED, ...o })], ...(o.para || {}) });

// ── Cover ──────────────────────────────────────────────────────────────
const cover = [];
cover.push(new Paragraph({ spacing: { before: 900 } }));
try {
  const logo = fs.readFileSync("public/brb-logo.png");
  cover.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    shading: { type: ShadingType.CLEAR, fill: FOREST },
    spacing: { before: 240, after: 240 },
    children: [new ImageRun({ data: logo, type: "png", transformation: { width: 360, height: 145 } })],
  }));
} catch (e) { /* logo optional */ }
cover.push(new Paragraph({ spacing: { before: 500 } }));
cover.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
  children: [new TextRun({ text: "BRB CAPITAL GROUP · RESEARCH & TECHNOLOGY", font: SANS, bold: true, size: 18, color: FOREST_SOFT })] }));
cover.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
  children: [new TextRun({ text: "Transparent Models, Constrained Machines", font: SERIF, bold: true, size: 46, color: FOREST })] }));
cover.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
  children: [new TextRun({ text: "A Provenance-Bounded Architecture for AI-Assisted Equity Research on the Nigerian Exchange", font: SERIF, size: 26, color: FOREST_SOFT })] }));
cover.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 16, color: FRESH, space: 4 } }, children: [] }));
cover.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
  children: [new TextRun({ text: "The methodological thesis underlying the BRB NGX Analyst Platform", font: SERIF, italics: true, size: 23, color: MUTED })] }));
cover.push(new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "Working Paper · v1.0 · August 2026  ·  Internal analytical tool — not investment advice", font: SANS, size: 16, color: MUTED })] }));
cover.push(new Paragraph({ children: [new PageBreak()] }));

// ── Abstract ───────────────────────────────────────────────────────────
const abstract = new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { after: 160, line: 250 },
  shading: { type: ShadingType.CLEAR, fill: "F6F5F0" },
  border: {
    top: { style: BorderStyle.SINGLE, size: 4, color: "D9DDD6", space: 8 },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9DDD6", space: 8 },
    left: { style: BorderStyle.SINGLE, size: 4, color: "D9DDD6", space: 8 },
    right: { style: BorderStyle.SINGLE, size: 4, color: "D9DDD6", space: 8 },
  },
  children: [
    new TextRun({ text: "Abstract. ", font: SERIF, bold: true, size: 19, color: FOREST }),
    new TextRun({ text:
      "We describe the design thesis of an internal decision-support platform for equity research on the Nigerian " +
      "Exchange (NGX) operated by a dual-regulated (FCA UK / SEC Nigeria) fund and portfolio manager. The central " +
      "argument is that trustworthy machine assistance in a frontier, information-scarce market is best achieved not by " +
      "maximising model autonomy but by bounding it: pairing transparent, auditable statistical models with " +
      "large-language-model (LLM) reasoning strictly constrained by data provenance and by compliance-by-construction. " +
      "We set out six components: (i) a delayed-quote data model with market-hours-aware caching and exact reconstruction " +
      "of plan-gated aggregates; (ii) a reproducible Monte-Carlo geometric Brownian-motion (GBM) ensemble for " +
      "probabilistic price scenarios with walk-forward validation; (iii) fundamental and dividend scenario models; " +
      "(iv) a single-benchmark portfolio-risk stack; (v) a provenance-constrained LLM layer in which the model never " +
      "originates market figures and all position arithmetic is recomputed server-side; and (vi) a maker-checker " +
      "governance workflow. We argue this converts an opaque, hallucination-prone tool into an auditable analyst " +
      "instrument, and are explicit about its limitations.",
      font: SERIF, size: 18, color: INK }),
  ],
});

// ── Body ───────────────────────────────────────────────────────────────
const body = [
  abstract,
  SMALL("Keywords: frontier markets · NGX · Monte-Carlo simulation · geometric Brownian motion · portfolio risk · large language models · data provenance · RegTech · decision support"),

  H1("Introduction and thesis"),
  P("The Nigerian Exchange is a frontier equity market characterised by concentrated liquidity in a small number of large-capitalisation names, uneven disclosure, and market data that is delayed rather than streamed in real time. Analysts must synthesise sparse, latency-bound information into portfolio decisions under a strict dual-regulatory regime. Two temptations arise when applying machine intelligence here: letting a statistical forecast masquerade as a prediction, and letting a language model both reason about and supply the underlying facts — inviting confident fabrication of prices, ratios and events."),
  P("Our thesis is that reliability in this environment is a property of constraint, not autonomy. We hold every quantitative output to three standards — transparent (reconstructable from inputs), reproducible (seeded and deterministic), and provenance-bounded (no figure originates inside a model that cannot cite it). The platform is positioned as decision support for a qualified professional, never as automated advice, and this positioning is enforced in code and workflow rather than merely stated in a disclaimer."),

  H1("Design principles"),
  ...BULLETS([
    "**Transparency.** Analytical logic lives in pure, framework-free, unit-tested functions; every displayed number is traceable to inputs and a documented formula.",
    "**Provenance.** Market facts enter only through the authenticated data proxy or documents the system has read and can cite. Reasoning components consume these facts; they never manufacture them.",
    "**Compliance-by-construction.** Illustrative-scenario labelling, delayed-quote disclosure with explicit freshness, a maker-checker approval gate, role-based access and a full audit trail are structural, not optional.",
    "**Reproducibility.** Stochastic components use a seeded generator, so a given input reproduces a given scenario fan exactly — a prerequisite for review and regulatory defensibility.",
  ]),

  H1("Data model and market microstructure"),
  P("The platform is, by design, a delayed-quote terminal. Prices republish roughly every twenty minutes during exchange hours (Mon–Fri, 09:00–16:00 West Africa Time) and reflect the last close outside them; the interface surfaces an explicit 'as of' timestamp on all prices. A market-hours-aware cache assigns short time-to-live to live-price groups while the market is open and long time-to-live when closed, with static reference data cached for many hours."),
  P("Certain aggregates (sector performance, breadth, year-to-date leaders) are gated behind higher data-plan tiers. Rather than estimate them, the platform reconstructs them exactly from the constituent list on an equal-weighted basis and labels them as derived — a real calculation, not an approximation. Foreign-exchange handling normalises to naira-per-unit at each call site, because spot and historical rates arrive under different inversion conventions."),

  H1("Probabilistic price forecasting: a Monte-Carlo GBM ensemble"),
  RUNS([
    new TextRun({ text: "Forward price scenarios are generated by an ensemble of geometric Brownian-motion paths rather than a single point forecast, so the output is a distribution expressed as probability bands. Let ", font: SERIF, size: 20, color: INK }),
    new TextRun({ text: "S", font: SERIF, size: 20, color: INK }), new TextRun({ text: "t", font: SERIF, size: 20, color: INK, subScript: true }),
    new TextRun({ text: " denote the closing price and r", font: SERIF, size: 20, color: INK }), new TextRun({ text: "t", font: SERIF, size: 20, color: INK, subScript: true }),
    new TextRun({ text: " = ln(S", font: SERIF, size: 20, color: INK }), new TextRun({ text: "t", font: SERIF, size: 20, color: INK, subScript: true }),
    new TextRun({ text: " / S", font: SERIF, size: 20, color: INK }), new TextRun({ text: "t−1", font: SERIF, size: 20, color: INK, subScript: true }),
    new TextRun({ text: ") the daily log-return.", font: SERIF, size: 20, color: INK }),
  ], { alignment: AlignmentType.JUSTIFIED }),
  H2("4.1  Drift and volatility estimation"),
  RUNS([
    new TextRun({ text: "The per-step drift d blends two views of trend and is damped to temper long-horizon extrapolation. Let d", font: SERIF, size: 20, color: INK }),
    new TextRun({ text: "hist", font: SERIF, size: 20, color: INK, subScript: true }),
    new TextRun({ text: " be the mean historical log-return and d", font: SERIF, size: 20, color: INK }),
    new TextRun({ text: "reg", font: SERIF, size: 20, color: INK, subScript: true }),
    new TextRun({ text: " the slope of an OLS fit of ln(price) on time over the most recent 504 observations. With damping k = 0.5:", font: SERIF, size: 20, color: INK }),
  ], { alignment: AlignmentType.JUSTIFIED }),
  EQ([er("d = k × ( 0.5 d"), sub("hist"), er(" + 0.5 d"), sub("reg"), er(" ) ,     s = stdev( r"), sub("t"), er(" )")]),
  P("where s is the daily volatility (standard deviation of log-returns). The blend gives weight to both the realised mean return and the fitted trend, while damping prevents a steep recent slope from producing implausible multi-month projections."),
  H2("4.2  Simulation"),
  P("Each of P = 2000 paths is evolved over H = 252 trading days. Because d is already a mean log-return, each step draws the log-return directly as Normal(d, s) — no additional Ito correction is applied (applying one would bias the median low by one-half the daily variance per step):"),
  EQ([er("S"), sub("t"), er(" = S"), sub("t−1"), er(" × exp( d + s × Z"), sub("t"), er(" ) ,     Z"), sub("t"), er(" ~ Normal(0, 1)")]),
  P("At each step the empirical percentiles of the 2000 simulated prices are recorded. The 10th, 25th, 50th, 75th and 90th percentiles form the fan chart; the median (P50) is the base case and P10/P90 the bear/bull envelope, summarised at the 3-, 6- and 12-month horizons."),
  H2("4.3  Validation and reproducibility"),
  P("Model quality is reported alongside every forecast. A walk-forward diagnostic re-fits on all but the last twenty-one trading days, projects the median forward, and reports the mean absolute percentage error (MAPE) against the realised price; the trend-fit R-squared is shown as goodness-of-fit. Users are told plainly that higher backtest error and lower R-squared imply wider real-world uncertainty than the bands convey. All paths derive from a seeded generator, so the scenario fan is exactly reproducible."),
  P("**Assumptions and their limits.** GBM presumes independent, identically distributed, log-normal shocks and a stationary drift/volatility regime. Frontier-market returns exhibit fat tails, autocorrelation and regime shifts; thin liquidity can make realised paths jump. The forecast is framed throughout as an illustrative scenario, not a prediction, recommendation or guarantee."),

  H1("Fundamental and dividend scenario models"),
  P("Alongside the statistical view, a fundamentals view derives an implied price from an earnings assumption. With trailing-twelve-month EPS and an assumed exit price/earnings multiple m:"),
  EQ([er("implied price = EPS"), sub("ttm"), er(" × m")]),
  P("A sensitivity grid spans a range of growth and exit-multiple assumptions so the analyst reads the valuation surface rather than a single figure. The dividend model projects a forward path from the trailing-twelve-month dividend per share, grown at the historical compound annual growth rate clamped to a sane band, and reports a yield-on-cost path. All inputs are sourced from the market data feed or cited filings; none are supplied by a model."),

  H1("Portfolio construction and analytics"),
  P("Portfolios are specified in either target-weight or share-unit mode; a common effective-weight function values unit-mode books by units multiplied by price so both feed one analytics path. On construction the platform computes a weighted dividend yield, a weighted price/earnings ratio (only positive earners contribute) and a sector allocation. An illustrative backtest rebases the blended book and its benchmark to 100 and holds current weights constant over the window — without rebalancing, dividends or transaction costs — reporting cumulative return, annualised volatility and maximum drawdown. This simplification is disclosed."),

  H1("Portfolio risk analytics"),
  RUNS([
    new TextRun({ text: "Risk statistics are computed from aligned daily level series (rebased portfolio and benchmark), from which returns are derived internally. Writing p and b for portfolio and benchmark daily returns and r", font: SERIF, size: 20, color: INK }),
    new TextRun({ text: "f", font: SERIF, size: 20, color: INK, subScript: true }),
    new TextRun({ text: " for the daily risk-free rate:", font: SERIF, size: 20, color: INK }),
  ], { alignment: AlignmentType.JUSTIFIED }),
  EQ([er("beta = cov(p, b) / var(b) ,   alpha = [ mean(p) − ( r"), sub("f"), er(" + beta ( mean(b) − r"), sub("f"), er(" ) ) ] × 252")]),
  EQ([er("tracking error = stdev(p − b) × sqrt(252) ,   Sharpe = annualised excess / annualised volatility")]),
  P("Jensen's alpha is the annualised return in excess of the CAPM expectation; the information ratio scales active return by tracking error; the Sortino ratio replaces total volatility with downside deviation against the risk-free target. Tail risk is estimated non-parametrically: the one-day 95% historical Value-at-Risk is the empirical loss quantile, and the 95% conditional VaR (expected shortfall) is the mean loss beyond it. A holding-level correlation matrix exposes diversification and concentration; maximum drawdown is measured peak-to-trough on the level series."),

  H1("Positions accounting and technical indicators"),
  P("Booked transactions drive an average-cost engine that tracks running units, cost basis and realised profit and loss, with fees pro-rated to matched units on partial sells. Technical overlays — simple moving averages, the 14-period relative-strength index, drawdown-from-peak and annualised volatility — are computed on the full price history and then sliced to the visible window, so long-lookback indicators remain correct on short views."),

  H1("The reasoning layer and the provenance strategy"),
  P("The distinctive element is how the platform uses large language models. The governing rule is absolute: the model is a reasoner over supplied evidence, never a source of market facts. NGX prices, fundamentals and ratios are injected from the authenticated feed or extracted from official filings the system has read; the model is instructed to use only the figures provided, and its outputs are returned as validated structured objects where a schema applies."),
  P("Two safeguards close the loop. First, arithmetic is never trusted to the model: all position sizing and profit-and-loss are recomputed server-side from units and live prices, any invented instrument is dropped, and entry prices are reconciled to live quotes. Second, filing extractions carry page-level citations back to the source document. Together these convert the model from a potential fabricator into an auditable analyst that must show its work."),
  H2("9.1  Reasoning-layer features"),
  ...BULLETS([
    "**Daily desk briefing** — a structured read of the session written strictly from the day's own market data, with optional cited web context for qualitative events.",
    "**Filing extraction** — income statement, balance sheet and cash-flow tables lifted from official NGX filing PDFs with page citations.",
    "**Portfolio review** — a cash-constrained CIO analysis whose resulting trades are routed to the approval workflow rather than executed.",
    "**AI portfolio builder** — a liquidity-first CIO/head-trader construction for a given budget and horizon, with defined entry, target and stop levels, sized server-side to live prices and saveable as a tracked paper portfolio.",
    "**Signal, dividend and sector-momentum reads** — structured buy/hold/sell theses and outlooks framed as analysis, not instruction.",
  ]),
  P("The reasoning layer is model-plural: a high-capability model serves the analytical narratives and a specialised reasoning model serves the portfolio-construction task, each with refusal handling and graceful degradation to a 'not configured' state when credentials are absent."),

  H1("Validation, governance and compliance"),
  P("Quantitative correctness is defended by a suite of unit tests over the pure analytical functions, and forecast quality by the walk-forward error reported in-product. Governance is structural. The platform is operated under dual FCA (UK) and SEC (Nigeria) oversight, enforced in code: every forecast carries an illustrative-scenario label; performance displays carry the standard past-performance caveat; rebalancing output is an analytical suggestion that must pass a maker-checker approval — an analyst submits and a different principal fund manager approves, with self-approval blocked. Access is role-based, secrets are encrypted at rest, and portfolio, transaction and approval actions are written to an audit trail. The human remains in the loop by construction: outputs are decision support for a qualified professional's judgement, and no output constitutes investment advice or an order."),

  H1("Limitations and future work"),
  ...BULLETS([
    "The GBM forecast assumes normal, i.i.d. shocks and a stationary regime; jump/regime-switching dynamics and fat tails are not modelled.",
    "Risk is single-benchmark (CAPM-style beta); a multi-factor model would better attribute frontier-market risk.",
    "Data are delayed, not streamed; the platform is explicitly a delayed-quote terminal.",
    "The illustrative backtest omits rebalancing, dividends and transaction costs by design.",
    "LLM reasoning, though provenance-bounded, still requires human verification of the qualitative narrative.",
    "The embedded single-instance datastore suits a single desk; horizontal scale would migrate to managed Postgres behind the same standard-SQL repository layer.",
  ]),

  H1("Conclusion"),
  P("The models here are individually conventional — geometric Brownian motion, CAPM-style risk, average-cost accounting, discounted fundamentals. The thesis is not in any single model but in the discipline that surrounds them: transparency so every number is reconstructable; reproducibility so every scenario is repeatable; and a provenance boundary so machine reasoning augments, but never fabricates, the evidence base. In a frontier market with delayed, sparse data and a demanding compliance regime, this bounded, auditable design — rather than maximal autonomy — is what makes AI-assisted equity research trustworthy enough to sit on an analyst's desk."),

  H1x("Selected methodological references"),
  REF("Markowitz, H. (1952). Portfolio Selection. <i>The Journal of Finance</i>, 7(1), 77–91."),
  REF("Sharpe, W. F. (1966). Mutual Fund Performance. <i>The Journal of Business</i>, 39(1), 119–138."),
  REF("Jensen, M. C. (1968). The Performance of Mutual Funds in the Period 1945–1964. <i>The Journal of Finance</i>, 23(2), 389–416."),
  REF("Black, F., & Scholes, M. (1973). The Pricing of Options and Corporate Liabilities. <i>Journal of Political Economy</i>, 81(3), 637–654."),
  REF("Merton, R. C. (1973). Theory of Rational Option Pricing. <i>The Bell Journal of Economics and Management Science</i>, 4(1), 141–183."),
  REF("Sortino, F. A., & Price, L. N. (1994). Performance Measurement in a Downside Risk Framework. <i>The Journal of Investing</i>, 3(3), 59–64."),
  REF("Artzner, P., Delbaen, F., Eber, J.-M., & Heath, D. (1999). Coherent Measures of Risk. <i>Mathematical Finance</i>, 9(3), 203–228."),
  REF("Glasserman, P. (2003). <i>Monte Carlo Methods in Financial Engineering</i>. Springer."),
  SMALL("This is an internal research and methodology white paper describing the design of the BRB NGX Analyst Platform. It is not investment advice, a research recommendation on any security, or a solicitation. Forecasts are illustrative scenarios; prices are delayed; past performance does not indicate future results.", { para: { spacing: { before: 120 } } }),
];

const doc = new Document({
  creator: "BRB Capital Group",
  title: "BRB NGX Analyst — Research & Methodology White Paper",
  styles: { default: { document: { run: { font: SERIF, size: 20, color: INK } } } },
  numbering: {
    config: [{
      reference: "bul",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "▪", alignment: AlignmentType.LEFT,
        style: { run: { color: FRESH }, paragraph: { indent: { left: 360, hanging: 200 } } } }],
    }],
  },
  sections: [{
    properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: {
      default: new Footer({ children: [ new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: "BRB Capital Group — NGX Analyst Platform · internal research white paper · p. ", font: SANS, size: 13, color: MUTED }),
        new TextRun({ children: [PageNumber.CURRENT], font: SANS, size: 13, color: MUTED }),
      ] }) ] }),
    },
    children: [...cover, ...body],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("docs/BRB-NGX-Analyst-Research-Paper.docx", buf);
  console.log("Wrote docs/BRB-NGX-Analyst-Research-Paper.docx", buf.length, "bytes");
});
