import { describe, it, expect } from 'vitest'
import { attachSecurityIdentity } from './securityIdentity'

// Tests rely on the seeded security master from Phase 0C.
// AAPL → RESOLVED (US:AAPL, unambiguous root)
// RY   → AMBIGUOUS (US:RY + CA:RY.TO share root)
// RY.TO → RESOLVED (fully-qualified Canadian symbol)
// ZZZNOTAREAL → UNKNOWN

describe('attachSecurityIdentity — RESOLVED', () => {
  it('returns RESOLVED status for unambiguous US symbol', () => {
    const r = attachSecurityIdentity('AAPL')
    expect(r.status).toBe('RESOLVED')
  })

  it('returns securityId on RESOLVED', () => {
    const r = attachSecurityIdentity('AAPL')
    expect(r.securityId).toBe('US:AAPL')
  })

  it('returns symbol and displaySymbol on RESOLVED', () => {
    const r = attachSecurityIdentity('AAPL')
    expect(r.symbol).toBe('AAPL')
    expect(r.displaySymbol).toBe('AAPL')
  })

  it('returns currency on RESOLVED', () => {
    const r = attachSecurityIdentity('AAPL')
    expect(r.currency).toBe('USD')
  })

  it('resolves fully-qualified Canadian symbol RY.TO directly', () => {
    const r = attachSecurityIdentity('RY.TO')
    expect(r.status).toBe('RESOLVED')
    expect(r.securityId).toBe('CA:RY.TO')
    expect(r.currency).toBe('CAD')
  })

  it('resolves MSFT to US:MSFT', () => {
    const r = attachSecurityIdentity('MSFT')
    expect(r.status).toBe('RESOLVED')
    expect(r.securityId).toBe('US:MSFT')
  })
})

describe('attachSecurityIdentity — AMBIGUOUS', () => {
  it('returns AMBIGUOUS status for bare RY (US:RY and CA:RY.TO share root)', () => {
    const r = attachSecurityIdentity('RY')
    expect(r.status).toBe('AMBIGUOUS')
  })

  it('returns candidates on AMBIGUOUS', () => {
    const r = attachSecurityIdentity('RY')
    expect(r.candidates).toBeDefined()
    expect(r.candidates!.length).toBeGreaterThanOrEqual(2)
  })

  it('each candidate has securityId, symbol, displaySymbol, name', () => {
    const r = attachSecurityIdentity('RY')
    for (const c of r.candidates!) {
      expect(c.securityId).toBeTruthy()
      expect(c.symbol).toBeTruthy()
      expect(c.displaySymbol).toBeTruthy()
      expect(c.name).toBeTruthy()
    }
  })

  it('returns no securityId on AMBIGUOUS', () => {
    const r = attachSecurityIdentity('RY')
    expect(r.securityId).toBeUndefined()
  })
})

describe('attachSecurityIdentity — UNKNOWN', () => {
  it('returns UNKNOWN status for a symbol not in the master', () => {
    const r = attachSecurityIdentity('ZZZNOTAREAL')
    expect(r.status).toBe('UNKNOWN')
  })

  it('returns no securityId on UNKNOWN', () => {
    const r = attachSecurityIdentity('ZZZNOTAREAL')
    expect(r.securityId).toBeUndefined()
  })

  it('returns no candidates on UNKNOWN', () => {
    const r = attachSecurityIdentity('ZZZNOTAREAL')
    expect(r.candidates).toBeUndefined()
  })
})
