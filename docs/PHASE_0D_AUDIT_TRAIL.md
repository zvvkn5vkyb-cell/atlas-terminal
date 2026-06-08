# Phase 0D — Audit Trail Foundation

> Phase 0D artifact. Builds on Phase 0A (engineering baseline), Phase 0B
> (data provenance), Phase 0C (security master), and Phase 0C-3 (symbol
> ambiguity guard). Additive and pure — no store, provider, page, or UI
> behavior changed.

## Purpose

Give Atlas a typed, testable, fail-safe audit trail so future state-changing
actions (price refreshes, manual overrides, transaction entries, rebalance
approvals, security-master edits) can emit structured audit records without
coupling to the action that triggered them.

This addresses architectural risk **R7 — No audit trail** from the engineering
baseline.

## What shipped

| File | Role |
|---|---|
| `src/types/audit.ts` | Pure types: `AuditEntry`, `AuditCategory`, `AuditSeverity`, `AuditSource`, `AuditEntityType`, `AuditPayload`, `AuditLogEnvelope`, `AuditWriteResult`. |
| `src/services/audit/constants.ts` | `AUDIT_STORAGE_KEY`, `AUDIT_MAX_ENTRIES`, `AUDIT_SCHEMA_VERSION`, `AUDIT_DEFAULT_USER_ID`, `AUDIT_REDACTED_KEYS`. |
| `src/services/audit/auditStorage.ts` | `AuditStorage` interface; `createLocalStorageBackend`, `createMemoryBackend`, `createFailingBackend`; `readEnvelope`, `writeEnvelope`. |
| `src/services/audit/session.ts` | `createSessionId`, `getSessionId`, `_resetSessionId`. |
| `src/services/audit/auditLog.ts` | `createAuditEntry`, `appendAuditEntry`, `getAuditEntries`, `clearAuditEntries`, `filterAuditEntries`, `redactAuditPayload`, `recordAudit`. |
| `src/services/audit/auditLog.test.ts` | Core utility tests. |
| `src/services/audit/auditStorage.test.ts` | Storage backend and envelope tests. |
| `src/services/audit/session.test.ts` | Session ID generation and singleton tests. |

## Data model (`AuditEntry`)

`auditId`, `timestamp` (ISO 8601), `category`, `action` (dotted convention:
`'PORTFOLIO.PRICE_REFRESH'`), `entityType`, `userId` (default `'local'`),
`sessionId`, `source`, plus optional `entityId`, `before`, `after`,
`metadata`, `severity`, `reason`.

Design decisions:

- **`AuditEntityType` is an open string union.** Known values autocomplete;
  any string is accepted so new entity kinds require no type refactor (mirrors
  the security master's `CountryCode` pattern).
- **`userId` defaults to `'local'`.** No authentication system exists yet.
  When an auth layer is added, the call sites that use `recordAudit()` supply
  the real user identity — the API is already wired for it.
- **`action` uses dotted convention** (`CATEGORY.VERB`) for easy filtering and
  grepping without an enum explosion. New actions are additive.

## Storage strategy

- **Key:** `atlas-audit-log` (matches `atlas-portfolio`, `atlas-workspace`).
- **Shape:** `AuditLogEnvelope { schemaVersion, entries }`. Top-level version
  mirrors the `portfolioStore` migration pattern — a future schema change can
  discard or transform entries without per-entry version fields.
- **Backend abstraction:** `AuditStorage { read, write, remove }` with three
  implementations:
  - `createLocalStorageBackend(key)` — browser localStorage with availability
    probe; all ops are wrapped in try/catch and return safe defaults on failure.
  - `createMemoryBackend()` — in-process Map; automatic in Node tests and as
    the production fallback when localStorage is unavailable.
  - `createFailingBackend()` — always returns null/false; used in tests to
    simulate quota errors or unavailability.
- **Not a Zustand store.** The audit log is append-mostly and read-rarely; a
  reactive store would add a persist/rehydrate surface with no current
  consumer. Free functions over an injectable backend keep it pure-testable.

## Ring-buffer behavior

- **Default cap:** `AUDIT_MAX_ENTRIES = 2000`. Justified reduction from 10,000:
  localStorage (~5 MB) is shared with portfolio and workspace state.
  2,000 entries ≈ 0.6–1 MB; 10,000 ≈ 3–5 MB. This is a local-only cap —
  raising it later (or moving to IndexedDB/backend) is a one-line change.
- **Eviction:** FIFO — oldest entries dropped first. `AuditWriteResult.droppedForCapacity`
  reports the count so callers can observe (and test) eviction.
- **Quota/failure recovery:** if the first write fails, the oldest half of
  entries is dropped and the write is retried once. Drops from retry are
  included in `droppedForCapacity`. If the retry also fails, `persisted: false`
  and `error` are set — no exception propagates to the caller.

## Session ID strategy

`createSessionId()` uses `crypto.randomUUID()` when present, with a
non-crypto `${base36-timestamp}-${base36-random}` fallback for environments
that lack it. No new dependency. `getSessionId()` is a lazy module-level
singleton — one ID per page load, stable for the tab's lifetime. Tests reset
it with `_resetSessionId()` between runs.

## `recordAudit` — primary integration helper

```typescript
recordAudit(params, storage?, maxEntries?): AuditWriteResult
```

Composes `createAuditEntry` → `redactAuditPayload` → `appendAuditEntry`.
This is the single call site for all future store mutation audit hooks. Adding
audit to `portfolioStore.refreshPrices`, for example, will be one line:

```typescript
recordAudit({ category: 'MARKET_DATA', action: 'MARKET_DATA.PRICE_REFRESH', ... })
```

## Redaction

`redactAuditPayload` walks `before`, `after`, and `metadata` recursively and
replaces the value of any key in `AUDIT_REDACTED_KEYS` with `'[REDACTED]'`.
Redacted keys: `apiKey`, `api_key`, `token`, `accessToken`, `access_token`,
`password`, `secret`, `secretKey`, `secret_key`, `authorization`,
`Authorization`. Arrays are walked element-by-element. The original entry is
not mutated.

## AuditEntry name note

`src/types/privateAsset.ts` contains a narrow `AuditEntry` scoped to private
assets only. A future phase will rename that type to `PrivateAssetAuditEntry`
to eliminate the name collision. Until then, import from `src/types/audit.ts`
for all portfolio-wide audit concerns.

## Future integration points (not wired this phase)

| Trigger | category | example action |
|---|---|---|
| `portfolioStore.refreshPrices` | `MARKET_DATA` | `MARKET_DATA.PRICE_REFRESH` |
| Transaction ledger add/edit/delete (Phase 1) | `TRANSACTION` | `TRANSACTION.CREATE` |
| NAV snapshot write | `PORTFOLIO` | `PORTFOLIO.NAV_SNAPSHOT` |
| Rebalance approval | `REBALANCE` | `REBALANCE.APPROVE` |
| Manual price/holding override | `USER_ACTION` | `PORTFOLIO.MANUAL_OVERRIDE` |
| Security master edit | `SECURITY_MASTER` | `SECURITY_MASTER.UPDATE` |
| Provider/config change | `CONFIG` | `CONFIG.SET_PROVIDER` |
| ErrorBoundary / startup error | `SYSTEM` | `SYSTEM.ERROR` |

## Boundaries (explicitly out of scope)

No store wiring, no transaction ledger, no portfolio persistence, no NAV
snapshots, no benchmark history, no fundamentals, no audit UI, no provider
changes, no new dependencies.

## Recommended next phase

Either: (a) **wire `recordAudit` into the first store mutation** —
`portfolioStore.refreshPrices` is the natural candidate because it is the only
current state-changing action with observable before/after state; or (b)
**begin Phase 1 — Transaction Ledger**, which will be the first phase to
generate `TRANSACTION` category entries and make the audit trail load-bearing.
Wiring (a) is lower-risk and gives an end-to-end proof of the audit pipeline
before the ledger makes it critical.
