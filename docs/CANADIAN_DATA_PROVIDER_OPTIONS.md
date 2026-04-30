# Canadian Market Data Provider Options

Evaluation of realistic data providers for TSX and TSXV-listed securities.
Prepared before implementing `CanadianMarketDataProvider` so the integration decision
is made with eyes open.

> **Prices and rate limits change.** Treat cost figures as order-of-magnitude guides;
> verify current pricing before committing.

---

## Summary Scorecard

| Provider | TSX Coverage | TSXV | Real-time | Historical | Frontend-safe | Cost floor |
|---|---|---|---|---|---|---|
| Twelve Data | Good | Partial | Paid | Yes | Risky (key exposed) | ~$29/mo |
| Alpha Vantage | Good | Partial | Paid (premium) | Yes | Risky | Free / ~$50/mo |
| Finnhub | Partial | Poor | Paid | Limited | Risky | Free / ~$50/mo |
| Yahoo Finance (unofficial) | Excellent | Good | Delayed ~15 min | Yes | No (CORS) | Free (unsupported) |
| TMX Datalinx / TSX official | Authoritative | Yes | Yes | Yes | No | Enterprise ($$$) |
| Refinitiv / LSEG | Authoritative | Yes | Yes | Yes | No | Enterprise ($$$) |
| Marketstack | Partial | No | Delayed | Yes | Risky | Free / ~$50/mo |

---

## Detailed Evaluations

---

### 1. Twelve Data

**Website:** twelvedata.com

#### Canadian ticker coverage
Good TSX coverage for major-cap names. TSXV coverage is partial — many small-caps
and venture listings are missing. Symbol format is `RY:TSX`, `TD:TSX`, etc., using
the exchange suffix rather than `.TO`.

**Impact on Atlas Terminal:** Our router and Canadian regex currently match `.TO`,
`.TSX`, `.V`. The symbol format mismatch (`RY.TO` vs `RY:TSX`) requires a translation
layer on every request. Not trivial — every Canadian quote call must strip the suffix
and reformat before hitting the API.

#### Real-time vs delayed
- Free tier: end-of-day only
- Grow plan and above: real-time quotes (with WebSocket option)
- 15-minute delayed available on lower paid tiers

#### Historical OHLCV
Yes. Intraday (1-min through 1-day) and daily/weekly/monthly. Good bar depth on paid
plans. Free tier limited to 1-day intervals with restricted history.

#### Quote support
Yes — `/quote` endpoint returns last price, open, high, low, close, volume, change, change_pct.
Matches what `IMarketDataProvider.getQuote()` expects.

#### Rate limits
- Free: 8 requests/minute, 800/day
- Basic ($29/mo): 55 req/min, 5,500/day
- Grow ($79/mo): 55 req/min, higher daily; real-time access unlocked

#### Cost
Publicly listed on website. Free tier usable for development. Production with real-time
requires at minimum the Grow tier (~$79/mo as of last check).

#### API reliability
Generally solid. REST and WebSocket endpoints are well-maintained. Good uptime record.
Documentation quality is high — endpoints are clearly described with TypeScript examples
available.

#### Licensing / production concerns
ToS permits commercial use on paid plans. Free tier is for personal/development use
only. No explicit prohibition on client-side usage, but standard API key exposure
concerns apply.

#### Frontend-direct safety
The API key would live in `VITE_TWELVE_DATA_API_KEY` and be visible in the browser
bundle — same exposure as `VITE_POLYGON_API_KEY`. Twelve Data does not enforce
domain restriction on the free tier. Paid plan allows IP/domain locking but this
is hard to enforce from a static frontend. Acceptable for personal/low-traffic use;
not ideal for public deployment.

CORS is supported — browser fetches work without a proxy.

#### Implementation complexity
**Medium.** Main friction points:
1. Symbol translation: `RY.TO` → `RY` + `exchange=TSX` (or `RY:TSX` format depending on endpoint)
2. Intraday bar format differs slightly from Polygon — `datetime` field instead of Unix `t`
3. Real-time requires WebSocket upgrade for true streaming; polling works for our use case

---

### 2. Alpha Vantage

**Website:** alphavantage.co

#### Canadian ticker coverage
Good for TSX major-caps. The critical gotcha: **Alpha Vantage uses `.TRT` as the
Toronto exchange suffix**, not `.TO`. `AAPL` → `AAPL`, but `Royal Bank` → `RY.TRT`.
This is non-standard and not documented prominently.

TSXV coverage is sparse to non-existent for smaller names.

**Impact on Atlas Terminal:** Symbol translation required on every Canadian request.
Worse than Twelve Data because `.TRT` is an Alpha Vantage-specific convention not
used anywhere else. Translating back for display would require a lookup map or
convention agreement across the codebase.

#### Real-time vs delayed
- Free tier: end-of-day data, 15-minute delayed intraday
- Premium plans: real-time intraday

#### Historical OHLCV
Yes — `TIME_SERIES_DAILY`, `TIME_SERIES_WEEKLY`, intraday intervals. History is deep
(20+ years for daily). Compact vs full output modes let you control response size.

#### Quote support
Yes — `GLOBAL_QUOTE` function returns last price, change, change percent, volume,
previous close. Sufficient for `getQuote()`.

#### Rate limits
- Free: **5 requests/minute, 500/day** — extremely restrictive for a portfolio with
  multiple Canadian holdings
- Premium: starts at 75 req/min, scales with plan tier
- 500/day ceiling on the free tier is a hard blocker for any real portfolio use

#### Cost
Free tier available (development only, non-commercial). Premium plans start around
$50/month for 75 req/min. Enterprise pricing unlisted. Alpha Vantage has historically
been one of the more affordable options, though pricing has changed multiple times.

#### API reliability
**Mixed reputation.** Documented incidents of slow responses and occasional outages.
Free tier is deprioritised in their infrastructure during high-load periods. For a
personal terminal this is liveable; for anything resembling production it is a risk.
The product is more reliable on paid tiers.

#### Licensing / production concerns
Free tier explicitly prohibits commercial use. Paid plans permit commercial use.
No attribution requirement on paid. Some users report stricter ToS enforcement in
recent years — verify before production deployment.

#### Frontend-direct safety
Same key-in-bundle concern as other providers. CORS is supported. Domain locking
available on premium plans. No meaningful enforcement on free tier.

#### Implementation complexity
**Medium-high.** The `.TRT` suffix convention is the primary pain point — it is
not systemic enough to handle with a simple regex and requires a carefully tested
translation layer. If a user types `RY.TO`, the provider must translate to `RY.TRT`
outbound and translate back `RY.TRT` → `RY.TO` for display. Without this, symbols
would display incorrectly in the UI.

---

### 3. Finnhub

**Website:** finnhub.io

#### Canadian ticker coverage
**Partial and inconsistent.** Major TSX names (RY, TD, ENB, SU) are present but
coverage thins out quickly outside the top 50-100 by market cap. TSXV coverage is
poor — most venture listings are missing. Symbol format is typically the ticker
alone (e.g. `RY`) with `exchange=toronto` as a parameter, or `RY.TO` in some endpoints.

#### Real-time vs delayed
- Free: 15-minute delayed (US), end-of-day (Canadian in practice)
- Premium: real-time for supported exchanges; Canadian real-time coverage depends
  on exchange agreements

#### Historical OHLCV
Yes — `/stock/candle` endpoint. Decent history on US equities; Canadian bar depth
is shallower. 1-minute resolution requires premium.

#### Quote support
Yes — `/quote` endpoint. Returns current price, open, high, low, previous close,
change, change percent. Suitable for `getQuote()`.

#### Rate limits
- Free: 60 calls/minute
- Premium: higher limits, varies by plan; dedicated websocket for real-time

#### Cost
Free tier is genuinely usable for development. Premium plans start around $50/month.
Finn also has a pay-per-use model for specific data sets.

#### API reliability
Good for US equities. Canadian exchange reliability is less documented — fewer
community reports to draw on. WebSocket stability is reported as good on premium.

#### Licensing / production concerns
Free tier permits non-commercial use. Production / commercial use requires a paid
plan and acceptance of commercial ToS. No notable issues reported with licensing
enforcement. Finnhub is a registered financial data redistributor with proper exchange
agreements for covered markets.

#### Frontend-direct safety
CORS supported. API key exposed in bundle same as other providers. Finnhub has no
domain-level restriction on free tier. Acceptable for personal use; key rotation
recommended for any shared deployment.

#### Implementation complexity
**Low-medium.** The API shape (REST, JSON, simple params) is clean and close to
Polygon's. The main complexity is that Canadian coverage gaps will surface as 404s
or empty responses — the provider must handle these gracefully without crashing.
Our existing `DEGRADED` fallback pattern handles this cleanly.

**Verdict:** Viable as a secondary provider to fill gaps, but not strong enough as
the primary Canadian equity source due to incomplete coverage.

---

### 4. Yahoo Finance (Unofficial / Free Fallback)

**No official API.** This section covers the unofficial endpoints that power
`finance.yahoo.com` and are widely used in the developer community.

#### Canadian ticker coverage
**Excellent.** Yahoo Finance has the broadest retail-grade Canadian coverage available
for free — `.TO` (TSX) and `.V` (TSXV) symbols both work, matching our existing regex
exactly. No symbol translation needed.

#### Real-time vs delayed
15-minute delayed for TSX (exchange agreement). Data is refreshed frequently during
market hours.

#### Historical OHLCV
Yes. Daily, weekly, monthly. Intraday available (1m, 2m, 5m, 15m, 60m) for recent
periods. History depth varies by symbol — major names have 30+ years of daily data.

#### Quote support
Yes — last price, change, change percent, volume, market cap, 52W high/low, beta,
and more. Richer than most paid APIs for meta-fields.

#### Rate limits
Not officially documented. Yahoo aggressively throttles automated traffic — typically
2,000–5,000 requests before rate limiting kicks in. Can be mitigated with delays
and rotating user agents, but this is fragile by nature.

#### Cost
Free. No API key required.

#### API reliability
**Unreliable for production.** Yahoo has broken these endpoints multiple times without
notice. The `v8/finance/chart` and `v7/finance/quote` endpoints are the current
stable-ish paths as of the knowledge cutoff, but this changes. Community-maintained
libraries (`yfinance`, `yahoo-finance2`) track breakage and patch it, but lag time
is non-trivial.

#### Licensing / production concerns
**Do not use in production.** Yahoo Finance's Terms of Service explicitly prohibit
automated data extraction and redistribution. Using unofficial endpoints in a
commercial or publicly deployed application exposes the developer to ToS violation
and potential legal action. Acceptable only as a personal development tool or
proof-of-concept.

#### Frontend-direct safety
**No.** The unofficial Yahoo endpoints do not return CORS headers that permit
browser-originated cross-origin requests. A backend proxy is required for any
browser-based usage. This is a hard blocker for our architecture, which is
frontend-only with no server component.

#### Implementation complexity
**High overall, despite simple API shape.** Problems:
1. CORS hard-blocks browser fetches → requires a proxy (breaks our architecture)
2. No API key → no way to track or control usage
3. Endpoint URLs change without notice → maintenance burden
4. ToS violation → legal risk if deployed publicly

**Verdict:** Excellent for manual investigation and prototyping locally via a Node
script. Not viable for production or browser-side integration.

---

### 5. TMX Datalinx / TSX Official

**Website:** tmx.com/en/datalinx

The Toronto Stock Exchange's own market data distribution arm. This is the
authoritative source that all other providers ultimately license from.

#### Canadian ticker coverage
Complete. All TSX and TSXV listed securities, correct in real-time.

#### Real-time vs delayed
True real-time Level 1 and Level 2 available. Delayed feeds also available at lower
cost.

#### Historical OHLCV
Yes, complete tick-level and daily history.

#### Quote support
Yes, with full depth-of-book if required.

#### Rate limits
Governed by licensing agreement. Not a concern for professional/institutional clients.

#### Cost
**Enterprise licensing.** Not publicly priced. Requires direct engagement with TMX
business development. Minimum annual commitments in the thousands to tens of thousands
of dollars depending on usage type and redistribution rights. Not viable for an
individual developer project.

#### API reliability
Authoritative — this is the source, not a re-distributor. Highest reliability available.

#### Licensing / production concerns
Strict. Redistribution requires explicit licensing. Even displaying TMX data on a
website requires exchange-approved data redistribution agreements. The licensing terms
are complex — legal review recommended before signing.

#### Frontend-direct safety
No. Designed for server-side data infrastructure. Data would be consumed server-side
and cached/served to clients.

#### Implementation complexity
High — enterprise onboarding, custom protocols (often FIX or proprietary binary
formats), dedicated infrastructure.

**Verdict:** The right answer for a commercial product at scale. Not appropriate
for Atlas Terminal at this stage.

---

### 6. Refinitiv / LSEG (formerly Thomson Reuters Eikon)

Similar profile to TMX Datalinx — institutional grade, full Canadian coverage,
real-time, expensive enterprise contracts, not browser-friendly. Adds global context
(international equities, FX, fixed income) beyond what TMX provides.

**Verdict:** Same as TMX — correct at enterprise scale, not appropriate here.

---

### 7. Marketstack

**Website:** marketstack.com

#### Canadian ticker coverage
Partial. Major TSX names (Top 50-100) are present. TSXV is largely absent.
Symbol format uses `.XTSE` (ISO exchange code) rather than `.TO`.

#### Real-time vs delayed
End-of-day only on all plans (no intraday). This is a fundamental limitation for
any use case requiring quote-level data during market hours.

#### Historical OHLCV
Yes — daily bars only. No intraday resolution at any price point.

#### Quote support
Limited — essentially the previous close and daily summary. Not suitable for live
quote display.

#### Rate limits
Free: 100 requests/month (very low). Paid: 10,000–unlimited depending on plan.

#### Cost
Free tier effectively unusable. Basic plan starts around $50/month.

#### API reliability
Decent for end-of-day batch use. Not designed for real-time workloads.

#### Licensing / production concerns
Standard commercial terms on paid plans.

#### Frontend-direct safety
CORS supported on paid plans. Key exposure same concern as others.

**Verdict:** End-of-day only is a deal-breaker for security detail and portfolio
refresh. Ruled out.

---

## Decision Matrix

Evaluated against Atlas Terminal's concrete requirements:

- Browser-direct (no backend proxy available)
- `.TO` / `.TSX` / `.V` symbol format or easy translation
- Quote + intraday OHLCV
- Affordable (<$100/month for a personal terminal)
- Acceptable ToS for personal/development use

| Provider | Browser-direct | Symbol compat | Quote | Intraday | Affordable | ToS OK |
|---|---|---|---|---|---|---|
| Twelve Data | ✓ | Needs translation | ✓ | ✓ (paid) | ✓ | ✓ (paid) |
| Alpha Vantage | ✓ | Needs `.TRT` map | ✓ | Delayed free | ✓ | ✓ (paid) |
| Finnhub | ✓ | Mostly compat | ✓ | ✓ (paid) | ✓ | ✓ (paid) |
| Yahoo Finance | ✗ (CORS) | ✓ exact match | ✓ | ✓ | ✓ | ✗ (ToS) |
| TMX / LSEG | ✗ | ✓ | ✓ | ✓ | ✗ | Enterprise |
| Marketstack | ✓ | Needs translation | EOD only | ✗ | Marginal | ✓ |

---

## Recommendation

**Twelve Data** is the strongest practical option for Atlas Terminal's current
architecture. Reasons:

1. Genuine TSX coverage for the symbols in our mock portfolio (RY, TD, XIU, ENB)
2. REST + optional WebSocket — fits cleanly into `IMarketDataProvider`
3. Quote and intraday OHLCV both available on the same plan
4. CORS supported — no backend proxy required
5. Affordable development via free tier; production upgrade path is clear
6. Symbol translation (`RY.TO` → `RY`, exchange=`TSX`) is systematic and testable

**Fallback if Twelve Data gaps are unacceptable:** Supplement with Alpha Vantage for
specific symbols, accepting the `.TRT` translation overhead. Both providers can be
wrapped behind a composite `CanadianMarketDataProvider` with per-symbol routing.

**Do not implement Yahoo Finance** for browser-side fetches. It may be useful as a
local development script for testing data shapes, but it cannot be part of the
runtime app.

---

## Implementation Notes (for when the time comes)

These are notes for the implementer, not code.

### Symbol translation

Our router uses `/\.(TO|TSX|V)$/i`. Twelve Data uses `{ticker}:{exchange}` or
just the ticker with an `exchange` query param. A translation helper should:

```
RY.TO    → ticker=RY,  exchange=TSX
ENB.TO   → ticker=ENB, exchange=TSX
ABC.V    → ticker=ABC, exchange=TSXV
SU.TSX   → ticker=SU,  exchange=TSX
```

The inverse (for display) reconstructs `.TO` / `.V` from the exchange field in
the response.

### Provider health

`CanadianMarketDataProvider.getProviderHealth()` currently hardcodes DEGRADED.
When a live provider is wired in, health should reflect the actual API key presence
and last call result — same pattern as `PolygonMarketDataProvider`.

### Rate limit guard

With a free-tier Twelve Data key, the 8 req/min ceiling is tight for a portfolio
refresh across 4 Canadian holdings. The existing `HISTORY_CACHE_TTL_MS` (5 min)
and `QUOTE_CACHE_TTL_MS` (30 sec) in Polygon's implementation should be replicated
or tightened for Canadian calls to avoid burning the limit on repeated navigation.

### Test coverage needed

Before shipping a live Canadian provider:
- Symbol translation round-trip (`.TO` → API params → back to `.TO`)
- DEGRADED fallback on 404 (symbol not found in provider)
- DEGRADED fallback on 403 (invalid key)
- Rate limit degradation (429 response)
- Correct `trustMode: 'TRUSTED'` when API returns valid data
- Health status transitions (UP → DEGRADED → UP)
