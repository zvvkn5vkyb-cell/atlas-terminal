import { describe, it, expect } from 'vitest'
import { SECURITY_MASTER_SEED } from './securityMasterSeed'
import { resolveSecurity, detectAmbiguousSymbol } from './securityMaster'
import { isCanadianSymbol } from '@/services/market/canadianSymbol'
import type { AssetClass, SecurityType } from '@/types/security'
import { MOCK_HOLDINGS, MOCK_MOVERS_UP, MOCK_MOVERS_DOWN } from '@/lib/mockData'
import { BENCHMARK_SYMBOL, COMMAND_PALETTE_SYMBOLS } from '@/lib/constants'

const ALLOWED_ASSET_CLASSES: AssetClass[] = [
  'EQUITY', 'FIXED_INCOME', 'ETF', 'FUND', 'CASH', 'DERIVATIVE', 'INDEX', 'COMMODITY', 'FX', 'OTHER',
]
const ALLOWED_SECURITY_TYPES: SecurityType[] = [
  'COMMON_STOCK', 'PREFERRED_STOCK', 'ADR', 'ETF', 'MUTUAL_FUND', 'INDEX', 'BOND', 'OPTION', 'FUTURE', 'CASH', 'OTHER',
]
const KNOWN_CURRENCIES = new Set(['USD', 'CAD'])

describe('security master seed — uniqueness', () => {
  it('has unique securityIds', () => {
    const ids = SECURITY_MASTER_SEED.map(s => s.securityId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has unique symbols', () => {
    const symbols = SECURITY_MASTER_SEED.map(s => s.symbol)
    expect(new Set(symbols).size).toBe(symbols.length)
  })

  it('has unique aliases that do not collide with any symbol', () => {
    const symbols = new Set(SECURITY_MASTER_SEED.map(s => s.symbol.toUpperCase()))
    const aliases = SECURITY_MASTER_SEED.flatMap(s => s.aliases ?? []).map(a => a.toUpperCase())
    expect(new Set(aliases).size).toBe(aliases.length)
    for (const alias of aliases) {
      expect(symbols.has(alias)).toBe(false)
    }
  })
})

describe('security master seed — field invariants', () => {
  it('every record has non-empty displaySymbol and name', () => {
    for (const s of SECURITY_MASTER_SEED) {
      expect(s.displaySymbol.length).toBeGreaterThan(0)
      expect(s.name.length).toBeGreaterThan(0)
    }
  })

  it('every record uses a valid assetClass, securityType and known currency', () => {
    for (const s of SECURITY_MASTER_SEED) {
      expect(ALLOWED_ASSET_CLASSES).toContain(s.assetClass)
      expect(ALLOWED_SECURITY_TYPES).toContain(s.securityType)
      expect(KNOWN_CURRENCIES.has(s.currency)).toBe(true)
    }
  })

  it('Canadian-suffixed symbols are CAD on TSX/TSXV in country CA', () => {
    for (const s of SECURITY_MASTER_SEED) {
      if (isCanadianSymbol(s.symbol)) {
        expect(s.country).toBe('CA')
        expect(s.currency).toBe('CAD')
        expect(['TSX', 'TSXV']).toContain(s.exchange)
      }
    }
  })

  it('U.S. listings are USD in country US', () => {
    for (const s of SECURITY_MASTER_SEED) {
      if (s.country === 'US') expect(s.currency).toBe('USD')
    }
  })

  it('does not classify the seeded U.S. Canadian-bank/energy names as ADR', () => {
    for (const sym of ['RY', 'TD']) {
      const s = SECURITY_MASTER_SEED.find(x => x.symbol === sym)
      expect(s?.securityType).toBe('COMMON_STOCK')
    }
  })

  it('indices are active but not tradable', () => {
    const indices = SECURITY_MASTER_SEED.filter(s => s.securityType === 'INDEX')
    expect(indices.length).toBeGreaterThan(0)
    for (const s of indices) {
      expect(s.isActive).toBe(true)
      expect(s.isTradable).toBe(false)
    }
  })
})

describe('security master seed — coverage of referenced symbols', () => {
  const expectResolves = (symbol: string) => {
    const res = resolveSecurity(symbol)
    expect(res.status, `${symbol} should resolve`).toBe('RESOLVED')
  }

  it('covers all mock holdings', () => {
    for (const h of MOCK_HOLDINGS) expectResolves(h.symbol)
  })

  it('covers the benchmark symbol', () => {
    expectResolves(BENCHMARK_SYMBOL)
  })

  it('covers all movers', () => {
    for (const m of [...MOCK_MOVERS_UP, ...MOCK_MOVERS_DOWN]) expectResolves(m.symbol)
  })

  it('covers default recent symbols', () => {
    for (const sym of ['AAPL', 'MSFT', 'SPY']) expectResolves(sym)
  })

  it('covers command-palette symbols', () => {
    for (const sym of COMMAND_PALETTE_SYMBOLS) expectResolves(sym)
  })
})

describe('security master seed — deliberate ambiguity collisions', () => {
  it('seeds RY as both a U.S. and Canadian listing', () => {
    expect(detectAmbiguousSymbol('RY').length).toBeGreaterThanOrEqual(2)
  })

  it('seeds TD as both a U.S. and Canadian listing', () => {
    expect(detectAmbiguousSymbol('TD').length).toBeGreaterThanOrEqual(2)
  })
})
