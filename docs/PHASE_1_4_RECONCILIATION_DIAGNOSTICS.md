# Phase 1-4: Reconciliation Diagnostics

## Purpose

Surfaces an on-demand diagnostic panel in the Portfolio view that compares the
portfolioStore's current holdings and cash against the ledgerStore's derived
positions and cash balances.  The result is read-only, computed in memory,
never persisted, and never emits audit events.

## Architecture

```
Portfolio.tsx
  └─ ReconciliationPanel
       ├─ useReconciliationDiagnostics (hook)
       │    ├─ portfolioStore.getState()  ─┐
       │    └─ ledgerStore.getState()     ─┤ atomic point-in-time read
       │         ├─ buildReconciliationInput (adapter)
       │         └─ reconcilePositions (Phase 1-3 service)
       │
       └─ buildDiagnosticsViewModel (pure function)
            ├─ ReconciliationSummaryBar
            ├─ ReconciliationPositionTable
            │    └─ ReconciliationIssueList
            └─ ReconciliationCashTable
                 └─ ReconciliationIssueList
```

## Atomic Snapshot Behaviour

When `run()` is invoked, the hook reads `portfolioStore.getState()` and
`ledgerStore.getState()` in the same synchronous block.  `ledgerWasEmpty` and
the four adapter arrays are derived from those same two state objects before
either can change.  `result` and `ledgerWasEmpty` are then stored together as
one `ReconciliationDiagnosticSnapshot` object in React local state:

```typescript
export interface ReconciliationDiagnosticSnapshot {
  result: ReconciliationResult
  ledgerWasEmpty: boolean
}
```

There is no `runAt` field.  The run timestamp is stored inside
`result.summary.reconciledAt`, which is set by `reconcilePositions` from the
`reconciledAt` argument passed to `ReconciliationInput`.  All UI code that
needs the timestamp reads it from `snapshot.result.summary.reconciledAt`.

## No Live Subscriptions

The hook uses `useState` and `useCallback` only.  Neither `usePortfolioStore`
nor `useLedgerStore` is called with a selector inside the hook body.  Stores
are read via `.getState()` inside the `run` callback — no subscription is ever
created.

## Adapter Boundary

`buildReconciliationInput` (in `reconciliationAdapter.ts`) is a pure function
that produces `ReconciliationInput` from four caller-supplied values.  It
creates shallow copies of all four arrays so that subsequent mutations to store
state cannot affect the in-flight computation.  It imports no stores, no
browser APIs, no network calls, no Date, and no audit infrastructure.

## ledgerWasEmpty Definition

```
ledgerWasEmpty = ls.transactions.length === 0
```

`transactions` is the raw transaction log in the ledger store.  The ledger is
"empty" when no transactions have ever been entered, not when all positions have
been sold.  A fully-liquidated ledger (`positions.length === 0`) with prior
transactions is NOT empty — it produces a real diagnostic result rather than
the LEDGER_EMPTY guidance message.

## Status Classification Order

Applied in this exact sequence; the first match wins:

| Priority | Condition | Status |
|---|---|---|
| 1 | `snapshot === null` | `NOT_RUN` |
| 2 | `snapshot.ledgerWasEmpty` | `LEDGER_EMPTY` |
| 3 | `summary.isFullyReconciled` | `RECONCILED` |
| 4 | any position or cash row has `status !== 'MATCH'` | `MISMATCHES` |
| 5 | otherwise | `REVIEW_REQUIRED` |

## REVIEW_REQUIRED Semantics

`REVIEW_REQUIRED` applies only when every position and cash row has
`status === 'MATCH'` but `summary.isFullyReconciled` is `false`.  This occurs
when at least one MATCH row carries a `WARNING` or `ERROR` issue (e.g.
`UNVERIFIED_RAW_SYMBOL_MATCH`).  `INFO`-only issues never block full
reconciliation and never trigger `REVIEW_REQUIRED`.

## Visible Row Filtering

A position row is included in `visiblePositionRows` only when:

```
row.status !== 'MATCH'
OR
row.issues.some(i => i.severity === 'WARNING' || i.severity === 'ERROR')
```

Clean MATCH rows and MATCH rows with only INFO issues are excluded.
The same predicate is applied to `visibleCashRows`.

`hasWarnings` in the view model checks the full result (not just visible rows)
and is `true` when ANY issue with WARNING or ERROR severity exists anywhere.

## Empty-Ledger Behaviour

When `ledgerWasEmpty` is true, the panel shows a `LEDGER_EMPTY` badge and
guidance text.  No position or cash rows from the ledger side can appear
(the ledger is empty), but portfolio-side ONLY_IN_PORTFOLIO rows may still
appear in the visible set if portfolio holdings exist.

## No Store Mutation

`runReconciliation` and `buildReconciliationInput` are pure functions.  The
hook calls `setSnapshot(...)` exactly once per run; this writes to React local
state only.  No Zustand store state is written or derived outside the hook.

## No Persistence

`ReconciliationDiagnosticSnapshot` exists in React local state for the lifetime
of the `ReconciliationPanel` component instance.  It is not persisted to
localStorage, sessionStorage, or any external storage.

## No Audit

No `recordAudit` call is made by any Phase 1-4 file.  Reconciliation runs are
not emitted as audit events.

## Out of Scope

- Exporting or saving reconciliation results to CSV or any format
- Scheduled / automatic reconciliation (requires a cron or effect)
- Ledger transaction entry or editing from the diagnostics panel
- Live update when the ledger or portfolio changes (would require subscriptions)
- Cross-currency NAV consolidation in the reconciliation engine

## Recommended Next Phase

Wire ledger transactions into the Portfolio UI so `ledgerStore` is populated
from the same holdings displayed in `portfolioStore`, enabling end-to-end
round-trip reconciliation with real `RECONCILED` status rather than
`ONLY_IN_PORTFOLIO` rows.
