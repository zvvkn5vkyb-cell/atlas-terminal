# Atlas Terminal

A Bloomberg-style financial terminal built with React 18, TypeScript, Vite, and Zustand. Displays portfolio analytics, market data, security detail, macro dashboards, and news — with a tiered provider architecture that gracefully degrades from live data to mock fallback.

## Local Setup

```bash
# Install dependencies
npm install

# Copy environment template and fill in keys
cp .env.example .env.local

# Start development server
npm run dev
```

The app runs at `http://localhost:5173` by default.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_MARKET_PROVIDER` | No | Set to `polygon` to enable live US equity data. Omit or set to `mock` for fully offline mode. |
| `VITE_POLYGON_API_KEY` | When provider=polygon | API key from [polygon.io](https://polygon.io). Free tier supported (data will be marked DELAYED). |

These are Vite public variables — they are embedded into the client bundle at build time. Do not put secrets here that should remain server-side.

## Provider Modes

### Mock (default)

All data is generated deterministically from symbol seeds. No network calls are made. Safe for offline development and CI.

```
VITE_MARKET_PROVIDER=mock
```

| Symbol type | Quote source | Chart source | Src badge |
|---|---|---|---|
| Any | Mock | Mock | MOCK |
| Canadian (.TO/.TSX/.V) | Mock | Mock | CANADA N/C |

### Hybrid (Polygon)

US equities fetch real quotes and OHLCV bars from Polygon.io. Canadian symbols and market overview data (indices, FX, commodities) remain on mock fallback.

```
VITE_MARKET_PROVIDER=polygon
VITE_POLYGON_API_KEY=your_key_here
```

| Symbol type | Quote source | Chart source | Src badge |
|---|---|---|---|
| US equities | Polygon.io (live or delayed) | Polygon.io | LIVE |
| Canadian (.TO/.TSX/.V) | Canadian placeholder | Mock fallback | CANADA N/C |
| Other / degraded | Mock fallback | Mock fallback | FALLBACK |

## Mock vs Hybrid Data

**Mock data** is generated using a deterministic pseudo-random function seeded on the symbol name. The same symbol always produces the same price series and quote values, making it reproducible across environments.

**Hybrid mode** uses Polygon.io for per-symbol quotes and historical price bars, while delegating market overview data (indices, FX rates, commodities, rates) to the mock provider. This means the portfolio and security detail views reflect real prices when configured, but the market overview always shows mock data until additional provider integrations are added.

When Polygon returns a `DELAYED` status (free-tier accounts), data is accepted and marked `isStale: true`. The chart badge shows `CHART: POLYGON (DELAYED)`.

## Known Limitations

- **Canadian equities**: No live Canadian data provider is configured. Canadian symbols (`.TO`, `.TSX`, `.V`) route to a placeholder that returns mock bars with a `CANADA N/C` provenance label. Real data requires a TSX feed (e.g. Alpha Vantage premium, Refinitiv, or a similar Canadian market data provider).
- **Market overview**: Indices, FX rates, commodities, and rates are always mock. These will remain mock until a dedicated macro data feed is integrated.
- **Valuation metrics**: P/E, P/B, EV/EBITDA, etc. are not populated. Requires a fundamentals feed.
- **News and filings**: Placeholder only. Requires a news API integration.
- **Polygon free tier**: Quote data is 15-minute delayed. Historical bars are available but the free plan has rate limits.
- **No authentication**: The app has no user authentication layer. All state is local to the browser session.

## Development Commands

```bash
npm run dev          # Start Vite dev server with HMR
npm run build        # Type-check then production build (outputs to dist/)
npm run preview      # Serve production build locally
npm run typecheck    # Run tsc --noEmit only (no emit)
npm run test         # Run Vitest test suite once
npm run test:watch   # Run Vitest in watch mode
```

## Test and Build Status

- **Tests**: 162 passing across 8 test files (analytics, trust mode, Polygon provider, router, portfolio refresh)
- **Build**: Clean — no TypeScript errors, no lint errors
- **Test environment**: Node (no DOM); all tests are pure logic, no rendering
- **Tag**: `phase-1-reconstruction-complete`
