# Phase 0C — Security Master Foundation

> Phase 0C artifact. Builds on Phase 0A (engineering baseline) and Phase 0B
> (data provenance). Additive and pure — no provider/router/store/page/UI
> behavior changed.

## Purpose

Give Atlas a local **security master** so the app no longer relies *only* on raw
ticker strings. Securities gain a canonical, **stable, opaque** internal identity
(`securityId`) while existing bare-string code paths keep working unchanged. The
master is consulted for identity, validation, and (later) enrichment; it never
forces existing string routing to adopt it.

This addresses architectural risk **R8 — No security master** from the
engineering baseline, and lays the identity anchor the future transaction ledger
(R1) will key on.

## What shipped

| File | Role |
|---|---|
| `src/types/security.ts` | Pure types: `Security`, `SecurityResolution`, `AssetClass`, `SecurityType`, `CountryCode`, `Exchange`, `SecurityDataSource`. |
| `src/services/security/securityMasterSeed.ts` | Hardcoded seed `Security[]` (data only). |
| `src/services/security/securityMaster.ts` | Pure service: indexes + the 8 functions. |
| `src/services/security/securityMaster.test.ts` | Behavior: lookup, resolution, ambiguity, search, accessors. |
| `src/services/security/securitySeed.test.ts` | Seed invariants + referenced-symbol coverage. |

## Data model (`Security`)

`securityId`, `symbol`, `displaySymbol`, `name`, `assetClass`, `securityType`,
`exchange`, `currency`, `country`, plus optional `sector`, `industry`, `isin`,
`cusip`, `figi`, `exchangeMic`, `issuerId`, `aliases`, `dataSources`,
`lastVerified`, and the booleans `isActive` / `isTradable`.

Design decisions:

- **`securityId` is stable and opaque.** It is authored by hand in the seed using
  the readable convention `${country}:${symbol}` (e.g. `US:AAPL`, `CA:RY.TO`) but
  **runtime code never recomputes an id from a symbol**. The ledger will key on
  it, so it must survive ticker changes (the old ticker moves into `aliases`).
- **`symbol` stays backward-compatible** with the strings already stored on
  holdings (`"AAPL"`, `"RY.TO"`). Routing is unchanged.
- **`CountryCode` and `Exchange` are flexible string unions** (known values for
  autocomplete, any string accepted) so non-North-American securities and new
  venues need no type refactor. `exchangeMic` carries a precise ISO-10383 MIC
  when known (optional; not yet populated).
- **`AssetClass` is a superset** of the inline `Holding.assetClass` union, so a
  future unification is non-breaking.
- **`SecurityDataSource` is separate** from market `MarketDataSource`:
  reference-record provenance is a different axis from price provenance.
- **`issuerId`** is reserved for future issuer-level exposure grouping; no
  grouping logic exists yet.

## API safety: exact lookup vs safe resolution

**`resolveSecurity()` is the correct entry point for any user-originated input.**
The following call sites MUST use `resolveSecurity()` and handle all three
outcomes (`RESOLVED | AMBIGUOUS | UNKNOWN`):

- Command palette / ticker search field
- Symbol input bar in Security Detail
- File import or CSV mapping of tickers
- Transaction ledger entry (Phase 1+): resolving a ticker to a `securityId`
- Any batch or scripted enrichment that accepts external symbol lists

**`getSecurityByExactSymbol()` / `getSecurityBySymbol()` are for internal,
already-canonical data only**, where the symbol is known to be unambiguous
because it came from a prior resolution or from trusted internal state (e.g.
reading mock holdings, processing a quote returned by a provider). Passing
user-entered input to these functions silently bypasses ambiguity protection:
`getSecurityByExactSymbol('RY')` returns the U.S. listing even when the Canadian
listing also exists.

`getSecurityBySymbol` is retained as an alias of `getSecurityByExactSymbol` for
the required API surface; both carry JSDoc warnings. New callers should prefer the
`getSecurityByExactSymbol` name to make the intent explicit.

## Resolution & ambiguity rules

`resolveSecurity(query)` returns a discriminated union
(`RESOLVED | AMBIGUOUS | UNKNOWN`) so silently resolving an ambiguous symbol is
unrepresentable as success. Precedence:

1. **Fully-qualified Canadian symbol** (`.TO`/`.V`) → exact match, never
   ambiguous. `RY.TO` resolves directly.
2. **Bare/non-Canadian input** → governed by **root collision**:
   - root shared by ≥ 2 securities → **AMBIGUOUS** (e.g. `RY` → `US:RY` +
     `CA:RY.TO`). The bare form cannot disambiguate U.S. vs Canadian, so it does
     not guess.
   - root held by exactly 1 security → **RESOLVED** (e.g. `AAPL`; `ENB` →
     `CA:ENB.TO`).
   - else exact **alias** match → RESOLVED (e.g. `FB` → `US:META`).
   - else → **UNKNOWN**.

`getSecurityBySymbol` is the *literal* counterpart: an exact map lookup, so
`getSecurityBySymbol('RY')` returns the U.S. listing. Use `resolveSecurity` for
safe, user-facing resolution.

Symbol normalization reuses the existing market-layer Canadian parser
(`canadianSymbol.ts`) rather than adding another regex; `RY.TSX`/`ry.to` fold to
canonical `RY.TO`.

## Canadian / U.S. handling

Cross-listings are **distinct securities** with distinct ids: `CA:RY.TO` (TSX,
CAD) vs `US:RY` (NYSE, USD). U.S.-listed Canadian names (`RY`, `TD`) are seeded
as `COMMON_STOCK`, **not ADR**, because that status is unverified here. A seed
invariant test enforces `.TO/.V ⇒ country CA + CAD + TSX/TSXV`.

## Seed coverage

The seed covers every symbol the app currently references: the 8 mock holdings,
all movers, the benchmark (`SPY`), the default recent symbols, and the
command-palette symbols (`QQQ`, `IWM`, `GLD`, `TLT`) — plus two indices
(`SPX`, `NDX`) to exercise the `isTradable: false` case, and deliberate
collisions (`RY`, `TD`) to exercise ambiguity. `META` carries alias `FB`.

## Boundaries (explicitly out of scope)

No transaction ledger, no audit trail, no risk engine, no `portfolioStore`
changes, no UI wiring, no external enrichment (OpenFIGI/FMP/SEDAR/EDGAR), no new
dependencies. `isin`/`cusip`/`figi`/`exchangeMic`/`issuerId` remain optional and
mostly empty (manual seed only). These — plus MIC population and issuer grouping
— can be added later **without changing any `securityId`**.

## Recommended next phase

Either: (a) **adopt** the master in read-only spots that are currently
identity-blind — e.g. fix `MockMarketDataProvider.getQuote` (today every mock
symbol reports "Apple Inc.") via `getSecurityDisplayName/Currency/Exchange`, and
offer a disambiguation chooser in the command palette / symbol input when
`resolveSecurity` returns `AMBIGUOUS`; or (b) begin **Phase 1 — Transaction
Ledger**, keying transactions on `securityId` with `aliases` for ticker-change
continuity. Adoption (a) is lower-risk and demonstrates value before the ledger
makes the master load-bearing.
