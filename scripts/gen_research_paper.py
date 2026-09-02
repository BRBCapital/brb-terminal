#!/usr/bin/env python3
"""BRB NGX Analyst — research/methodology white paper (branded PDF)."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY, TA_CENTER
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, ListFlowable, ListItem, Image,
)

OUT = "docs/BRB-NGX-Analyst-Research-Paper.pdf"
VERSION = "Working Paper · v1.0 · August 2026"

FOREST = colors.HexColor("#052A22"); FOREST_SOFT = colors.HexColor("#1A4D40")
FRESH = colors.HexColor("#8AC873"); INK = colors.HexColor("#1F2A26")
MUTED = colors.HexColor("#5B6B64"); LINE = colors.HexColor("#D9DDD6")
SAND = colors.HexColor("#F6F5F0"); EQBG = colors.HexColor("#F2F5EF")
SERIF, SERIF_B, SERIF_I = "Times-Roman", "Times-Bold", "Times-Italic"
SANS, SANS_B = "Helvetica", "Helvetica-Bold"; MONO = "Courier"

def ps(name, **kw): return ParagraphStyle(name, **kw)
st_h1 = ps("h1", fontName=SERIF_B, fontSize=13.5, textColor=FOREST, spaceBefore=15, spaceAfter=4, leading=16)
st_h2 = ps("h2", fontName=SERIF_B, fontSize=11, textColor=FOREST_SOFT, spaceBefore=9, spaceAfter=2, leading=13)
st_body = ps("body", fontName=SERIF, fontSize=10, textColor=INK, leading=14.2, spaceAfter=6, alignment=TA_JUSTIFY)
st_small = ps("small", fontName=SANS, fontSize=8, textColor=MUTED, leading=11)
st_eq = ps("eq", fontName=SERIF_I, fontSize=10.5, textColor=FOREST, leading=15, alignment=TA_CENTER)
st_bul = ps("bul", parent=st_body, spaceAfter=2, leading=13.5)
st_ref = ps("ref", fontName=SERIF, fontSize=8.7, textColor=INK, leading=11.5, spaceAfter=3, leftIndent=12, firstLineIndent=-12)

story = []
def h1(t, n=None): story.append(Paragraph(f"{n}. &nbsp;{t}" if n else t, st_h1)); story.append(HRFlowable(width="100%", thickness=1, color=FRESH, spaceBefore=1, spaceAfter=5))
def h2(t): story.append(Paragraph(t, st_h2))
def body(t): story.append(Paragraph(t, st_body))
def bullets(items):
    story.append(ListFlowable([ListItem(Paragraph(t, st_bul), leftIndent=12, value="▪", bulletColor=FRESH) for t in items],
                              bulletType="bullet", start="▪", leftIndent=6, spaceAfter=6))
def eq(t):
    p = Paragraph(t, st_eq)
    tb = Table([[p]], colWidths=[165*mm])
    tb.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),EQBG),("LINEBEFORE",(0,0),(0,-1),2,FRESH),
                            ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
                            ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7)]))
    story.append(tb); story.append(Spacer(1,6))

def footer(c, d):
    c.saveState(); c.setStrokeColor(LINE); c.setLineWidth(0.5)
    c.line(20*mm, 14*mm, 190*mm, 14*mm)
    c.setFont(SANS, 7); c.setFillColor(MUTED)
    c.drawString(20*mm, 10*mm, "BRB Capital Group — NGX Analyst Platform · Internal research & methodology white paper")
    c.drawRightString(190*mm, 10*mm, f"p. {d.page}")
    c.restoreState()

# ── Cover page (logo on a forest band; its dark ground blends) ─────────────
LOGO = "public/brb-logo.png"
story.append(Spacer(1, 26*mm))
try:
    _lw = 70*mm
    band = Table([[Image(LOGO, width=_lw, height=_lw*382.0/948.0)]], colWidths=[169*mm])
    band.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),FOREST),("ALIGN",(0,0),(-1,-1),"CENTER"),
                              ("TOPPADDING",(0,0),(-1,-1),24),("BOTTOMPADDING",(0,0),(-1,-1),24)]))
    story.append(band)
except Exception:
    pass
story.append(Spacer(1, 18*mm))
story.append(Paragraph("BRB CAPITAL GROUP · RESEARCH &amp; TECHNOLOGY",
                       ps("cev", fontName=SANS_B, fontSize=9, textColor=FOREST_SOFT, alignment=TA_CENTER)))
story.append(Spacer(1, 7))
story.append(Paragraph(
    "Transparent Models, Constrained Machines",
    ps("ct", fontName=SERIF_B, fontSize=23, textColor=FOREST, leading=27, alignment=TA_CENTER)))
story.append(Spacer(1, 2))
story.append(Paragraph(
    "A Provenance-Bounded Architecture for AI-Assisted Equity Research on the Nigerian Exchange",
    ps("ct2", fontName=SERIF, fontSize=13, textColor=FOREST_SOFT, leading=17, alignment=TA_CENTER)))
story.append(Spacer(1, 8))
story.append(HRFlowable(width="34%", thickness=2, color=FRESH, spaceBefore=2, spaceAfter=8, hAlign="CENTER"))
story.append(Paragraph("The methodological thesis underlying the BRB NGX Analyst Platform",
                       ps("csub", fontName=SERIF_I, fontSize=11.5, textColor=MUTED, alignment=TA_CENTER)))
story.append(Spacer(1, 4))
story.append(Paragraph(f"{VERSION} &nbsp;·&nbsp; Internal analytical tool — not investment advice",
                       ps("cver", parent=st_small, alignment=TA_CENTER)))
story.append(PageBreak())

# Abstract
abody = Paragraph(
    "<b>Abstract.</b> We describe the design thesis of an internal decision-support platform for equity research "
    "on the Nigerian Exchange (NGX) operated by a dual-regulated (FCA UK / SEC Nigeria) fund and portfolio manager. "
    "The central argument is that trustworthy machine assistance in a frontier, information-scarce market is best "
    "achieved not by maximising model autonomy but by <i>bounding</i> it: pairing transparent, auditable statistical "
    "models with large-language-model (LLM) reasoning that is strictly constrained by data provenance and by "
    "compliance-by-construction. We set out six components: (i) a delayed-quote data model with market-hours-aware "
    "caching and exact reconstruction of plan-gated market aggregates; (ii) a reproducible Monte-Carlo geometric "
    "Brownian-motion (GBM) ensemble for probabilistic price scenarios with walk-forward validation; (iii) fundamental "
    "and dividend scenario models; (iv) a full single-benchmark portfolio-risk stack (beta, Jensen alpha, tracking "
    "error, information ratio, Sharpe, Sortino, historical VaR/CVaR, drawdown); (v) a provenance-constrained LLM layer "
    "in which the model never originates market figures and all position arithmetic is recomputed server-side; and "
    "(vi) a maker-checker governance workflow. We argue this architecture converts an opaque, hallucination-prone tool "
    "into an auditable analyst instrument, and we are explicit about its limitations.",
    ps("ab", fontName=SERIF, fontSize=9.3, textColor=INK, leading=13, alignment=TA_JUSTIFY))
abox = Table([[abody]], colWidths=[169*mm])
abox.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),SAND),("LEFTPADDING",(0,0),(-1,-1),12),
                          ("RIGHTPADDING",(0,0),(-1,-1),12),("TOPPADDING",(0,0),(-1,-1),9),("BOTTOMPADDING",(0,0),(-1,-1),9)]))
story.append(abox)
story.append(Paragraph("<b>Keywords:</b> frontier markets · NGX · Monte-Carlo simulation · geometric Brownian motion · "
                       "portfolio risk · large language models · data provenance · RegTech · decision support", st_small))
story.append(Spacer(1, 4))

# ── 1 ──
h1("Introduction and thesis", "1")
body("The Nigerian Exchange is a frontier equity market characterised by concentrated liquidity in a small number of "
     "large-capitalisation names, uneven disclosure, and market data that is <i>delayed</i> rather than streamed in real "
     "time. Analysts must therefore synthesise sparse, latency-bound information into portfolio decisions under a strict "
     "dual-regulatory regime. Two temptations arise when applying modern machine intelligence to this setting. The first "
     "is to let a statistical forecast masquerade as a prediction; the second is to let a language model both <i>reason "
     "about</i> and <i>supply</i> the underlying facts — inviting confident fabrication of prices, ratios and events.")
body("Our thesis is that reliability in this environment is a property of <b>constraint</b>, not autonomy. Concretely, "
     "we hold every quantitative output to three standards — it must be transparent (reconstructable from inputs), "
     "reproducible (seeded and deterministic), and provenance-bounded (no figure originates inside a model that cannot "
     "cite it). The platform is consequently positioned as <i>decision support for a qualified professional</i>, never "
     "as automated advice, and this positioning is enforced in code and workflow rather than merely stated in a "
     "disclaimer. The remainder of this paper documents the models and the strategy that operationalise that thesis.")

# ── 2 ──
h1("Design principles", "2")
bullets([
    "<b>Transparency.</b> Analytical logic lives in pure, framework-free, unit-tested functions; every displayed number "
    "is traceable to inputs and a documented formula. No result is a black box.",
    "<b>Provenance.</b> Market facts enter the system only through the authenticated data proxy or through documents the "
    "system has read and can cite. Reasoning components consume these facts; they never manufacture them.",
    "<b>Compliance-by-construction.</b> Illustrative-scenario labelling, delayed-quote disclosure with explicit "
    "freshness, a maker-checker approval gate, role-based access and a full audit trail are structural, not optional.",
    "<b>Reproducibility.</b> Stochastic components use a seeded pseudo-random generator, so a given input reproduces a "
    "given scenario fan exactly — a prerequisite for review and for regulatory defensibility.",
])

# ── 3 ──
h1("Data model and market microstructure", "3")
body("The platform is, by design, a <i>delayed-quote terminal</i>. Prices republish on the order of every twenty minutes "
     "during exchange hours (Mon–Fri, 09:00–16:00 West Africa Time) and reflect the last close outside them; the interface "
     "surfaces an explicit &lsquo;as of&rsquo; timestamp on all prices. A market-hours-aware cache assigns short time-to-live "
     "to live-price groups while the market is open (to capture each republish) and long time-to-live when it is closed "
     "(to conserve a shared monthly data quota), with static reference data cached for many hours.")
body("Certain market aggregates (sector performance, breadth, year-to-date leaders) are gated behind higher data-plan "
     "tiers. Rather than estimate them, the platform <i>reconstructs</i> them exactly from the underlying constituent list "
     "on an equal-weighted basis and labels them as derived — a real calculation, not an approximation. Foreign-exchange "
     "handling is treated carefully because the vendor returns spot and historical rates under different inversion "
     "conventions; each call site normalises to naira-per-unit before display.")

# ── 4 ──
h1("Probabilistic price forecasting: a Monte-Carlo GBM ensemble", "4")
body("Forward price scenarios are generated by an ensemble of geometric Brownian-motion paths rather than a single point "
     "forecast, so the output is a <i>distribution</i> of outcomes expressed as probability bands. Let "
     "S<sub>t</sub> denote the closing price and r<sub>t</sub> = ln(S<sub>t</sub> / S<sub>t-1</sub>) the daily log-return.")
h2("4.1 Drift and volatility estimation")
body("The per-step drift d blends two views of trend and is damped to temper long-horizon extrapolation. Let d<sub>hist</sub> "
     "be the mean historical log-return and d<sub>reg</sub> the slope of an ordinary-least-squares fit of ln(price) on time "
     "over the most recent 504 observations. With damping factor k = 0.5,")
eq("d = k &#215; ( 0.5 d<sub>hist</sub> + 0.5 d<sub>reg</sub> ) ,&nbsp;&nbsp;&nbsp; s = stdev( r<sub>t</sub> )")
body("where s is the daily volatility (standard deviation of log-returns). The blend gives weight to both the realised "
     "mean return and the fitted trend, while the damping prevents a steep recent slope from producing implausible "
     "multi-month projections.")
h2("4.2 Simulation")
body("Each of P = 2000 paths is evolved over H = 252 trading days. Because d is already a mean <i>log</i>-return, each "
     "step draws the log-return directly as Normal(d, s) — no additional Ito correction is applied (applying one would "
     "bias the median low by one-half the daily variance per step):")
eq("S<sub>t</sub> = S<sub>t-1</sub> &#215; exp( d + s &#215; Z<sub>t</sub> ) ,&nbsp;&nbsp;&nbsp; Z<sub>t</sub> ~ Normal(0, 1)")
body("At each step the empirical cross-sectional percentiles of the 2000 simulated prices are recorded. The 10th, 25th, "
     "50th, 75th and 90th percentiles form the fan chart; the median (P50) is the base case and the P10/P90 pair the "
     "bear/bull envelope, summarised at the 3-, 6- and 12-month horizons.")
h2("4.3 Validation and reproducibility")
body("Model quality is reported alongside every forecast, not hidden. A walk-forward diagnostic re-fits the model on all "
     "but the last twenty-one trading days, projects the median forward, and reports the mean absolute percentage error "
     "(MAPE) against the realised price; the trend-fit R-squared is shown as a goodness-of-fit signal. Users are told "
     "plainly that higher backtest error and lower R-squared imply wider real-world uncertainty than the bands alone "
     "convey. All paths derive from a seeded generator, so the scenario fan is exactly reproducible.")
body("<b>Assumptions and their limits.</b> GBM presumes independent, identically distributed, log-normal shocks and a "
     "stationary drift/volatility regime. Frontier-market returns exhibit fat tails, autocorrelation and regime shifts; "
     "thin liquidity can make realised paths jump. The forecast is therefore framed throughout as an illustrative "
     "scenario, not a prediction, recommendation or guarantee.")

# ── 5 ──
h1("Fundamental and dividend scenario models", "5")
body("Alongside the statistical view, a fundamentals view derives an implied price from an earnings assumption. With "
     "trailing-twelve-month earnings per share (EPS) and an assumed exit price/earnings multiple m,")
eq("implied price = EPS<sub>ttm</sub> &#215; m")
body("A sensitivity grid spans a range of growth and exit-multiple assumptions so the analyst can read the valuation "
     "surface rather than a single figure. The dividend model projects a forward path from the trailing-twelve-month "
     "dividend per share, grown at the historical compound annual growth rate clamped to a sane band (to prevent a single "
     "special dividend from exploding the projection), and reports a yield-on-cost path. All inputs are sourced from the "
     "market data feed or from cited filings; none are supplied by a model.")

# ── 6 ──
h1("Portfolio construction and analytics", "6")
body("Portfolios are specified in either target-weight or share-unit mode; a common effective-weight function values "
     "unit-mode books by units multiplied by price so that both representations feed one analytics path. On construction "
     "the platform computes a weighted dividend yield, a weighted price/earnings ratio (only positive earners contribute, "
     "since a negative EPS would corrupt the aggregate) and a sector allocation. An illustrative backtest rebases the "
     "blended book and its benchmark to 100 and holds current weights constant over the window — without rebalancing, "
     "dividends or transaction costs — reporting cumulative return, annualised volatility and maximum drawdown. The "
     "constant-weight, cost-free nature of this backtest is disclosed as a deliberate simplification.")

# ── 7 ──
h1("Portfolio risk analytics", "7")
body("Risk statistics are computed from aligned daily <i>level</i> series (the rebased portfolio and benchmark), from "
     "which returns are derived internally. Writing p and b for portfolio and benchmark daily returns and r<sub>f</sub> for "
     "the daily risk-free rate, the platform reports systematic and risk-adjusted measures:")
eq("beta = cov(p, b) / var(b) ,&nbsp;&nbsp; alpha = [ mean(p) &minus; ( r<sub>f</sub> + beta ( mean(b) &minus; r<sub>f</sub> ) ) ] &#215; 252")
eq("tracking error = stdev(p &minus; b) &#215; sqrt(252) ,&nbsp;&nbsp; Sharpe = annualised excess / annualised volatility")
body("Jensen&rsquo;s alpha is the annualised return in excess of the capital-asset-pricing-model expectation; the "
     "information ratio scales active return by tracking error; the Sortino ratio replaces total volatility with downside "
     "deviation measured against the risk-free target. Tail risk is estimated non-parametrically: the one-day 95% "
     "historical Value-at-Risk is the empirical loss quantile, and the 95% conditional VaR (expected shortfall) is the "
     "mean loss beyond it — a coherent tail measure. A holding-level correlation matrix exposes diversification and "
     "concentration. Maximum drawdown is measured peak-to-trough on the level series.")

# ── 8 ──
h1("Positions accounting and technical indicators", "8")
body("Booked transactions drive an average-cost engine that tracks running units, cost basis and realised profit and "
     "loss, with fees pro-rated to matched units on partial sells. Technical overlays — simple moving averages, the "
     "14-period relative-strength index, drawdown-from-peak and annualised volatility — are computed on the full price "
     "history and then sliced to the visible window, so that long-lookback indicators remain correct on short views.")

story.append(PageBreak())
# ── 9 ──
h1("The reasoning layer and the provenance strategy", "9")
body("The distinctive element of the architecture is how it uses large language models. The governing rule is simple and "
     "absolute: <b>the model is a reasoner over supplied evidence, never a source of market facts.</b> NGX prices, "
     "fundamentals and ratios are injected from the authenticated data feed or extracted from official filings that the "
     "system has downloaded and read; the model is instructed to use only the figures provided, and its outputs are "
     "returned as validated structured objects rather than free text where a schema applies.")
body("Two further safeguards close the loop. First, <b>arithmetic is never trusted to the model</b>: all position sizing "
     "and profit-and-loss are recomputed server-side from units and live prices, any instrument the model invents is "
     "dropped, and entry prices are reconciled to live quotes. Second, filing extractions carry <b>page-level citations</b> "
     "back to the source document, so every extracted figure is one click from its origin. Together these convert the "
     "model from a potential fabricator into an auditable analyst that must show its work.")
h2("9.1 Reasoning-layer features")
bullets([
    "<b>Daily desk briefing</b> — a structured read of the session (headline, market action, movers and sectors, FX, "
    "bottom line) written strictly from the day&rsquo;s own market data, with optional cited web context for qualitative events.",
    "<b>Filing extraction</b> — income statement, balance sheet and cash-flow tables lifted from official NGX filing PDFs "
    "with page citations.",
    "<b>Portfolio review</b> — a cash-constrained CIO analysis (diagnosis, trims, adds sized in naira, reconciled "
    "reallocation) whose resulting trades are routed to the approval workflow rather than executed.",
    "<b>AI portfolio builder</b> — a liquidity-first CIO/head-trader construction for a given budget and horizon, with "
    "defined entry, target and stop levels, sized server-side to live prices and saveable as a tracked paper portfolio.",
    "<b>Signal, dividend and sector-momentum reads</b> — structured buy/hold/sell theses and outlooks framed as analysis, "
    "not instruction.",
])
body("The reasoning layer is model-plural: a high-capability model serves the analytical narratives and a specialised "
     "reasoning model serves the portfolio-construction task, each with refusal handling and graceful degradation to a "
     "&lsquo;not configured&rsquo; state when credentials are absent.")

# ── 10 ──
h1("Validation, governance and compliance", "10")
body("Quantitative correctness is defended by a suite of unit tests over the pure analytical functions, and forecast "
     "quality by the walk-forward error reported in-product. Governance is structural. The platform is operated under "
     "dual FCA (UK) and SEC (Nigeria) oversight, and its posture is enforced in code: every forecast carries an "
     "illustrative-scenario label; performance displays carry the standard past-performance caveat; rebalancing output is "
     "an analytical suggestion that must pass a <b>maker-checker</b> approval — an analyst submits, and a different "
     "principal fund manager approves, with self-approval blocked. Access is role-based, secrets are encrypted at rest, "
     "and portfolio, transaction and approval actions are written to an immutable audit trail. Crucially, the human "
     "remains in the loop by construction: outputs are decision support for the judgement of a qualified professional, "
     "and no output constitutes investment advice or an order.")

# ── 11 ──
h1("Limitations and future work", "11")
bullets([
    "The GBM forecast assumes normal, i.i.d. shocks and a stationary regime; jump/regime-switching dynamics and "
    "fat tails are not modelled. Future work: regime-switching and jump-diffusion variants.",
    "Risk is single-benchmark (CAPM-style beta); a multi-factor risk model would better attribute frontier-market risk.",
    "Data are delayed, not streamed; the platform is explicitly a delayed-quote terminal. A real-time feed would require "
    "a different vendor tier.",
    "The illustrative backtest omits rebalancing, dividends and transaction costs by design.",
    "LLM reasoning, though provenance-bounded, still requires human verification of the qualitative narrative.",
    "The embedded single-instance datastore is appropriate for a single desk; horizontal scale would migrate to managed "
    "Postgres behind the same standard-SQL repository layer.",
])

# ── 12 ──
h1("Conclusion", "12")
body("The models in this platform are individually conventional — geometric Brownian motion, CAPM-style risk, "
     "average-cost accounting, discounted fundamentals. The thesis is not in any single model but in the discipline that "
     "surrounds them: transparency so that every number is reconstructable; reproducibility so that every scenario is "
     "repeatable; and a provenance boundary so that machine reasoning augments, but never fabricates, the evidence base. "
     "In a frontier market with delayed, sparse data and a demanding compliance regime, we argue that this bounded, "
     "auditable design — rather than maximal model autonomy — is what makes AI-assisted equity research trustworthy "
     "enough to sit on an analyst&rsquo;s desk.")

# References
h1("Selected methodological references")
refs = [
    "Markowitz, H. (1952). Portfolio Selection. <i>The Journal of Finance</i>, 7(1), 77–91.",
    "Sharpe, W. F. (1966). Mutual Fund Performance. <i>The Journal of Business</i>, 39(1), 119–138.",
    "Jensen, M. C. (1968). The Performance of Mutual Funds in the Period 1945–1964. <i>The Journal of Finance</i>, 23(2), 389–416.",
    "Black, F., &amp; Scholes, M. (1973). The Pricing of Options and Corporate Liabilities. <i>Journal of Political Economy</i>, 81(3), 637–654.",
    "Merton, R. C. (1973). Theory of Rational Option Pricing. <i>The Bell Journal of Economics and Management Science</i>, 4(1), 141–183.",
    "Sortino, F. A., &amp; Price, L. N. (1994). Performance Measurement in a Downside Risk Framework. <i>The Journal of Investing</i>, 3(3), 59–64.",
    "Artzner, P., Delbaen, F., Eber, J.-M., &amp; Heath, D. (1999). Coherent Measures of Risk. <i>Mathematical Finance</i>, 9(3), 203–228.",
    "Glasserman, P. (2003). <i>Monte Carlo Methods in Financial Engineering</i>. Springer.",
]
for r in refs:
    story.append(Paragraph(r, st_ref))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "This is an internal research and methodology white paper describing the design of the BRB NGX Analyst Platform. "
    "It is not investment advice, a research recommendation on any security, or a solicitation. Forecasts are illustrative "
    "scenarios; prices are delayed; past performance does not indicate future results.", st_small))

doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=18*mm, bottomMargin=20*mm,
                      title="BRB NGX Analyst — Research & Methodology White Paper", author="BRB Capital Group")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=footer)])
doc.build(story)
print("Wrote", OUT)
