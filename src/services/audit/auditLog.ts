import type {
  AuditEntry,
  AuditCategory,
  AuditSource,
  AuditEntityType,
  AuditSeverity,
  AuditPayload,
  AuditLogEnvelope,
  AuditWriteResult,
} from '@/types/audit'
import {
  AUDIT_STORAGE_KEY,
  AUDIT_MAX_ENTRIES,
  AUDIT_DEFAULT_USER_ID,
  AUDIT_REDACTED_KEYS,
} from './constants'
import {
  type AuditStorage,
  createLocalStorageBackend,
  createMemoryBackend,
  readEnvelope,
  writeEnvelope,
} from './auditStorage'
import { createSessionId, getSessionId } from './session'

// ─── Default storage (lazy, browser-safe) ─────────────────────────────────────

let _defaultStorage: AuditStorage | null = null

function createDefaultStorage(): AuditStorage {
  if (typeof window === 'undefined') return createMemoryBackend()
  try {
    const probe = '__atlas_audit_default_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return createLocalStorageBackend(AUDIT_STORAGE_KEY)
  } catch {
    return createMemoryBackend()
  }
}

function getDefaultStorage(): AuditStorage {
  if (_defaultStorage === null) {
    _defaultStorage = createDefaultStorage()
  }
  return _defaultStorage
}

// ─── Entry creation ────────────────────────────────────────────────────────────

export interface CreateAuditEntryParams {
  category: AuditCategory
  action: string
  entityType: AuditEntityType
  entityId?: string
  before?: AuditPayload
  after?: AuditPayload
  metadata?: AuditPayload
  userId?: string
  sessionId?: string
  source: AuditSource
  severity?: AuditSeverity
  reason?: string
  // Injectable for deterministic tests.
  auditId?: string
  timestamp?: string
}

export function createAuditEntry(params: CreateAuditEntryParams): AuditEntry {
  const {
    category,
    action,
    entityType,
    entityId,
    before,
    after,
    metadata,
    userId = AUDIT_DEFAULT_USER_ID,
    sessionId = getSessionId(),
    source,
    severity,
    reason,
    auditId = createSessionId(),
    timestamp = new Date().toISOString(),
  } = params

  const entry: AuditEntry = {
    auditId,
    timestamp,
    category,
    action,
    entityType,
    userId,
    sessionId,
    source,
  }

  if (entityId !== undefined) entry.entityId = entityId
  if (before !== undefined) entry.before = before
  if (after !== undefined) entry.after = after
  if (metadata !== undefined) entry.metadata = metadata
  if (severity !== undefined) entry.severity = severity
  if (reason !== undefined) entry.reason = reason

  return entry
}

// ─── Redaction ────────────────────────────────────────────────────────────────

function redactValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(redactValue)
  return redactObject(value as AuditPayload)
}

function redactObject(obj: AuditPayload): AuditPayload {
  const result: AuditPayload = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = AUDIT_REDACTED_KEYS.has(key) ? '[REDACTED]' : redactValue(value)
  }
  return result
}

export function redactAuditPayload(entry: AuditEntry): AuditEntry {
  const redacted = { ...entry }
  if (redacted.before !== undefined) redacted.before = redactObject(redacted.before)
  if (redacted.after !== undefined) redacted.after = redactObject(redacted.after)
  if (redacted.metadata !== undefined) redacted.metadata = redactObject(redacted.metadata)
  return redacted
}

// ─── Append (ring buffer) ─────────────────────────────────────────────────────

export function appendAuditEntry(
  entry: AuditEntry,
  storage: AuditStorage = getDefaultStorage(),
  maxEntries: number = AUDIT_MAX_ENTRIES,
): AuditWriteResult {
  const envelope = readEnvelope(storage)
  let entries = [...envelope.entries, entry]

  let droppedForCapacity = 0
  if (maxEntries > 0 && entries.length > maxEntries) {
    droppedForCapacity = entries.length - maxEntries
    entries = entries.slice(droppedForCapacity)
  }

  const newEnvelope: AuditLogEnvelope = {
    schemaVersion: envelope.schemaVersion,
    entries,
  }

  let persisted = writeEnvelope(storage, newEnvelope)
  let error: string | undefined

  if (!persisted) {
    // Quota/failure recovery: drop oldest half and retry once.
    const dropHalf = Math.floor(entries.length / 2)
    droppedForCapacity += dropHalf
    entries = entries.slice(dropHalf)
    const retryEnvelope: AuditLogEnvelope = { schemaVersion: envelope.schemaVersion, entries }
    persisted = writeEnvelope(storage, retryEnvelope)
    if (!persisted) {
      error = 'Write failed after retry'
    }
  }

  return { entry, persisted, droppedForCapacity, error }
}

// ─── Read / clear ─────────────────────────────────────────────────────────────

export function getAuditEntries(
  storage: AuditStorage = getDefaultStorage(),
): AuditEntry[] {
  return [...readEnvelope(storage).entries]
}

export function clearAuditEntries(
  storage: AuditStorage = getDefaultStorage(),
): void {
  storage.remove()
}

// ─── Filter ───────────────────────────────────────────────────────────────────

export interface FilterAuditEntriesParams {
  category?: AuditCategory
  action?: string
  entityType?: AuditEntityType
  entityId?: string
  severity?: AuditSeverity
  source?: AuditSource
  fromTimestamp?: string  // inclusive ISO string
  toTimestamp?: string    // inclusive ISO string
}

export function filterAuditEntries(
  entries: AuditEntry[],
  params: FilterAuditEntriesParams,
): AuditEntry[] {
  const { category, action, entityType, entityId, severity, source, fromTimestamp, toTimestamp } = params
  return entries.filter(e => {
    if (category !== undefined && e.category !== category) return false
    if (action !== undefined && e.action !== action) return false
    if (entityType !== undefined && e.entityType !== entityType) return false
    if (entityId !== undefined && e.entityId !== entityId) return false
    if (severity !== undefined && e.severity !== severity) return false
    if (source !== undefined && e.source !== source) return false
    if (fromTimestamp !== undefined && e.timestamp < fromTimestamp) return false
    if (toTimestamp !== undefined && e.timestamp > toTimestamp) return false
    return true
  })
}

// ─── recordAudit: primary integration helper ──────────────────────────────────
//
// Composes createAuditEntry → redactAuditPayload → appendAuditEntry.
// This is the single call site for all future store mutation audit hooks.

export function recordAudit(
  params: CreateAuditEntryParams,
  storage: AuditStorage = getDefaultStorage(),
  maxEntries: number = AUDIT_MAX_ENTRIES,
): AuditWriteResult {
  const entry = createAuditEntry(params)
  const redacted = redactAuditPayload(entry)
  return appendAuditEntry(redacted, storage, maxEntries)
}
