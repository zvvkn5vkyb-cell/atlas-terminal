// Audit trail foundation (Phase 0D).
//
// NOTE: src/types/privateAsset.ts contains a narrow AuditEntry scoped to
// private assets only. That type will be renamed to PrivateAssetAuditEntry in
// a future phase. Until then, import from this module for all portfolio-wide
// audit concerns and from privateAsset.ts only for private-asset UI.

export type AuditCategory =
  | 'PORTFOLIO'
  | 'MARKET_DATA'
  | 'SECURITY_MASTER'
  | 'TRANSACTION'
  | 'REBALANCE'
  | 'CONFIG'
  | 'USER_ACTION'
  | 'SYSTEM'

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export type AuditSource = 'UI' | 'SYSTEM' | 'IMPORT' | 'API' | 'MIGRATION'

// Open string union: known values autocomplete, any string accepted so new
// entity kinds need no type refactor (mirrors Security.CountryCode pattern).
export type AuditEntityType =
  | 'HOLDING'
  | 'SECURITY'
  | 'TRANSACTION'
  | 'NAV_SNAPSHOT'
  | 'BENCHMARK'
  | 'CASH_POSITION'
  | 'CONFIG'
  | 'SESSION'
  | (string & {})

export type AuditPayload = Record<string, unknown>

export interface AuditEntry {
  auditId: string
  timestamp: string        // ISO 8601
  category: AuditCategory
  action: string           // dotted convention: 'PORTFOLIO.PRICE_REFRESH'
  entityType: AuditEntityType
  entityId?: string
  before?: AuditPayload
  after?: AuditPayload
  metadata?: AuditPayload
  userId: string           // placeholder; default 'local' until auth is added
  sessionId: string
  source: AuditSource
  severity?: AuditSeverity
  reason?: string
}

// Top-level localStorage envelope. The schemaVersion field allows a future
// migration to discard or transform entries without per-entry version bloat.
export interface AuditLogEnvelope {
  schemaVersion: number
  entries: AuditEntry[]
}

// Returned by every write path so callers can observe persistence failures
// without exceptions propagating into the action that triggered the audit.
export interface AuditWriteResult {
  entry: AuditEntry
  persisted: boolean
  droppedForCapacity: number  // total entries dropped (cap eviction + retry drops)
  error?: string
}
