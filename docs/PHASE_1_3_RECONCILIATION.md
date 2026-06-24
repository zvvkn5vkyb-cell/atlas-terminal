# Phase 1-3: Read-Only Ledger-to-Portfolio Reconciliation

## Purpose

A pure, deterministic, read-only layer that compares ledger-derived positions against portfolio snapshot holdings. Produces a `ReconciliationResult` on demand — never persisted, never seeded into either store.

## What Shipped

| File | Role |
|---|---|
| `src/types/reconciliation.ts` | All types — no logic |
| `src/services/reconciliation/reconciliation.ts` | 7 exported pure functions |
| `src/services/reconciliation/reconciliation.test.ts` | ~72 Vitest tests across 17 describe blocks |

## Functions

| Export | Role |
|---|---|
| `normalizePortfolioHolding(holding)` | Maps `Holding` → `NormalizedPortfolioPosition` via `resolveSecurity` |
| `normalizeLedgerPosition(position)` | Maps `DerivedPosition` → `NormalizedLedgerPosition` via `getSecurityById` / `getSecurityByExactSymbol` |
| `matchSecurityIdentity(portfolio, ledger[])` | Returns the best match outcome for one portfolio position against the available ledger pool |
| `classifyReconciliationStatus(portfolio, ledger, tolerance)` | Classifies a matched pair: MATCH, QUANTITY_MISMATCH, CURRENCY_MISMATCH, NOT_COMPARABLE |
| `reconcileCashBalances(portfolioCash, ledgerCash, tolerance)` | Per-currency cash comparison |
| `summarizeReconciliation(positions, cash, reconciledAt)` | Counts, flags, and `isFullyReconciled` |
| `reconcilePositions(input)` | Top-level entry point — returns full `ReconciliationResult` |

## Design Decisions

### Determinism via required `reconciledAt`

`ReconciliationInput.reconciledAt` is required and caller-supplied. No function calls `new Date()` or reads any clock. The same inputs with the same `reconciledAt` always produce bit-identical output. All `Map`/`Set` iteration is sorted before emission; portfolio positions are sorted before processing; final rows are sorted by `STATUS_ORDER` then `matchKey` then `holdingId`/`positionKey`.

### Canonical-vs-raw key handling

`DerivedPosition.securityId` is a position key — it may be a canonical id like `US:AAPL` or a raw symbol fallback like `AAPL`. `normalizeLedgerPosition` resolves this by:
1. Calling `getSecurityById(positionKey)` — if found, `isCanonical: true` and `resolvedSecurityId` is set.
2. Calling `getSecurityByExactSymbol(positionKey)` — if found, `isCanonical: false` and `resolvedSecurityId` is set from the master.
3. Neither found — `isCanonical: false`, `resolvedSecurityId: undefined`.

`Holding` has no `securityId` field. `normalizePortfolioHolding` always calls `resolveSecurity(holding.symbol)` — the security master handles alias resolution (`FB → US:META`), Canadian suffix resolution (`RY.TO → CA:RY.TO`), and ambiguity detection.

### Identity hierarchy in `matchSecurityIdentity`

Tiers are checked in precedence order; the first applicable tier that finds exactly one candidate wins:

1. **PRIMARY** — `ledger.resolvedSecurityId === portfolio.securityId`. Clean canonical match on both sides.
2. **IDENTITY_CONFLICT** (between PRIMARY and FALLBACK) — both sides have a resolved canonical id, they differ, and normalized symbols match. Returns `kind: 'IDENTITY_CONFLICT'`, consuming both records into one `IDENTITY_MISMATCH` row. Prevents raw-symbol fallback from producing a false match.
3. **FALLBACK** — symbol text match. For `RESOLVED` portfolio: only ledger positions with no `resolvedSecurityId` are eligible (positions with a resolved id were already handled above). For `UNKNOWN` portfolio: any ledger position by symbol.

Candidate collection is exhaustive at each tier before any selection. Reversing the input array must not change the selected candidate.

### Two-severity raw-symbol issue codes

The FALLBACK tier emits different issue codes depending on portfolio resolution status:

| Portfolio status | Code | Severity | Effect on `isFullyReconciled` |
|---|---|---|---|
| `RESOLVED` | `NONCANONICAL_LEDGER_SYMBOL_MATCH` | `INFO` | No effect — INFO alone does not block |
| `UNKNOWN` | `UNVERIFIED_RAW_SYMBOL_MATCH` | `WARNING` | Blocks — WARNING prevents full reconciliation |

### Tiered ledger duplicate key

Ledger positions are deduplicated before matching using a three-tier key hierarchy. The first available tier wins:

1. `resolvedSecurityId` (canonical id from master)
2. Normalized `symbol` (trim + uppercase)
3. Normalized `positionKey` (trim + uppercase)

Duplicate positions on either side are emitted as `DUPLICATE` rows before matching begins, so they never pollute the matching pool.

### Candidate collection before selection

All candidates at the strongest applicable tier are collected into an array before choosing. The sorted first element is selected. Selecting `candidates[0]` from an unsorted list is forbidden — reversing the input must not change the result.

### `IDENTITY_MISMATCH` consumes both records

When a canonical identity conflict is detected, the portfolio position and the conflicting ledger position are each removed from the matching pool and merged into a single `IDENTITY_MISMATCH` row. Neither appears as `ONLY_IN_PORTFOLIO` or `ONLY_IN_LEDGER`.

### `UNRESOLVED` preservation

A portfolio position with `resolutionStatus: 'UNKNOWN'` that has no raw-symbol match in the ledger is emitted as `UNRESOLVED` (not `ONLY_IN_PORTFOLIO`). The distinction communicates that the symbol itself is unrecognized, not just absent from the ledger.

### Separate cash tolerances

`ReconciliationTolerance` has separate fields for position quantity and cash:
- `quantityAbsolute` / `quantityRelative` — position comparison
- `cashAbsolute` / `cashRelative` — cash comparison

The position tolerance is never applied to cash rows and vice versa.

### `isFullyReconciled` semantics

```
isFullyReconciled = allPositionsMatch
                  && (!isCashCompared || allCashMatch)
                  && !anyRowHasWarningOrError
```

- Every position row must have `status: 'MATCH'`.
- Cash rows (when compared) must all have `status: 'MATCH'`.
- No row on either side may carry an `ERROR` or `WARNING` issue.
- `INFO` issues alone do not block reconciliation.

### `hasComparableData` and the empty-input rule

`hasComparableData` is `true` when `comparablePositionCount > 0` OR at least one cash row compares both sides. When both inputs are empty, `hasComparableData: false` and `isFullyReconciled: true` together mean "nothing to reconcile" — not "reconciled successfully." Callers should check `hasComparableData` before interpreting `isFullyReconciled`.

### Provider-neutral symbol normalization

Symbol normalization inside reconciliation is `trim + uppercase` only. No market-data provider import, no Canadian-suffix logic. All canonical resolution (`RY.TO → CA:RY.TO`, `FB → US:META`, ambiguity detection) is fully delegated to `resolveSecurity()`, `getSecurityById()`, and `getSecurityByExactSymbol()` in the security master.

## Identity Hierarchy (summary)

```
portfolioHolding.symbol ──→ resolveSecurity() ──→ portfolio.securityId (canonical, or undefined)
                                                                │
               ┌────────────────────────────────────────────────┘
               ▼
ledgerPosition.securityId (positionKey) ──→ getSecurityById() ──→ isCanonical=true
                                        └─→ getSecurityByExactSymbol() ──→ isCanonical=false, resolvedSecurityId set
                                        └─→ neither ──→ isCanonical=false, resolvedSecurityId undefined
```

Match:
- PRIMARY: `portfolio.securityId === ledger.resolvedSecurityId`
- IDENTITY_CONFLICT: both have canonical ids, they differ, symbols match → IDENTITY_MISMATCH row
- FALLBACK: symbol text match (NONCANONICAL_LEDGER_SYMBOL_MATCH INFO or UNVERIFIED_RAW_SYMBOL_MATCH WARNING)

## Comparison and Tolerance Rules

Evaluated in this order for matched pairs:

1. Portfolio `shares <= 0` → `NOT_COMPARABLE`
2. Ledger `quantity === 0` → `NOT_COMPARABLE`
3. `portfolio.currency !== ledger.currency` → `CURRENCY_MISMATCH`
4. `|portfolio.quantity - ledger.quantity| > max(quantityAbsolute, quantity * quantityRelative)` → `QUANTITY_MISMATCH`
5. Otherwise → `MATCH`

Cost basis delta is always INFO (never changes status).

## Store / UI / Audit Boundaries

This layer has **no connection** to any of the following:
- Zustand stores (`portfolioStore`, `ledgerStore`, `systemStore`, `marketStore`, `workspaceStore`)
- `recordAudit` or any audit system
- `localStorage` or `sessionStorage`
- The Portfolio UI or any React component
- Market-data providers (`PolygonMarketDataProvider`, `CanadianMarketDataProvider`, `MockMarketDataProvider`)
- `src/services/market/canadianSymbol.ts`
- `new Date()`, `Math.random()`, or any runtime clock

`ReconciliationResult` is computed on demand and immediately discarded — it is never persisted.

## Out of Scope (this phase)

- Wiring reconciliation into any UI component
- A Zustand selector or derived store for reconciliation state
- Persisting `ReconciliationResult` to `localStorage` or anywhere else
- FMP fundamentals, live Canadian quotes, or any paid data adapter
- Seeding the ledger from current holdings
- Making the ledger the visible source of truth

## Recommended Next Phase: Phase 1-4

Non-persisted Zustand selector + read-only diagnostic UI:

- Add a `useReconciliation(reconciledAt: string)` hook (or derived selector) that calls `reconcilePositions` with the current store state and returns a `ReconciliationResult`. No persistence.
- Add a `ReconciliationDiagnostics` view (not wired into the main portfolio view) that renders the `ReconciliationResult` in a table for developer inspection.
- The diagnostic view is gated behind a dev flag or keyboard shortcut; it is not part of normal portfolio display.
