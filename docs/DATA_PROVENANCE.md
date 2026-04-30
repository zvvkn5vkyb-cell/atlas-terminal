# Data Provenance

This document explains where every number in Atlas Terminal comes from, how data quality is signalled to the user, and what the provenance labels mean.

## Provider Architecture

```
MarketDataService
    └── MarketDataRouter
            ├── PolygonMarketDataProvider  (US equities — live/delayed)
            ├── CanadianMarketDataProvider (Canadian — placeholder/degraded)
            └── MockMarketDataProvider     (market overview + fallback)
```

The router selects a provider per-symbol at request time:

| Symbol pattern | Provider (polygon mode) | Provider (mock mode) |
|---|---|---|
| `.TO`, `.TSX`, `.V` suffix | CanadianMarketDataProvider | CanadianMarketDataProvider |
| Everything else | PolygonMarketDataProvider | MockMarketDataProvider |
| Market overview (indices, FX, rates…) | MockMarketDataProvider | MockMarketDataProvider |

## Polygon.io Coverage

Polygon.io is the live US equity provider. It is used for:

- **Quotes** (`/v2/snapshot/locale/us/markets/stocks/tickers/{symbol}`) — price, change, volume
- **Historical bars** (`/v2/aggs/ticker/{symbol}/range/…`) — OHLCV bars for 1D/1W/1M/3M/1Y ranges

### Free-tier behaviour

Polygon's free tier returns a `status: "DELAYED"` field instead of `"OK"` for real-time endpoints. Atlas Terminal accepts DELAYED responses as valid data and marks the result `isStale: true`. The chart badge displays **CHART: POLYGON (DELAYED)** to make the latency visible.

### Not covered by Polygon

- Canadian exchanges (TSX, TSXV) — see Canadian Placeholder below
- International equities outside US markets
- Fundamentals (P/E, EV/EBITDA, etc.)
- News and filings

## Canadian Placeholder

Canadian symbols (`.TO`, `.TSX`, `.V`) are routed to `CanadianMarketDataProvider`, a structural placeholder that:

- Returns mock OHLCV bars so charts render without crashing
- Sets `trustMode: 'DEGRADED'` on all responses
- Sets `fallbackReason: 'Real-time Canadian data requires configured provider'`
- Sets quote `exchange: 'Canadian market provider not configured'`
- Reports health status `DEGRADED` with error message `'Canadian market provider not configured'`

No network calls are made for Canadian symbols. When a real Canadian provider (e.g. Alpha Vantage premium, Refinitiv, TMX Datalinx) is integrated, it replaces this class without touching the router or the UI.

## Mock Fallback

`MockMarketDataProvider` generates all data deterministically from the symbol name using a seeded pseudo-random function (`Math.sin`-based). The same symbol always produces the same prices across environments. It is used for:

- All data when `VITE_MARKET_PROVIDER` is unset or `mock`
- Market overview data in all modes (indices, FX, commodities, rates)
- Fallback bars when Polygon returns no results (market closed, rate-limited, etc.)

Mock data has `trustMode: 'DEGRADED'` on historical prices and quotes.

## TrustMode

`TrustMode` is a four-level data quality signal attached to every quote and historical price result.

| Value | Meaning |
|---|---|
| `TRUSTED` | Data came from a live, verified source (Polygon.io with valid key and successful response) |
| `DEGRADED` | Data is present but from a fallback source (mock bars, Canadian placeholder, Polygon error) |
| `INSUFFICIENT_DATA` | Not enough data points to compute the metric (e.g. fewer than 20 bars for SMA-20) |
| `UNTRUSTED` | Calculation result is unreliable due to data quality issues in upstream inputs |

TrustMode propagates through analytics: if historical prices are `DEGRADED`, technical indicators computed from them inherit `DEGRADED` or worse. The IntegrityBlock in the portfolio view surfaces the aggregate TrustMode for each risk metric.

## Delayed Polygon Data

When Polygon returns `status: "DELAYED"`:

- The response is treated as successful (`trustMode: 'TRUSTED'`)
- `isStale: true` is set on the `HistoricalPricesResult`
- The chart badge shows `CHART: POLYGON (DELAYED)`
- The quote badge shows `QUOTE: LIVE` (data is real, just delayed)

This matches Polygon's own documentation: DELAYED means the data is real but not real-time. The distinction matters for intraday trading but not for the portfolio analytics use case.

## Source Labels

These labels appear in the UI to identify where each data point originated.

### Provider badges (Security Detail)

| Badge | Colour | Meaning |
|---|---|---|
| `PROVIDER: POLYGON` | Green | This symbol is routed to Polygon.io |
| `PROVIDER: CANADIAN PLACEHOLDER` | Amber | This symbol is routed to the Canadian placeholder (no real data) |
| `PROVIDER: MOCK FALLBACK` | Muted | This symbol is served entirely from mock data |

### Quote badges (Security Detail)

| Badge | Colour | Meaning |
|---|---|---|
| `QUOTE: LIVE` | Green | Quote came from Polygon.io with `trustMode: TRUSTED` |
| `QUOTE: FALLBACK` | Amber | Quote is degraded (Canadian or non-Polygon degraded) |
| `QUOTE: MOCK` | Muted | Quote is from mock provider |

### Chart badges (Security Detail)

| Badge | Colour | Meaning |
|---|---|---|
| `CHART: POLYGON` | Green | Bars from Polygon.io, real-time (`isStale: false`) |
| `CHART: POLYGON (DELAYED)` | Green | Bars from Polygon.io, 15-min delayed (`isStale: true`) |
| `CHART: MOCK FALLBACK` | Amber | Bars are mock (Polygon unavailable or Canadian symbol) |

### Holdings Src column (Portfolio)

| Badge | Colour | Meaning |
|---|---|---|
| `LIVE` | Green | Price refreshed from Polygon.io this session |
| `CANADA N/C` | Amber | Canadian symbol — provider not configured, price is stale mock data |
| `FALLBACK` | Amber | Refresh attempted but degraded — price unchanged from last known value |
| `MOCK` | Muted | No refresh attempted — price is initial mock data |

### Status bar

| Label | Meaning |
|---|---|
| `US EQUITIES: POLYGON` | Polygon provider active for US symbols |
| `US EQUITIES: MOCK` | Mock mode active (no Polygon key configured) |
| `CANADA: NOT CONFIGURED` | Canadian provider placeholder active — no real TSX data |
| `OTHER FEEDS: MOCK` | Indices, FX, commodities, rates are always mock |

## Provider Health

The provider health panel (shown in the status bar as `PROVIDERS: N/M`) reports one entry per provider:

| Provider ID | Name | Expected status |
|---|---|---|
| `polygon` | Polygon.io | UP (key present), DOWN (key absent), DEGRADED (API errors) |
| `mock` | Mock Data (fallback) | Always UP |
| `canadian` | Canadian Market Data | Always DEGRADED (placeholder) |
