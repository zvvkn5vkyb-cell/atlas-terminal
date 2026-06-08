import { describe, it, expect } from 'vitest'
import {
  createMemoryBackend,
  createFailingBackend,
  readEnvelope,
  writeEnvelope,
} from './auditStorage'
import type { AuditLogEnvelope } from '@/types/audit'
import { AUDIT_SCHEMA_VERSION } from './constants'

// ─── Memory backend ────────────────────────────────────────────────────────────

describe('createMemoryBackend', () => {
  it('read returns null before any write', () => {
    const s = createMemoryBackend()
    expect(s.read()).toBeNull()
  })

  it('write returns true and read returns the stored value', () => {
    const s = createMemoryBackend()
    expect(s.write('hello')).toBe(true)
    expect(s.read()).toBe('hello')
  })

  it('remove clears stored value', () => {
    const s = createMemoryBackend()
    s.write('data')
    s.remove()
    expect(s.read()).toBeNull()
  })

  it('successive writes overwrite the previous value', () => {
    const s = createMemoryBackend()
    s.write('first')
    s.write('second')
    expect(s.read()).toBe('second')
  })
})

// ─── Failing backend ──────────────────────────────────────────────────────────

describe('createFailingBackend', () => {
  it('read always returns null', () => {
    expect(createFailingBackend().read()).toBeNull()
  })

  it('write always returns false', () => {
    expect(createFailingBackend().write('anything')).toBe(false)
  })

  it('remove does not throw', () => {
    expect(() => createFailingBackend().remove()).not.toThrow()
  })
})

// ─── readEnvelope ─────────────────────────────────────────────────────────────

describe('readEnvelope', () => {
  it('returns empty envelope when storage is empty', () => {
    const s = createMemoryBackend()
    const env = readEnvelope(s)
    expect(env.entries).toEqual([])
    expect(env.schemaVersion).toBe(AUDIT_SCHEMA_VERSION)
  })

  it('returns stored entries when storage holds a valid envelope', () => {
    const s = createMemoryBackend()
    const envelope: AuditLogEnvelope = {
      schemaVersion: AUDIT_SCHEMA_VERSION,
      entries: [
        {
          auditId: 'a1',
          timestamp: '2026-01-01T00:00:00.000Z',
          category: 'SYSTEM',
          action: 'SYSTEM.INIT',
          entityType: 'SESSION',
          userId: 'local',
          sessionId: 'sess-1',
          source: 'SYSTEM',
        },
      ],
    }
    s.write(JSON.stringify(envelope))
    const result = readEnvelope(s)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].auditId).toBe('a1')
  })

  it('returns empty envelope and removes corrupt JSON', () => {
    const s = createMemoryBackend()
    s.write('{not valid json{{')
    const result = readEnvelope(s)
    expect(result.entries).toEqual([])
    // Storage should have been cleared
    expect(s.read()).toBeNull()
  })

  it('returns empty envelope when parsed value is not an object', () => {
    const s = createMemoryBackend()
    s.write(JSON.stringify(42))
    const result = readEnvelope(s)
    expect(result.entries).toEqual([])
    expect(s.read()).toBeNull()
  })

  it('returns empty envelope when entries field is missing', () => {
    const s = createMemoryBackend()
    s.write(JSON.stringify({ schemaVersion: 1 }))
    const result = readEnvelope(s)
    expect(result.entries).toEqual([])
    expect(s.read()).toBeNull()
  })

  it('falls back to current schema version when schemaVersion is missing', () => {
    const s = createMemoryBackend()
    s.write(JSON.stringify({ entries: [] }))
    const result = readEnvelope(s)
    expect(result.schemaVersion).toBe(AUDIT_SCHEMA_VERSION)
  })
})

// ─── writeEnvelope ────────────────────────────────────────────────────────────

describe('writeEnvelope', () => {
  it('returns true and persists data to a working backend', () => {
    const s = createMemoryBackend()
    const env: AuditLogEnvelope = { schemaVersion: AUDIT_SCHEMA_VERSION, entries: [] }
    expect(writeEnvelope(s, env)).toBe(true)
    expect(s.read()).not.toBeNull()
  })

  it('returns false when the backend fails', () => {
    const s = createFailingBackend()
    const env: AuditLogEnvelope = { schemaVersion: AUDIT_SCHEMA_VERSION, entries: [] }
    expect(writeEnvelope(s, env)).toBe(false)
  })

  it('round-trips through readEnvelope', () => {
    const s = createMemoryBackend()
    const env: AuditLogEnvelope = {
      schemaVersion: AUDIT_SCHEMA_VERSION,
      entries: [
        {
          auditId: 'rt-1',
          timestamp: '2026-01-01T00:00:00.000Z',
          category: 'CONFIG',
          action: 'CONFIG.UPDATE',
          entityType: 'CONFIG',
          userId: 'local',
          sessionId: 'sess-rt',
          source: 'UI',
        },
      ],
    }
    writeEnvelope(s, env)
    const result = readEnvelope(s)
    expect(result.entries[0].auditId).toBe('rt-1')
  })
})
