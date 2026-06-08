# Phase 1 — Transaction Ledger Foundation

> Phase 1 artifact. Builds on Phase 0A (engineering baseline), Phase 0B
> (data provenance), Phase 0C (security master), Phase 0D (audit trail),
> and Phase 0D-2 (first audit integration). Additive and pure — no store,
> portfolio types, provider, page, or UI behavior changed.

## Purpose

Give Atlas a typed, deterministic, heavily-tested ledger engine that can
eventually become the source of truth for holdings, cash, cost basis,
realized gains, income, fees, taxes, transfers, and FX movements. This
addresses architectural risk **R1 — No transaction ledger** from the
engineering baseline.

## What shipped

| File | Role |
|---|---|
| `src/types/ledger.ts` | All ledger types: `LedgerTransaction`, `DerivedPosition`, `ValuedPosition`, `CashBalance`, `RealizedGainEntry`, `IncomeEntry`, `LedgerState`, `LedgerOptions`, `LedgerWarning`, `LedgerIssue`, `TransactionValidationResult`. |
| `src/services/ledger/constants.ts` | `DEFAULT_ACCOUNT_ID`, `DEFAULT_COST_BASIS_METHOD`, audit action constants, classification sets. |
| `src/services/ledger/transactionValidation.ts` | `validateTransaction`, `validateTransactions` — pure, structured errors/warnings, never throws. |
| `src/services/ledger/costBasis.ts` | `applyBuy`, `applySell`, `applySplit`, `applyReturnOfCapital` — pure ACB primitives. |
| `src/services/ledger/deriveLedgerState.ts` | `sortTransactions`, `deriveLedgerState`, `valuePositions` — the main ledger reducer. |
| `src/services/ledger/securityIdentity.ts` | `attachSecurityIdentity` — thin boundary wrapper over Phase 0C `resolveSecurity`. |
| `src/services/ledger/ledgerAudit.ts` | `buildTransactionAuditParams` — pure audit helper; `recordAudit` NOT called (deferred to Phase 1-2). |
| `src/services/ledger/costBasis.test.ts` | ACB primitive tests. |
| `src/services/ledger/transactionValidation.test.ts` | Validation rule tests. |
| `src/services/ledger/deriveLedgerState.test.ts` | Full reducer tests. |
| `src/services/ledger/securityIdentity.test.ts` | RESOLVED / AMBIGUOUS / UNKNOWN resolution tests. |
| `src/services/ledger/ledgerAudit.test.ts` | Audit param builder tests. |

## Design decisions

### Sign convention
All numeric fields on `LedgerTransaction` are **positive magnitudes**. The
`type` field determines cash/position direction. This eliminates sign-error
bugs at the entry boundary and makes validation trivial.

### Cost basis method
**AVERAGE (ACB)** is fully implemented. This is the legally mandated method
for Canadian non-registered accounts — the majority of the mock portfolio.
`CostBasisMethod = 'AVERAGE' | 'FIFO'` is typed; `FIFO` is accepted by the
validator but falls back to `AVERAGE` with no error. Explicit FIFO lot
tracking deferred.

### Currency segregation
Positions and cash balances stay in their native transaction currency. There
is no cross-currency NAV consolidation. This is the deliberate boundary
against risk **R2** (CAD/USD FX not applied to summary arithmetic). A
consolidated USD NAV requires a dedicated FX phase.

### Engine is price-free
`deriveLedgerState` never calls `MarketDataService`, `Polygon`, or any quote
provider. Market valuation is an *optional, separate step* via
`valuePositions(positions, priceLookup)` — only called when the caller
supplies a price map. The core proves cost-basis and realized math with no
live data.

### FX_CONVERSION pair processing
The first-encountered `FX_CONVERSION` transaction (by sort order) reduces
its currency cash by `amount`; its linked counterpart increases its own
currency by its `amount`. The linked transaction is tracked in a `processed`
set and skipped when encountered in sort order. Both transactions must have
`linkedTransactionId` pointing to each other.

### Fail-safe philosophy
`validateTransaction` and `deriveLedgerState` never throw. Validation returns
structured `LedgerIssue[]`. The reducer accumulates `LedgerWarning[]` and
applies safe fallbacks (oversell clamps to held quantity, missing security key
skips with warning).

### Audit integration (not wired)
`buildTransactionAuditParams(action, txn, before?)` follows the exact pattern
of Phase 0D-2's `buildPriceRefreshAuditParams`: pure helper, returns
`CreateAuditEntryParams`, does not call `recordAudit`. Wiring deferred to
Phase 1-2.

## Transaction types and effects

| Type | Cash effect | Position effect |
|---|---|---|
| BUY | −(qty×price + fees + tax) | +quantity, +totalCost |
| SELL | +(qty×price − fees − tax) | −quantity, −totalCost proportional; record realized |
| DIVIDEND/DISTRIBUTION/INTEREST | +(amount − taxWithheld) | none |
| DEPOSIT | +amount | none |
| WITHDRAWAL | −amount | none |
| FEE | −amount | none |
| TAX | −amount | none |
| TRANSFER_IN (security) | none | +quantity at supplied cost basis |
| TRANSFER_IN (cash) | +amount | none |
| TRANSFER_OUT (security) | none | −quantity at average cost; no realized |
| TRANSFER_OUT (cash) | −amount | none |
| FX_CONVERSION | −amount (sell currency), +linked.amount (buy currency) | none |
| SPLIT | none | quantity ×= n/d; averageCost ÷= n/d; totalCost unchanged |
| RETURN_OF_CAPITAL | +amount | totalCost −= amount (floors at 0); excess → realized |
| ADJUSTMENT | optional ±amount | optional +quantity at supplied/average cost |

## Security master integration

`attachSecurityIdentity(rawSymbol)` wraps `resolveSecurity` from Phase 0C
and returns `{ status, securityId?, symbol?, displaySymbol?, name?,
currency?, candidates? }`. Resolution happens at **entry time** (UI/import
boundary), never inside the reducer. The engine groups positions by
`securityId ?? symbol`, so unresolved tickers never crash the reducer
(a warning is emitted instead).

## Future integration points (not wired this phase)

| Trigger | What's needed |
|---|---|
| Phase 1-2: ledger store | `useLedgerStore` (Zustand, persist); add/update/delete transaction actions; wire `recordAudit(buildTransactionAuditParams(...))` |
| Phase 1-3: portfolio reconciliation | Read-only: derive positions from ledger, compare to snapshot `portfolioStore` |
| Phase 2: NAV computation | Compute daily NAV series from ledger + price history (deferred) |
| FX phase: cross-currency NAV | Dedicated FX rate store + consolidation layer |
| FIFO support | Add `Lot[]` to `DerivedPosition`; implement `applySellFIFO` |

## Boundaries (explicitly out of scope)

No ledger store, no transaction UI, no CSV import, no broker integration, no
NAV snapshots, no benchmark history, no fundamentals, no provider-API change,
no cross-currency NAV consolidation, no FIFO, no DRIP, no portfolioStore
changes, no holdings migration, no new dependencies. The existing app
behavior is identical — the ledger bundle is tree-shaken.

## Recommended next phase

**Phase 1-2 — Ledger Store and Audit Wiring**: add a minimal Zustand ledger
store with create/update/delete actions; wire `recordAudit` using
`buildTransactionAuditParams`; seed it with the current mock holdings as
`SEED`-source transactions so the ledger engine can shadow-compute positions
matching `portfolioStore`.
