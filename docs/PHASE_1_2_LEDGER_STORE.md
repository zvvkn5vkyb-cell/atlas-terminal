# Phase 1-2 — Dormant Ledger Store + Audit Wiring

> Builds on Phase 1 (`docs/PHASE_1_TRANSACTION_LEDGER.md`). Wires the pure
> ledger engine into a persisted Zustand store with audit recording. The
> store starts **empty** and stays **dormant** — no seed transactions, no
> reconciliation with `portfolioStore`, no UI.

## Purpose

Give the ledger engine a stateful home: a store that can add, update, delete,
and clear `LedgerTransaction`s, recompute `LedgerState` after every successful
mutation, persist the transaction log across reloads, and record an audit
entry for every successful mutation — without touching any existing store,
page, or visible behavior.

## What shipped

| File | Role |
|---|---|
| `src/types/ledger.ts` | + `LedgerMutationResult`, `LedgerMutationErrorCode` |
| `src/services/ledger/constants.ts` | + `EMPTY_LEDGER_STATE`, `AUDIT_ACTION_TRANSACTION_CLEAR` |
| `src/store/ledgerActions.ts` | Pure mutation primitives: `generateTransactionId`, `applyAddTransaction`, `applyUpdateTransaction`, `applyDeleteTransaction`, `applyClearTransactions` |
| `src/store/ledgerStore.ts` | `useLedgerStore` — persisted Zustand store |
| `src/store/ledgerActions.test.ts` | tests for the pure primitives + an end-to-end `deriveLedgerState` check |

### Testing approach / limitation

`useLedgerStore` itself (the Zustand `persist`-wrapped store) is not
directly unit-tested — the project's Vitest config runs in a Node
environment with no `localStorage`/jsdom, and adding either solely to test a
dormant, unreferenced store would broaden this phase's footprint. Instead,
every behavioral branch in the store's actions (including the empty-clear
no-op) is expressed as a pure helper in `ledgerActions.ts` and tested there.
The store itself is a thin, mechanical wrapper: it calls the helper, and
either applies the returned state/audit or returns early. Direct store-level
testing (e.g. with jsdom) is a candidate for a future phase once the store is
wired into the UI and such infrastructure is justified more broadly.

## Store API

```ts
useLedgerStore.getState() => {
  transactions: LedgerTransaction[]
  lastMutationAt: string | null
  ledgerState: LedgerState          // recomputed after every successful mutation
  lastMutationResult: LedgerMutationResult | null

  addTransaction(input: NewLedgerTransaction): LedgerMutationResult
  updateTransaction(transactionId: string, updates: Partial<LedgerTransaction>): LedgerMutationResult
  deleteTransaction(transactionId: string): LedgerMutationResult
  clearTransactions(source?: AuditSource): LedgerMutationResult  // default 'UI'
  getTransactions(): LedgerTransaction[]
  getLedgerState(): LedgerState
}
```

`NewLedgerTransaction` is `LedgerTransaction` with `transactionId` optional —
if omitted, `generateTransactionId()` produces a `txn-`-prefixed unique id.

## Mutation behavior

- **`addTransaction`**: rejects duplicate `transactionId` (`DUPLICATE_ID`) and
  ERROR-level validation issues (`VALIDATION_ERROR`) without mutating state.
  WARNING-level issues do not block — they're returned in `result.issues`.
- **`updateTransaction`**: merges `updates` onto the existing transaction.
  `transactionId` in `updates` is ignored — it can never change. Rejects
  unknown ids (`NOT_FOUND`) and merged transactions that fail validation
  (`VALIDATION_ERROR`), leaving state untouched.
- **`deleteTransaction`**: rejects unknown ids (`NOT_FOUND`).
- **`clearTransactions`**: a no-op when the ledger is already empty — no
  state write, no `lastMutationAt`/`lastMutationResult` update, no audit
  entry. When the ledger is non-empty, resets `transactions` to `[]` and
  `ledgerState` to `EMPTY_LEDGER_STATE`.

On every successful mutation: `transactions` is replaced, `ledgerState` is
recomputed via `deriveLedgerState(transactions)`, `lastMutationAt` is set to
the current ISO timestamp, and `lastMutationResult` is set to the result.
Rejected mutations only update `lastMutationResult` — `transactions`,
`ledgerState`, and `lastMutationAt` are left unchanged.

## Audit behavior

| Action | Trigger | Builder |
|---|---|---|
| `TRANSACTION.CREATE` | successful `addTransaction` | `buildTransactionAuditParams(CREATE, added)` |
| `TRANSACTION.UPDATE` | successful `updateTransaction` | `buildTransactionAuditParams(UPDATE, after, before)` |
| `TRANSACTION.DELETE` | successful `deleteTransaction` | `buildTransactionAuditParams(DELETE, before)` |
| `TRANSACTION.CLEAR` | `clearTransactions` on a non-empty ledger | inline compact payload: `{ clearedCount }` |

All audit calls go through `recordAudit()`. Audit is recorded **only after**
the in-memory state mutation succeeds — duplicate IDs, failed validation, and
not-found updates/deletes never write an audit entry. `recordAuditSafe()`
wraps every `recordAudit()` call in a try/catch: a thrown or failed audit
write is swallowed and never blocks or rolls back the ledger mutation.

`clearTransactions` on an already-empty ledger is a pure no-op: it returns a
successful `LedgerMutationResult` without calling `set()` and **without
emitting any audit event** — clearing nothing is not a state mutation.

## Persistence

- Zustand `persist` middleware, storage key **`atlas-ledger`**, version **1**.
- `partialize` persists only `transactions` and `lastMutationAt`. The derived
  `ledgerState` and `lastMutationResult` are never persisted.
- `migrate(persisted, version)` validates the persisted shape: `transactions`
  must be an array (else `[]`), `lastMutationAt` must be a string (else
  `null`). Any other shape falls back to these safe defaults.
- `onRehydrateStorage` recomputes `ledgerState = deriveLedgerState(transactions)`
  after rehydration. If recomputation throws, the store recovers to a fully
  empty ledger (`transactions: []`, `lastMutationAt: null`,
  `ledgerState: EMPTY_LEDGER_STATE`).

## Dormancy guarantees

- The store's initial state is `transactions: []`, `ledgerState:
  EMPTY_LEDGER_STATE`. **No seed transactions are created.**
- No code path reads from or writes to `portfolioStore`, `workspaceStore`,
  `marketStore`, or `systemStore`.
- No UI component, page, or hook references `useLedgerStore`. The store is
  unreferenced outside `src/store/ledgerActions.ts` and its own test file, so
  it is tree-shaken from the production bundle and has zero effect on current
  app behavior.

## Boundaries (explicitly out of scope)

No transaction UI, no CSV import, no broker integration, no NAV snapshots, no
benchmark history, no portfolio reconciliation, no seed/migration of current
holdings, no FIFO, no new dependencies, no Polygon/Massive dependency.

## Recommended next phase

**Phase 1-3 — Read-only portfolio reconciliation**: a pure comparison module
that derives positions from `useLedgerStore.getState().ledgerState` (once
populated) and diffs them against `portfolioStore` holdings, surfacing
discrepancies without mutating either store. Seeding/migration of current
holdings into the ledger remains a separate, later decision.
