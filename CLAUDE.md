# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # start dev server (http://localhost:5173)
pnpm build        # tsc type-check then vite production build
pnpm preview      # serve production build locally
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest run (single pass)
pnpm test:watch   # vitest watch mode
```

## Architecture

**React 18 + TypeScript SPA** — Bloomberg-style financial terminal. No backend, no auth; all state is browser-local.

### Navigation & Modules

Eight modules (`market`, `security`, `portfolio`, `private-assets`, `macro`, `news`, `screener`, `intelligence`) defined as a `ModuleId` union in [src/types/system.ts](src/types/system.ts). `WorkspaceShell` handles routing via Alt+1–8 keyboard shortcuts and a command palette.

### Market Data — Tiered Provider Architecture

```
MarketDataService (singleton)
  └─ MarketDataRouter
       ├─ MockMarketDataProvider   (deterministic seeded fallback, always used for macro/overview)
       ├─ PolygonMarketDataProvider (US equities, 15-min delayed on free tier)
       └─ CanadianMarketDataProvider (symbols ending .TO/.TSX/.V)
```

Controlled by two env vars:
- `VITE_MARKET_PROVIDER` — `"mock"` (default) or `"polygon"` to enable hybrid mode
- `VITE_POLYGON_API_KEY` — required when using polygon mode

Provider health is reported as `ALL_UP | DEGRADED | PARTIAL | DOWN` and surfaced in the status bar.

### State — Zustand Stores (`src/store/`)

| Store | Owns |
|---|---|
| `systemStore` | Data provider health, provider status |
| `marketStore` | Indices, FX, commodities, rates, quote cache, price history cache, movers, breadth |
| `portfolioStore` | Holdings, summary, risk metrics, performance |
| `workspaceStore` | Active module, sidebar open/closed |

### Analytics (`src/lib/analytics/`)

Pure functions (no side effects) covering risk, attribution, performance, technical indicators, and trust mode. Trust mode (`FULL | PARTIAL | NONE`) reflects data quality and propagates into portfolio analytics. These are the most tested files — 162 passing Vitest tests across 8 test files in `src/`.

### Key Conventions

- **Mock data is deterministic**: the same symbol always produces the same price series (seeded pseudo-random), so analytics are reproducible without a live feed.
- **Hybrid mode degrades gracefully**: if Polygon is down or a symbol is unsupported, the router falls back to mock without throwing.
- **No ESLint/Prettier** — TypeScript strict mode (`strict: true`, target `ES2020`) is the primary correctness check.
- **Tailwind custom palette**: terminal-specific color tokens (`terminalBg`, `terminalBorder`, `terminalGreen`, `terminalRed`, etc.) defined in `tailwind.config.js`. Use these tokens rather than raw Tailwind colors.
- **Fonts**: JetBrains Mono (primary/monospace), Inter (sans).
