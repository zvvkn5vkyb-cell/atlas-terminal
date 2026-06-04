import { describe, it, expect } from 'vitest'
import {
  getAllSecurities,
  getSecurityById,
  getSecurityBySymbol,
  getSecurityByExactSymbol,
  resolveSecurity,
  detectAmbiguousSymbol,
  searchSecurities,
  getSecurityDisplayName,
  getSecurityCurrency,
  getSecurityExchange,
} from './securityMaster'

describe('getSecurityById', () => {
  it('returns the security for a known id', () => {
    expect(getSecurityById('US:AAPL')?.symbol).toBe('AAPL')
    expect(getSecurityById('CA:RY.TO')?.country).toBe('CA')
  })

  it('returns undefined for an unknown id', () => {
    expect(getSecurityById('XX:NOPE')).toBeUndefined()
  })

  it('treats ids as opaque/case-sensitive', () => {
    expect(getSecurityById('us:aapl')).toBeUndefined()
  })
})

// ─── Exact-lookup vs safe-resolution lockdown ─────────────────────────────────
// These tests document and enforce the distinction that must hold for all future
// phases. Any user-originated input (command palette, import, ledger entry) MUST
// go through resolveSecurity(). Exact lookup is only for already-canonical,
// trusted/internal symbols.
describe('exact-lookup vs safe-resolution — lockdown', () => {
  it('getSecurityByExactSymbol("RY") resolves the U.S. listing directly', () => {
    expect(getSecurityByExactSymbol('RY')?.securityId).toBe('US:RY')
  })

  it('getSecurityBySymbol("RY") also resolves the U.S. listing (exact alias)', () => {
    expect(getSecurityBySymbol('RY')?.securityId).toBe('US:RY')
  })

  it('resolveSecurity("RY") returns AMBIGUOUS — does not silently pick', () => {
    expect(resolveSecurity('RY').status).toBe('AMBIGUOUS')
  })

  it('resolveSecurity("RY.TO") returns RESOLVED to the Canadian listing', () => {
    const res = resolveSecurity('RY.TO')
    expect(res.status).toBe('RESOLVED')
    if (res.status === 'RESOLVED') expect(res.security.securityId).toBe('CA:RY.TO')
  })

  it('getSecurityByExactSymbol and getSecurityBySymbol return the same result (delegation)', () => {
    for (const sym of ['AAPL', 'RY.TO', 'RY', 'SPY', 'TD', '   ', 'ZZZZ']) {
      expect(getSecurityByExactSymbol(sym)).toBe(getSecurityBySymbol(sym))
    }
  })
})

describe('getSecurityBySymbol', () => {
  it('resolves an exact U.S. symbol', () => {
    expect(getSecurityBySymbol('AAPL')?.securityId).toBe('US:AAPL')
  })

  it('resolves an exact Canadian symbol', () => {
    expect(getSecurityBySymbol('RY.TO')?.securityId).toBe('CA:RY.TO')
  })

  it('normalizes case and whitespace', () => {
    expect(getSecurityBySymbol('  aapl ')?.securityId).toBe('US:AAPL')
    expect(getSecurityBySymbol('ry.to')?.securityId).toBe('CA:RY.TO')
  })

  it('folds alternate Canadian suffixes to canonical form', () => {
    expect(getSecurityBySymbol('RY.TSX')?.securityId).toBe('CA:RY.TO')
  })

  it('is literal: bare "RY" returns the U.S. listing (not ambiguity)', () => {
    expect(getSecurityBySymbol('RY')?.securityId).toBe('US:RY')
  })

  it('does NOT match aliases (exact symbol only)', () => {
    expect(getSecurityBySymbol('FB')).toBeUndefined()
  })

  it('returns undefined for unknown and empty input', () => {
    expect(getSecurityBySymbol('NOPE')).toBeUndefined()
    expect(getSecurityBySymbol('   ')).toBeUndefined()
  })
})

describe('resolveSecurity — backward-compatible resolution', () => {
  it('resolves an unambiguous U.S. symbol', () => {
    const res = resolveSecurity('AAPL')
    expect(res.status).toBe('RESOLVED')
    if (res.status === 'RESOLVED') expect(res.security.securityId).toBe('US:AAPL')
  })

  it('resolves a fully-qualified Canadian symbol directly', () => {
    const res = resolveSecurity('RY.TO')
    expect(res.status).toBe('RESOLVED')
    if (res.status === 'RESOLVED') expect(res.security.securityId).toBe('CA:RY.TO')
  })

  it('resolves a bare root held by a single (Canadian-only) listing', () => {
    const res = resolveSecurity('ENB')
    expect(res.status).toBe('RESOLVED')
    if (res.status === 'RESOLVED') expect(res.security.securityId).toBe('CA:ENB.TO')
  })

  it('resolves via alias when no symbol/root matches', () => {
    const res = resolveSecurity('FB')
    expect(res.status).toBe('RESOLVED')
    if (res.status === 'RESOLVED') expect(res.security.securityId).toBe('US:META')
  })

  it('returns UNKNOWN for an unseeded symbol', () => {
    const res = resolveSecurity('ZZZZ')
    expect(res.status).toBe('UNKNOWN')
    if (res.status === 'UNKNOWN') expect(res.query).toBe('ZZZZ')
  })

  it('returns UNKNOWN for empty input', () => {
    expect(resolveSecurity('').status).toBe('UNKNOWN')
    expect(resolveSecurity('   ').status).toBe('UNKNOWN')
  })

  it('returns UNKNOWN for a Canadian-qualified symbol that is not seeded', () => {
    expect(resolveSecurity('ZZ.TO').status).toBe('UNKNOWN')
  })
})

describe('resolveSecurity / detectAmbiguousSymbol — ambiguity', () => {
  it('flags bare "RY" as AMBIGUOUS and does not silently resolve', () => {
    const res = resolveSecurity('RY')
    expect(res.status).toBe('AMBIGUOUS')
    if (res.status === 'AMBIGUOUS') {
      const ids = res.candidates.map(c => c.securityId)
      expect(ids).toContain('US:RY')
      expect(ids).toContain('CA:RY.TO')
      expect(res.candidates.length).toBe(2)
    }
  })

  it('flags bare "TD" as AMBIGUOUS', () => {
    expect(resolveSecurity('TD').status).toBe('AMBIGUOUS')
  })

  it('does NOT treat the qualified "RY.TO" as ambiguous', () => {
    expect(detectAmbiguousSymbol('RY.TO')).toEqual([])
    expect(resolveSecurity('RY.TO').status).toBe('RESOLVED')
  })

  it('detectAmbiguousSymbol returns candidates only when >1', () => {
    expect(detectAmbiguousSymbol('RY').length).toBe(2)
    expect(detectAmbiguousSymbol('AAPL')).toEqual([])
    expect(detectAmbiguousSymbol('ENB')).toEqual([])
    expect(detectAmbiguousSymbol('')).toEqual([])
  })

  it('returns candidates in a deterministic (securityId) order', () => {
    const candidates = detectAmbiguousSymbol('RY')
    expect(candidates.map(c => c.securityId)).toEqual(['CA:RY.TO', 'US:RY'])
  })
})

describe('searchSecurities', () => {
  it('ranks exact symbol match first', () => {
    expect(searchSecurities('AAPL')[0].securityId).toBe('US:AAPL')
  })

  it('matches by symbol prefix', () => {
    const ids = searchSecurities('TS').map(s => s.securityId)
    expect(ids).toContain('US:TSLA')
  })

  it('matches by name substring', () => {
    const ids = searchSecurities('Royal').map(s => s.securityId)
    expect(ids).toContain('US:RY')
    expect(ids).toContain('CA:RY.TO')
  })

  it('matches by alias', () => {
    expect(searchSecurities('FB').map(s => s.securityId)).toContain('US:META')
  })

  it('honors the limit and returns [] for empty query', () => {
    expect(searchSecurities('S', 3).length).toBeLessThanOrEqual(3)
    expect(searchSecurities('')).toEqual([])
    expect(searchSecurities('   ')).toEqual([])
  })

  it('returns [] when nothing matches', () => {
    expect(searchSecurities('ZZZZZZ')).toEqual([])
  })
})

describe('backward-compatible accessors', () => {
  it('getSecurityDisplayName returns the name, or the raw symbol when unknown', () => {
    expect(getSecurityDisplayName('AAPL')).toBe('Apple Inc.')
    expect(getSecurityDisplayName('RY.TO')).toBe('Royal Bank of Canada')
    expect(getSecurityDisplayName('ZZZZ')).toBe('ZZZZ')
  })

  it('getSecurityCurrency returns the currency or undefined', () => {
    expect(getSecurityCurrency('AAPL')).toBe('USD')
    expect(getSecurityCurrency('RY.TO')).toBe('CAD')
    expect(getSecurityCurrency('ZZZZ')).toBeUndefined()
  })

  it('getSecurityExchange returns the exchange or undefined', () => {
    expect(getSecurityExchange('AAPL')).toBe('NASDAQ')
    expect(getSecurityExchange('RY.TO')).toBe('TSX')
    expect(getSecurityExchange('ZZZZ')).toBeUndefined()
  })

  it('accessors never throw on garbage input', () => {
    expect(() => getSecurityDisplayName('')).not.toThrow()
    expect(() => getSecurityCurrency('!!!')).not.toThrow()
    expect(() => getSecurityExchange('   ')).not.toThrow()
  })
})

describe('getAllSecurities', () => {
  it('returns a copy of the seed (mutating the result does not affect the master)', () => {
    const all = getAllSecurities()
    const before = all.length
    all.pop()
    expect(getAllSecurities().length).toBe(before)
  })
})
