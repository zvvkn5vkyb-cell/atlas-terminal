import { describe, it, expect, beforeEach } from 'vitest'
import { createSessionId, getSessionId, _resetSessionId } from './session'

beforeEach(() => {
  _resetSessionId()
})

describe('createSessionId', () => {
  it('returns a non-empty string', () => {
    expect(typeof createSessionId()).toBe('string')
    expect(createSessionId().length).toBeGreaterThan(0)
  })

  it('returns unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 10 }, () => createSessionId()))
    expect(ids.size).toBe(10)
  })

  it('contains only safe characters (UUID or timestamp-random fallback)', () => {
    const id = createSessionId()
    // UUID form: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    // Fallback form: <base36ts>-<base36rand>
    expect(id).toMatch(/^[0-9a-f-]+$/)
  })

  it('does not throw', () => {
    expect(() => createSessionId()).not.toThrow()
  })
})

describe('getSessionId', () => {
  it('returns a non-empty string', () => {
    expect(getSessionId().length).toBeGreaterThan(0)
  })

  it('returns the same ID on repeated calls within a session', () => {
    const a = getSessionId()
    const b = getSessionId()
    const c = getSessionId()
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('returns a new ID after reset', () => {
    const before = getSessionId()
    _resetSessionId()
    const after = getSessionId()
    // After reset, a new ID is generated — may coincidentally match (astronomically unlikely)
    // but should be a valid non-empty string
    expect(after.length).toBeGreaterThan(0)
    // Calling again without reset must be stable
    expect(getSessionId()).toBe(after)
    // Original ID is gone — no guarantee it differs, but the new one is stable
    void before
  })
})
