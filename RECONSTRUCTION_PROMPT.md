FIRST ACTION

Before writing source code:
1. Create a new clean project folder named atlas-terminal.
2. Create a separate folder named reference/compiled.
3. Place the existing compiled files in reference/compiled:
   - index.html
   - index-ChdNhnMc.js
   - index-CoadSqtc.css
4. Do not modify, import, or build from these compiled files.
5. Use them only as visual/behavioral reference.
6. Then build the clean Vite + React + TypeScript + Tailwind project from scratch.

You are rebuilding Atlas Terminal from compiled frontend artifacts and a prior AI build transcript.

There is no maintainable source repository.

The only available files are built frontend artifacts, stored here:

reference/
  compiled/
    index.html
    index-ChdNhnMc.js
    index-CoadSqtc.css

These files are evidence, not foundation.

Use them only as forensic reference for:
- visual behavior
- rough UI structure
- previous app layout
- prior styling clues

Do not edit them.
Do not import them.
Do not copy them into src.
Do not patch the minified JS bundle.
Do not use the compiled CSS as the new source stylesheet.
Do not treat the compiled bundle as maintainable source code.

The JS file is a compiled/minified production React bundle.
The CSS file is compiled Tailwind output.
They are not suitable for direct development.

Your job is to reconstruct a clean, maintainable source project from scratch.

PROJECT CONTEXT

Atlas Terminal is an institutional-grade financial workstation for a discretionary portfolio manager.

It is not a consumer fintech dashboard.
It is not a toy prototype.
It is not a generic portfolio tracker.

The product should feel like a serious market intelligence and portfolio management terminal built for a fiduciary operating under regulatory constraints.

Prioritize:
- reliability over flash
- data integrity over completeness
- explicit degradation over hidden assumptions
- workflow speed over visual decoration
- dense institutional layout over consumer-style whitespace
- modular architecture over monolithic files
- auditability over convenience
- source traceability over vague summaries

TECHNOLOGY TARGET

Use:
- Vite
- React
- TypeScript
- Tailwind CSS
- Zustand
- local mock data initially
- clean component structure
- no paid services required at reconstruction stage

Do not use:
- Next.js for this reconstruction phase
- Supabase
- Redis
- paid APIs
- backend services unless explicitly stubbed
- AI APIs yet

The first deliverable is a clean local frontend application that can run and build.

CREATE THIS PROJECT STRUCTURE

atlas-terminal/
  package.json
  index.html
  tsconfig.json
  vite.config.ts
  tailwind.config.ts
  postcss.config.js
  src/
    main.tsx
    App.tsx
    index.css

    types/
      market.ts
      portfolio.ts
      privateAsset.ts
      news.ts
      macro.ts
      system.ts

    lib/
      format.ts
      mockData.ts
      routes.ts
      constants.ts
      analytics/
        performance.ts
        risk.ts
        attribution.ts
        trustMode.ts

    store/
      workspaceStore.ts
      marketStore.ts
      portfolioStore.ts
      systemStore.ts

    hooks/
      useKeyboardShortcuts.ts
      useCommandPalette.ts
      useMockMarketData.ts
      usePortfolioAnalytics.ts
      usePortfolioRisk.ts

    components/
      shell/
        WorkspaceShell.tsx
        Sidebar.tsx
        Header.tsx
        StatusBar.tsx
        CommandPalette.tsx

      ui/
        MetricCard.tsx
        DataTable.tsx
        Badge.tsx
        Button.tsx
        LoadingState.tsx
        EmptyState.tsx
        DegradedDataBadge.tsx
        SectionHeader.tsx

      portfolio/
        PerformanceStrip.tsx
        RiskSummaryStrip.tsx
        SummaryStrip.tsx
        HoldingsTable.tsx
        TopContributors.tsx
        AllocationBlock.tsx
        CashBlock.tsx
        IntegrityBlock.tsx
        RiskFlagsBlock.tsx

    pages/
      MarketOverview.tsx
      SecurityDetail.tsx
      Portfolio.tsx
      PrivateAssets.tsx
      MacroDashboard.tsx
      NewsFeed.tsx
      Screener.tsx
      Intelligence.tsx

PHASE 1: RECREATE THE APPLICATION SHELL

Build the application shell first.

Requirements:
- full-height terminal workspace
- compact left sidebar
- collapsible sidebar
- header with active module title
- command palette opened by Ctrl+K / Cmd+K
- keyboard shortcuts Alt+1 through Alt+8 for modules
- bottom status bar
- dense table/data styling
- tabular numeric formatting
- module navigation for:
  1. Market Overview
  2. Security Detail
  3. Portfolio
  4. Private Assets
  5. Macro
  6. News
  7. Screener
  8. Intelligence

Navigation can be hash-based or client-side state-based.
Do not overbuild routing.
The goal is a clean local frontend.

PHASE 2: VISUAL DESIGN SYSTEM

Use an institutional market-terminal aesthetic inspired by legacy trading workstations.

Important:
Do not copy Bloomberg branding.
Do not use Bloomberg logos.
Do not copy proprietary labels or layouts.
Do not recreate exact Bloomberg screens.

Recreate only the general visual language:
- dark high-density workstation feel
- warm amber/orange highlights
- vivid market green and red
- slate/charcoal panels
- cool blue/cyan chart accents
- thin separators
- compact typography
- data-heavy widgets

Color system:
- App background: near-black graphite, #0b0b0d
- Sidebar background: #08090a
- Panel background: dark charcoal, #111214
- Elevated card background: #16181b
- Border/divider: #2a2d31
- Strong border: #3a3d42
- Primary text: #e6e6e6
- Secondary text: #a8adb4
- Muted text: #7f858d
- Accent amber: #f0a020
- Accent orange: #ff9f1a
- Accent yellow: #ffd24d
- Positive green: #00c853
- Negative red: #ff4d57
- Neutral blue: #4da3ff
- Cyan/chart accent: #39c0ed
- Purple secondary chart accent: #9b6bff

Tailwind theme tokens:
terminalBg: '#0b0b0d'
terminalSidebar: '#08090a'
terminalPanel: '#111214'
terminalElevated: '#16181b'
terminalBorder: '#2a2d31'
terminalStrongBorder: '#3a3d42'
terminalText: '#e6e6e6'
terminalSubtext: '#a8adb4'
terminalMuted: '#7f858d'
terminalAmber: '#f0a020'
terminalOrange: '#ff9f1a'
terminalYellow: '#ffd24d'
terminalGreen: '#00c853'
terminalRed: '#ff4d57'
terminalBlue: '#4da3ff'
terminalCyan: '#39c0ed'
terminalPurple: '#9b6bff'

Visual rules:
- very dense layout
- small text
- compact spacing
- thin borders everywhere
- little to no rounded corners
- no playful gradients
- no oversized SaaS cards
- no consumer fintech styling
- no excessive whitespace
- section headers should use small uppercase labels
- active controls should use amber/orange
- positive numbers use green
- negative numbers use red
- neutral data can use cyan/blue
- background panels must remain low-glare
- selected rows may use muted amber-tinted highlight
- chart placeholders should use dark backgrounds with fine grid lines
- metric cards should be compact rectangles
- tables should be dense, with tabular numerals

Typography:
- use a compact sans-serif for UI
- use monospace or tabular numerals for financial data
- small uppercase labels for section headers
- tight spacing
- no large marketing-style typography

Status badge colors:
- TRUSTED: green
- DEGRADED: amber
- INSUFFICIENT_DATA: gray
- UNTRUSTED: red

PHASE 3: MODULE STUBS

Each module must render a credible institutional placeholder.
No blank pages.

Market Overview:
- index cards
- FX/rates/commodity rows
- movers block
- market breadth placeholder
- stale/degraded indicators

Security Detail:
- symbol header
- price summary
- chart placeholder
- technical indicator block
- valuation metrics block
- financials section
- news/filings placeholder

Portfolio:
This is the priority page.
Recreate it with the most detail.

Include:
- performance strip
- timeframe selector:
  - 1D
  - 7D
  - 30D
  - 90D
  - YTD
  - SI
- risk summary strip
- summary strip
- holdings table
- top contributors block
- allocation block
- cash block
- integrity/trust block
- risk flags block

Portfolio styling:
- performance strip should look like a compact terminal summary row
- risk strip should use compact colored severity indicators
- holdings table should be the dominant visual anchor
- allocation, contributors, and risk blocks should feel like small market widgets
- P&L values must always be color-coded green/red
- use tabular numerals everywhere
- show degradation labels for incomplete data

Private Assets:
- private asset list
- NAV history placeholder
- distributions placeholder
- cash flow timeline placeholder
- liquidity profile placeholder
- NAV reconciliation mode placeholder
- audit trail placeholder

Macro Dashboard:
- CPI card
- GDP card
- unemployment card
- policy rate card
- yield curve placeholder
- economic calendar placeholder

News:
- portfolio-aware news queue placeholder
- affected holdings
- signal/noise labels
- source/timestamp display
- stale data indicators

Screener:
- filter controls
- factor columns
- results table placeholder

Intelligence:
- investment memo drafting placeholder
- risk extraction placeholder
- earnings/news summary placeholder
- source traceability placeholder

PHASE 4: LOCAL MOCK DATA

Do not call external APIs yet.

Create realistic local mock data for:
- holdings
- prices
- NAV snapshots
- benchmark prices
- sectors
- currencies
- news items
- private assets
- macro indicators
- provider health

The mock data must be good enough to demonstrate:
- positive/negative P&L
- mixed currency exposure
- sector concentration
- portfolio drawdown
- incomplete volatility/beta states
- degraded trust mode
- stale data labels
- contribution analysis

PHASE 5: LOCAL ANALYTICS

Implement clean local calculations in TypeScript.

Performance:
- portfolio market value
- holding weights
- daily P&L
- period returns from mock NAV snapshots
- benchmark comparison from mock benchmark prices
- alpha = portfolio return minus benchmark return
- contribution = weight × holding return
- top positive contributors
- top negative contributors

Timeframes:
- 1D
- 7D
- 30D
- 90D
- YTD
- SI

Risk:
- top 1 concentration
- top 3 concentration
- top 5 concentration
- concentration labels:
  - HIGH if top 3 > 40%
  - MEDIUM if top 3 is 25% to 40%
  - LOW if top 3 < 25%
- sector exposure
- dominant sector
- unknown sector handling
- currency exposure
- drawdown from NAV snapshots:
  - find historical peak NAV
  - calculate current NAV vs peak NAV
  - include peak date
- annualized volatility from daily NAV returns:
  - std daily returns × sqrt(252)
  - require at least 20 daily returns
  - otherwise return INSUFFICIENT_DATA
- beta versus benchmark:
  - align portfolio and benchmark return dates
  - beta = covariance(portfolio returns, benchmark returns) / variance(benchmark returns)
  - require sufficient overlap
  - otherwise return INSUFFICIENT_DATA
- risk flags:
  - max 5
  - prioritize by severity
  - examples:
    - top 3 positions exceed 40%
    - dominant sector exposure above threshold
    - drawdown exceeds 10%
    - USD exposure exceeds 50%
    - beta unavailable due to insufficient overlap

Trust mode:
- TRUSTED
- DEGRADED
- INSUFFICIENT_DATA
- UNTRUSTED

Rules:
- never fake missing metrics
- never hide uncertainty
- never interpolate missing data silently
- if data is incomplete, label it clearly
- volatility, beta, and drawdown should be restricted or marked unreliable when trust mode is UNTRUSTED

PHASE 6: COMMAND PALETTE

Command palette should support:
- module navigation
- symbol lookup examples:
  - SPY
  - XIU.TO
  - RY.TO
  - TD.TO
  - AAPL
  - MSFT
- quick actions:
  - Open Portfolio
  - Open Risk
  - Open News
  - Toggle Sidebar
  - Toggle Theme if implemented

PHASE 7: VERIFICATION

After implementation:
- npm install
- npm run dev
- npm run build
- fix all TypeScript errors
- verify no console errors
- verify all navigation works
- verify Ctrl/Cmd+K works
- verify Alt+1 through Alt+8 works
- verify Portfolio page renders all intended blocks
- verify no blank module pages
- verify the UI follows the dark graphite / amber / green / red institutional terminal aesthetic

Do not mark complete if the app does not build.

WHAT NOT TO DO

Do not:
- patch compiled minified files
- import compiled files into src
- use the compiled CSS as the active stylesheet
- build a backend yet
- use paid APIs
- call external APIs
- add authentication
- add Supabase
- add Redis
- overbuild routing
- create giant monolithic components
- hide incomplete data
- use consumer-fintech cards or soft pastel colors
- copy Bloomberg branding or exact layouts
- claim real data is live when it is mock data

COMPLETION RESPONSE

At completion, provide:
1. files created
2. commands to run locally
3. what was reconstructed
4. what remains mock/stubbed
5. what could not be recovered from the compiled bundle
6. known limitations
7. recommended next phase

Recommended next phase after reconstruction:
Build the real data layer:
- provider abstraction
- local cache
- normalized schemas
- API clients
- portfolio persistence
- NAV snapshot storage
- benchmark history storage
- risk/performance tests