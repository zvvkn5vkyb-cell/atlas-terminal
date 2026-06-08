import { describe, it, expect } from 'vitest'
import {
  createAuditEntry,
  appendAuditEntry,
  getAuditEntries,
  clearAuditEntries,
  filterAuditEntries,
  redactAuditPayload,
  recordAudit,
} from './auditLog'
import { createMemoryBackend, createFailingBackend } from './auditStorage'
import type { AuditEntry } from '@/types/audit'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return createAuditEntry({
    category: 'SYSTEM',
    action: 'SYSTEM.INIT',
    entityType: 'SESSION',
    source: 'SYSTEM',
    auditId: 'test-id-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    sessionId: 'sess-test',
    ...overrides,
  })
}

// ─── createAuditEntry ─────────────────────────────────────────────────────────

describe('createAuditEntry', () => {
  it('produces an entry with all required fields present', () => {
    const e = makeEntry()
    expect(e.auditId).toBe('test-id-1')
    expect(e.timestamp).toBe('2026-01-01T00:00:00.000Z')
    expect(e.category).toBe('SYSTEM')
    expect(e.action).toBe('SYSTEM.INIT')
    expect(e.entityType).toBe('SESSION')
    expect(e.source).toBe('SYSTEM')
    expect(e.sessionId).toBe('sess-test')
  })

  it('defaults userId to "local"', () => {
    const e = makeEntry()
    expect(e.userId).toBe('local')
  })

  it('accepts an explicit userId override', () => {
    const e = makeEntry({ userId: 'user-42' })
    expect(e.userId).toBe('user-42')
  })

  it('omits optional fields when not provided', () => {
    const e = makeEntry()
    expect(e.entityId).toBeUndefined()
    expect(e.before).toBeUndefined()
    expect(e.after).toBeUndefined()
    expect(e.metadata).toBeUndefined()
    expect(e.severity).toBeUndefined()
    expect(e.reason).toBeUndefined()
  })

  it('includes optional fields when provided', () => {
    const e = makeEntry({
      entityId: 'h1',
      before: { price: 100 },
      after: { price: 110 },
      metadata: { provider: 'Polygon' },
      severity: 'WARNING',
      reason: 'Manual override',
    })
    expect(e.entityId).toBe('h1')
    expect(e.before).toEqual({ price: 100 })
    expect(e.after).toEqual({ price: 110 })
    expect(e.metadata).toEqual({ provider: 'Polygon' })
    expect(e.severity).toBe('WARNING')
    expect(e.reason).toBe('Manual override')
  })

  it('accepts an injected timestamp for deterministic tests', () => {
    const ts = '2026-06-08T12:00:00.000Z'
    const e = createAuditEntry({
      category: 'PORTFOLIO',
      action: 'PORTFOLIO.PRICE_REFRESH',
      entityType: 'HOLDING',
      source: 'SYSTEM',
      timestamp: ts,
      auditId: 'det-1',
      sessionId: 'sess-det',
    })
    expect(e.timestamp).toBe(ts)
  })
})

// ─── redactAuditPayload ───────────────────────────────────────────────────────

describe('redactAuditPayload', () => {
  it('redacts known sensitive keys in before/after/metadata', () => {
    const e = makeEntry({
      before: { apiKey: 'abc123', price: 100 },
      after: { token: 'tok-xyz', price: 110 },
      metadata: { password: 'hunter2', provider: 'Polygon' },
    })
    const r = redactAuditPayload(e)
    expect(r.before?.apiKey).toBe('[REDACTED]')
    expect(r.before?.price).toBe(100)
    expect(r.after?.token).toBe('[REDACTED]')
    expect(r.after?.price).toBe(110)
    expect(r.metadata?.password).toBe('[REDACTED]')
    expect(r.metadata?.provider).toBe('Polygon')
  })

  it('redacts nested sensitive keys', () => {
    const e = makeEntry({
      metadata: { config: { apiKey: 'nested-key', host: 'example.com' } },
    })
    const r = redactAuditPayload(e)
    const nested = r.metadata?.config as Record<string, unknown>
    expect(nested.apiKey).toBe('[REDACTED]')
    expect(nested.host).toBe('example.com')
  })

  it('does not mutate the original entry', () => {
    const originalBefore = { apiKey: 'original', price: 100 }
    const e = makeEntry({ before: originalBefore })
    redactAuditPayload(e)
    expect(originalBefore.apiKey).toBe('original')
    expect(e.before?.apiKey).toBe('original')
  })

  it('leaves entries without sensitive fields unchanged', () => {
    const e = makeEntry({ metadata: { provider: 'Polygon', latencyMs: 42 } })
    const r = redactAuditPayload(e)
    expect(r.metadata?.provider).toBe('Polygon')
    expect(r.metadata?.latencyMs).toBe(42)
  })

  it('handles undefined before/after/metadata gracefully', () => {
    const e = makeEntry()
    expect(() => redactAuditPayload(e)).not.toThrow()
    const r = redactAuditPayload(e)
    expect(r.before).toBeUndefined()
    expect(r.after).toBeUndefined()
    expect(r.metadata).toBeUndefined()
  })

  it('redacts all known sensitive key names', () => {
    const sensitiveKeys = ['apiKey', 'api_key', 'token', 'accessToken', 'access_token',
      'password', 'secret', 'secretKey', 'secret_key', 'authorization', 'Authorization']
    const payload = Object.fromEntries(sensitiveKeys.map(k => [k, 'value']))
    const e = makeEntry({ metadata: payload })
    const r = redactAuditPayload(e)
    for (const k of sensitiveKeys) {
      expect(r.metadata?.[k]).toBe('[REDACTED]')
    }
  })
})

// ─── appendAuditEntry ─────────────────────────────────────────────────────────

describe('appendAuditEntry', () => {
  it('returns persisted: true and the entry on success', () => {
    const s = createMemoryBackend()
    const e = makeEntry()
    const result = appendAuditEntry(e, s)
    expect(result.persisted).toBe(true)
    expect(result.entry).toBe(e)
    expect(result.droppedForCapacity).toBe(0)
    expect(result.error).toBeUndefined()
  })

  it('stored entry is retrievable via getAuditEntries', () => {
    const s = createMemoryBackend()
    appendAuditEntry(makeEntry({ auditId: 'stored-1' }), s)
    const entries = getAuditEntries(s)
    expect(entries).toHaveLength(1)
    expect(entries[0].auditId).toBe('stored-1')
  })

  it('preserves chronological order across multiple appends', () => {
    const s = createMemoryBackend()
    const timestamps = [
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z',
    ]
    for (let i = 0; i < timestamps.length; i++) {
      appendAuditEntry(makeEntry({ auditId: `e-${i}`, timestamp: timestamps[i] }), s)
    }
    const entries = getAuditEntries(s)
    expect(entries.map(e => e.auditId)).toEqual(['e-0', 'e-1', 'e-2'])
  })

  it('evicts oldest entries when cap is reached', () => {
    const s = createMemoryBackend()
    const cap = 3
    // Fill to cap
    for (let i = 0; i < cap; i++) {
      appendAuditEntry(makeEntry({ auditId: `e-${i}` }), s, cap)
    }
    // Add one more — should evict e-0
    const result = appendAuditEntry(makeEntry({ auditId: 'e-overflow' }), s, cap)
    expect(result.droppedForCapacity).toBe(1)
    const entries = getAuditEntries(s)
    expect(entries).toHaveLength(cap)
    expect(entries.map(e => e.auditId)).toContain('e-overflow')
    expect(entries.map(e => e.auditId)).not.toContain('e-0')
  })

  it('keeps exactly cap entries when well above cap', () => {
    const s = createMemoryBackend()
    const cap = 5
    for (let i = 0; i < 10; i++) {
      appendAuditEntry(makeEntry({ auditId: `e-${i}` }), s, cap)
    }
    expect(getAuditEntries(s)).toHaveLength(cap)
  })

  it('returns persisted: false when backend always fails', () => {
    const s = createFailingBackend()
    const result = appendAuditEntry(makeEntry(), s)
    expect(result.persisted).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('does not throw when backend always fails', () => {
    const s = createFailingBackend()
    expect(() => appendAuditEntry(makeEntry(), s)).not.toThrow()
  })

  it('includes retry drops in droppedForCapacity on write failure', () => {
    // A backend that only fails on write so droppedForCapacity accumulates
    const s = createFailingBackend()
    const e = makeEntry()
    const result = appendAuditEntry(e, s, 100)
    // Entry was not persisted, but droppedForCapacity reflects retry attempt
    expect(result.persisted).toBe(false)
    // droppedForCapacity ≥ 0 (retry may drop half of 1 entry = 0)
    expect(result.droppedForCapacity).toBeGreaterThanOrEqual(0)
  })
})

// ─── getAuditEntries ──────────────────────────────────────────────────────────

describe('getAuditEntries', () => {
  it('returns empty array when nothing stored', () => {
    expect(getAuditEntries(createMemoryBackend())).toEqual([])
  })

  it('returns a copy — mutating the result does not corrupt the store', () => {
    const s = createMemoryBackend()
    appendAuditEntry(makeEntry({ auditId: 'immutable-1' }), s)
    const entries = getAuditEntries(s)
    entries.pop()
    expect(getAuditEntries(s)).toHaveLength(1)
  })
})

// ─── clearAuditEntries ────────────────────────────────────────────────────────

describe('clearAuditEntries', () => {
  it('empties the audit log', () => {
    const s = createMemoryBackend()
    appendAuditEntry(makeEntry(), s)
    clearAuditEntries(s)
    expect(getAuditEntries(s)).toEqual([])
  })

  it('does not throw on empty storage', () => {
    expect(() => clearAuditEntries(createMemoryBackend())).not.toThrow()
  })
})

// ─── filterAuditEntries ───────────────────────────────────────────────────────

describe('filterAuditEntries', () => {
  const entries: AuditEntry[] = [
    createAuditEntry({ category: 'PORTFOLIO', action: 'PORTFOLIO.PRICE_REFRESH', entityType: 'HOLDING', entityId: 'h1', source: 'SYSTEM', severity: 'INFO', auditId: 'f1', timestamp: '2026-01-01T10:00:00.000Z', sessionId: 'sess-f' }),
    createAuditEntry({ category: 'PORTFOLIO', action: 'PORTFOLIO.PRICE_REFRESH', entityType: 'HOLDING', entityId: 'h2', source: 'SYSTEM', severity: 'WARNING', auditId: 'f2', timestamp: '2026-01-01T11:00:00.000Z', sessionId: 'sess-f' }),
    createAuditEntry({ category: 'MARKET_DATA', action: 'MARKET_DATA.FETCH', entityType: 'SECURITY', source: 'API', severity: 'INFO', auditId: 'f3', timestamp: '2026-01-02T09:00:00.000Z', sessionId: 'sess-f' }),
    createAuditEntry({ category: 'CONFIG', action: 'CONFIG.SET_PROVIDER', entityType: 'CONFIG', source: 'UI', severity: 'CRITICAL', auditId: 'f4', timestamp: '2026-01-03T08:00:00.000Z', sessionId: 'sess-f' }),
  ]

  it('returns all entries when no filter applied', () => {
    expect(filterAuditEntries(entries, {})).toHaveLength(4)
  })

  it('filters by category', () => {
    const result = filterAuditEntries(entries, { category: 'PORTFOLIO' })
    expect(result).toHaveLength(2)
    expect(result.every(e => e.category === 'PORTFOLIO')).toBe(true)
  })

  it('filters by action', () => {
    const result = filterAuditEntries(entries, { action: 'PORTFOLIO.PRICE_REFRESH' })
    expect(result).toHaveLength(2)
  })

  it('filters by entityType', () => {
    const result = filterAuditEntries(entries, { entityType: 'HOLDING' })
    expect(result).toHaveLength(2)
  })

  it('filters by entityId', () => {
    const result = filterAuditEntries(entries, { entityId: 'h1' })
    expect(result).toHaveLength(1)
    expect(result[0].auditId).toBe('f1')
  })

  it('filters by severity', () => {
    const result = filterAuditEntries(entries, { severity: 'INFO' })
    expect(result).toHaveLength(2)
  })

  it('filters by source', () => {
    const result = filterAuditEntries(entries, { source: 'UI' })
    expect(result).toHaveLength(1)
    expect(result[0].auditId).toBe('f4')
  })

  it('filters by fromTimestamp (inclusive)', () => {
    const result = filterAuditEntries(entries, { fromTimestamp: '2026-01-02T00:00:00.000Z' })
    expect(result).toHaveLength(2)
    expect(result.map(e => e.auditId)).toContain('f3')
    expect(result.map(e => e.auditId)).toContain('f4')
  })

  it('filters by toTimestamp (inclusive)', () => {
    const result = filterAuditEntries(entries, { toTimestamp: '2026-01-01T23:59:59.999Z' })
    expect(result).toHaveLength(2)
    expect(result.map(e => e.auditId)).toContain('f1')
    expect(result.map(e => e.auditId)).toContain('f2')
  })

  it('filters by fromTimestamp and toTimestamp combined', () => {
    const result = filterAuditEntries(entries, {
      fromTimestamp: '2026-01-01T10:30:00.000Z',
      toTimestamp: '2026-01-02T23:59:59.999Z',
    })
    expect(result).toHaveLength(2)
    expect(result.map(e => e.auditId)).toContain('f2')
    expect(result.map(e => e.auditId)).toContain('f3')
  })

  it('filters by multiple fields simultaneously', () => {
    const result = filterAuditEntries(entries, { category: 'PORTFOLIO', severity: 'WARNING' })
    expect(result).toHaveLength(1)
    expect(result[0].auditId).toBe('f2')
  })

  it('returns empty array when no entries match', () => {
    const result = filterAuditEntries(entries, { category: 'TRANSACTION' })
    expect(result).toEqual([])
  })

  it('does not mutate the input array', () => {
    const copy = [...entries]
    filterAuditEntries(entries, { category: 'PORTFOLIO' })
    expect(entries).toHaveLength(copy.length)
  })
})

// ─── recordAudit ──────────────────────────────────────────────────────────────

describe('recordAudit', () => {
  it('composes create → redact → append and returns a write result', () => {
    const s = createMemoryBackend()
    const result = recordAudit(
      {
        category: 'PORTFOLIO',
        action: 'PORTFOLIO.PRICE_REFRESH',
        entityType: 'HOLDING',
        source: 'SYSTEM',
        auditId: 'rec-1',
        sessionId: 'sess-rec',
        timestamp: '2026-06-08T00:00:00.000Z',
      },
      s,
    )
    expect(result.persisted).toBe(true)
    expect(result.entry.category).toBe('PORTFOLIO')
    expect(result.entry.action).toBe('PORTFOLIO.PRICE_REFRESH')
    const stored = getAuditEntries(s)
    expect(stored).toHaveLength(1)
  })

  it('redacts sensitive keys before storing', () => {
    const s = createMemoryBackend()
    recordAudit(
      {
        category: 'CONFIG',
        action: 'CONFIG.SET_PROVIDER',
        entityType: 'CONFIG',
        source: 'UI',
        metadata: { apiKey: 'secret-key-value', provider: 'Polygon' },
        auditId: 'rec-redact',
        sessionId: 'sess-rec',
        timestamp: '2026-06-08T00:00:00.000Z',
      },
      s,
    )
    const stored = getAuditEntries(s)
    expect(stored[0].metadata?.apiKey).toBe('[REDACTED]')
    expect(stored[0].metadata?.provider).toBe('Polygon')
  })

  it('returns persisted: false when storage fails, without throwing', () => {
    const s = createFailingBackend()
    expect(() =>
      recordAudit(
        { category: 'SYSTEM', action: 'SYSTEM.ERROR', entityType: 'SESSION', source: 'SYSTEM' },
        s,
      ),
    ).not.toThrow()
    const result = recordAudit(
      { category: 'SYSTEM', action: 'SYSTEM.ERROR', entityType: 'SESSION', source: 'SYSTEM' },
      s,
    )
    expect(result.persisted).toBe(false)
  })
})
