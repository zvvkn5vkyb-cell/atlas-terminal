import { describe, it, expect } from 'vitest'
import {
  classifySource,
  applyQuoteToHolding,
  normalizeWeights,
  computeRefreshedState,
  computeSummary,
  buildPriceRefreshAuditParams,
  DEFAULT_PORTFOLIO_ID,
} from './portfolioRefresh'
import type { Quote } from '@/types/market'
import type { Holding, CashPosition } from '@/types/portfolio'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 150,
    change: 2,
    changePct: 1.35,
    volume: 50_000_000,
    currency: 'USD',
    exchange: 'Polygon.io',
    lastUpdated: '2024-01-15T16:00:00.000Z',
    trustMode: 'TRUSTED',
    ...overrides,
  }
}

function makeHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: 'h1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Technology',
    assetClass: 'EQUITY',
    shares: 100,
    costBasis: 130,
    currentPrice: 130,
    currentValue: 13_000,
    unrealizedPnL: 0,
    unrealizedPnLPct: 0,
    dayChange: 0,
    dayChangePct: 0,
    weight: 1,
    trustMode: 'TRUSTED',
    ...overrides,
  }
}

const NO_CASH: CashPosition[] = []

// ─── classifySource ───────────────────────────────────────────────────────────

describe('classifySource', () => {
  it('returns LIVE for trusted Polygon quote', () => {
    const quote = makeQuote({ trustMode: 'TRUSTED', exchange: 'Polygon.io' })
    expect(classifySource('AAPL', quote)).toBe('LIVE')
  })

  it('returns LIVE for MSFT trusted Polygon quote', () => {
    const quote = makeQuote({ symbol: 'MSFT', trustMode: 'TRUSTED', exchange: 'Polygon.io' })
    expect(classifySource('MSFT', quote)).toBe('LIVE')
  })

  it('returns CANADA for .TO symbol regardless of trustMode', () => {
    const quote = makeQuote({ trustMode: 'DEGRADED', exchange: 'Canadian market provider not configured' })
    expect(classifySource('RY.TO', quote)).toBe('CANADA')
  })

  it('returns CANADA for .TSX symbol', () => {
    const quote = makeQuote({ trustMode: 'DEGRADED', exchange: 'Canadian market provider not configured' })
    expect(classifySource('SU.TSX', quote)).toBe('CANADA')
  })

  it('returns CANADA for .V symbol', () => {
    const quote = makeQuote({ trustMode: 'DEGRADED', exchange: 'Canadian market provider not configured' })
    expect(classifySource('ABC.V', quote)).toBe('CANADA')
  })

  it('CANADA takes priority over LIVE for Canadian symbol with trusted quote', () => {
    // Canadian regex match wins over LIVE classification
    const quote = makeQuote({ trustMode: 'TRUSTED', exchange: 'Polygon.io' })
    expect(classifySource('TD.TO', quote)).toBe('CANADA')
  })

  it('returns FALLBACK for degraded non-Canadian quote', () => {
    const quote = makeQuote({ trustMode: 'DEGRADED', exchange: 'MockMarketDataProvider' })
    expect(classifySource('AAPL', quote)).toBe('FALLBACK')
  })

  it('returns MOCK for non-degraded non-Polygon non-Canadian quote', () => {
    const quote = makeQuote({ trustMode: 'TRUSTED', exchange: 'MockMarketDataProvider' })
    expect(classifySource('AAPL', quote)).toBe('MOCK')
  })

  it('returns MOCK when trustMode is INSUFFICIENT_DATA', () => {
    const quote = makeQuote({ trustMode: 'INSUFFICIENT_DATA', exchange: 'some-source' })
    expect(classifySource('AAPL', quote)).toBe('MOCK')
  })

  it('is case-insensitive for Canadian suffix', () => {
    const quote = makeQuote({ trustMode: 'DEGRADED', exchange: 'n/a' })
    expect(classifySource('RY.to', quote)).toBe('CANADA')
    expect(classifySource('RY.To', quote)).toBe('CANADA')
  })
})

// ─── applyQuoteToHolding — LIVE ───────────────────────────────────────────────

describe('applyQuoteToHolding — LIVE source', () => {
  it('updates currentPrice from quote', () => {
    const h = makeHolding({ shares: 100, costBasis: 130, currentPrice: 130 })
    const q = makeQuote({ price: 175, change: 3, changePct: 1.74 })
    const result = applyQuoteToHolding(h, q, 'LIVE')
    expect(result.currentPrice).toBe(175)
  })

  it('updates currentValue = price × shares', () => {
    const h = makeHolding({ shares: 200, costBasis: 100 })
    const q = makeQuote({ price: 160 })
    const result = applyQuoteToHolding(h, q, 'LIVE')
    expect(result.currentValue).toBe(32_000)
  })

  it('updates unrealizedPnL = (price - costBasis) × shares', () => {
    const h = makeHolding({ shares: 50, costBasis: 100 })
    const q = makeQuote({ price: 120 })
    const result = applyQuoteToHolding(h, q, 'LIVE')
    expect(result.unrealizedPnL).toBe(1_000) // (120 - 100) × 50
  })

  it('updates unrealizedPnLPct correctly', () => {
    const h = makeHolding({ shares: 50, costBasis: 100 })
    const q = makeQuote({ price: 120 })
    const result = applyQuoteToHolding(h, q, 'LIVE')
    expect(result.unrealizedPnLPct).toBeCloseTo(0.2) // 20%
  })

  it('updates dayChange = quote.change × shares', () => {
    const h = makeHolding({ shares: 100 })
    const q = makeQuote({ change: 3.5, changePct: 2.1 })
    const result = applyQuoteToHolding(h, q, 'LIVE')
    expect(result.dayChange).toBe(350)
  })

  it('updates dayChangePct from quote', () => {
    const h = makeHolding({ shares: 100 })
    const q = makeQuote({ change: 3.5, changePct: 2.1 })
    const result = applyQuoteToHolding(h, q, 'LIVE')
    expect(result.dayChangePct).toBe(2.1)
  })

  it('sets trustMode to TRUSTED', () => {
    const h = makeHolding({ trustMode: 'DEGRADED' })
    const q = makeQuote({ trustMode: 'TRUSTED' })
    const result = applyQuoteToHolding(h, q, 'LIVE')
    expect(result.trustMode).toBe('TRUSTED')
  })

  it('handles zero costBasis without division error', () => {
    const h = makeHolding({ shares: 100, costBasis: 0 })
    const q = makeQuote({ price: 100 })
    const result = applyQuoteToHolding(h, q, 'LIVE')
    expect(result.unrealizedPnLPct).toBe(0)
  })
})

// ─── applyQuoteToHolding — non-LIVE sources ───────────────────────────────────

describe('applyQuoteToHolding — FALLBACK source', () => {
  it('does not overwrite currentPrice', () => {
    const h = makeHolding({ currentPrice: 130 })
    const q = makeQuote({ price: 999 })
    const result = applyQuoteToHolding(h, q, 'FALLBACK')
    expect(result.currentPrice).toBe(130)
  })

  it('does not overwrite currentValue', () => {
    const h = makeHolding({ currentValue: 13_000 })
    const q = makeQuote({ price: 999 })
    const result = applyQuoteToHolding(h, q, 'FALLBACK')
    expect(result.currentValue).toBe(13_000)
  })

  it('sets trustMode to DEGRADED', () => {
    const h = makeHolding({ trustMode: 'TRUSTED' })
    const q = makeQuote()
    const result = applyQuoteToHolding(h, q, 'FALLBACK')
    expect(result.trustMode).toBe('DEGRADED')
  })
})

describe('applyQuoteToHolding — CANADA source', () => {
  it('does not overwrite currentPrice', () => {
    const h = makeHolding({ symbol: 'RY.TO', currentPrice: 130 })
    const q = makeQuote({ price: 999 })
    const result = applyQuoteToHolding(h, q, 'CANADA')
    expect(result.currentPrice).toBe(130)
  })

  it('does not overwrite currentValue', () => {
    const h = makeHolding({ symbol: 'RY.TO', currentValue: 13_000 })
    const q = makeQuote({ price: 999 })
    const result = applyQuoteToHolding(h, q, 'CANADA')
    expect(result.currentValue).toBe(13_000)
  })

  it('does not change trustMode', () => {
    const h = makeHolding({ trustMode: 'TRUSTED' })
    const q = makeQuote()
    const result = applyQuoteToHolding(h, q, 'CANADA')
    expect(result.trustMode).toBe('TRUSTED')
  })
})

describe('applyQuoteToHolding — MOCK source', () => {
  it('returns holding unchanged', () => {
    const h = makeHolding({ currentPrice: 130, currentValue: 13_000, trustMode: 'TRUSTED' })
    const q = makeQuote({ price: 999 })
    const result = applyQuoteToHolding(h, q, 'MOCK')
    expect(result).toEqual(h)
  })
})

// ─── normalizeWeights ─────────────────────────────────────────────────────────

describe('normalizeWeights', () => {
  it('sets weights proportional to currentValue', () => {
    const h1 = makeHolding({ id: 'h1', currentValue: 3_000 })
    const h2 = makeHolding({ id: 'h2', currentValue: 7_000 })
    const result = normalizeWeights([h1, h2], 10_000)
    expect(result[0].weight).toBeCloseTo(0.3)
    expect(result[1].weight).toBeCloseTo(0.7)
  })

  it('weights sum to 1 when totalValue matches equity', () => {
    const holdings = [
      makeHolding({ id: 'a', currentValue: 4_000 }),
      makeHolding({ id: 'b', currentValue: 6_000 }),
    ]
    const result = normalizeWeights(holdings, 10_000)
    const sum = result.reduce((s, h) => s + h.weight, 0)
    expect(sum).toBeCloseTo(1)
  })

  it('sets all weights to 0 when totalValue is 0', () => {
    const holdings = [makeHolding({ id: 'a', currentValue: 0 })]
    const result = normalizeWeights(holdings, 0)
    expect(result[0].weight).toBe(0)
  })

  it('weights reflect cash dilution when totalValue exceeds equity', () => {
    // 9000 equity, 1000 cash → equity weight < 1
    const holdings = [makeHolding({ id: 'a', currentValue: 9_000 })]
    const result = normalizeWeights(holdings, 10_000)
    expect(result[0].weight).toBeCloseTo(0.9)
  })
})

// ─── computeRefreshedState ────────────────────────────────────────────────────

describe('computeRefreshedState', () => {
  it('classifies US trusted Polygon quote as LIVE', () => {
    const h = makeHolding({ id: 'h1', symbol: 'AAPL' })
    const qr = [{ holdingId: 'h1', symbol: 'AAPL', quote: makeQuote({ trustMode: 'TRUSTED', exchange: 'Polygon.io' }) }]
    const { priceSourceMap } = computeRefreshedState([h], NO_CASH, qr)
    expect(priceSourceMap['AAPL']).toBe('LIVE')
  })

  it('classifies Canadian symbol as CANADA', () => {
    const h = makeHolding({ id: 'h1', symbol: 'RY.TO' })
    const qr = [{ holdingId: 'h1', symbol: 'RY.TO', quote: makeQuote({ trustMode: 'DEGRADED', exchange: 'n/a' }) }]
    const { priceSourceMap } = computeRefreshedState([h], NO_CASH, qr)
    expect(priceSourceMap['RY.TO']).toBe('CANADA')
  })

  it('classifies TD.TO as CANADA', () => {
    const h = makeHolding({ id: 'h1', symbol: 'TD.TO' })
    const qr = [{ holdingId: 'h1', symbol: 'TD.TO', quote: makeQuote({ trustMode: 'DEGRADED', exchange: 'n/a' }) }]
    const { priceSourceMap } = computeRefreshedState([h], NO_CASH, qr)
    expect(priceSourceMap['TD.TO']).toBe('CANADA')
  })

  it('classifies degraded non-Canadian as FALLBACK', () => {
    const h = makeHolding({ id: 'h1', symbol: 'AAPL' })
    const qr = [{ holdingId: 'h1', symbol: 'AAPL', quote: makeQuote({ trustMode: 'DEGRADED', exchange: 'mock' }) }]
    const { priceSourceMap } = computeRefreshedState([h], NO_CASH, qr)
    expect(priceSourceMap['AAPL']).toBe('FALLBACK')
  })

  it('classifies non-Polygon trusted as MOCK', () => {
    const h = makeHolding({ id: 'h1', symbol: 'AAPL' })
    const qr = [{ holdingId: 'h1', symbol: 'AAPL', quote: makeQuote({ trustMode: 'TRUSTED', exchange: 'OtherVendor' }) }]
    const { priceSourceMap } = computeRefreshedState([h], NO_CASH, qr)
    expect(priceSourceMap['AAPL']).toBe('MOCK')
  })

  it('updates price fields for LIVE quote', () => {
    const h = makeHolding({ id: 'h1', symbol: 'AAPL', shares: 100, costBasis: 100, currentPrice: 100, currentValue: 10_000 })
    const qr = [{ holdingId: 'h1', symbol: 'AAPL', quote: makeQuote({ price: 200, change: 5, changePct: 2.6, trustMode: 'TRUSTED', exchange: 'Polygon.io' }) }]
    const { holdings } = computeRefreshedState([h], NO_CASH, qr)
    expect(holdings[0].currentPrice).toBe(200)
    expect(holdings[0].currentValue).toBe(20_000)
    expect(holdings[0].unrealizedPnL).toBe(10_000) // (200-100)*100
    expect(holdings[0].unrealizedPnLPct).toBeCloseTo(1) // 100%
    expect(holdings[0].dayChange).toBe(500) // 5*100
    expect(holdings[0].dayChangePct).toBe(2.6)
  })

  it('does not overwrite price for FALLBACK holding', () => {
    const h = makeHolding({ id: 'h1', symbol: 'AAPL', currentPrice: 130, currentValue: 13_000 })
    const qr = [{ holdingId: 'h1', symbol: 'AAPL', quote: makeQuote({ price: 999, trustMode: 'DEGRADED', exchange: 'mock' }) }]
    const { holdings } = computeRefreshedState([h], NO_CASH, qr)
    expect(holdings[0].currentPrice).toBe(130)
    expect(holdings[0].currentValue).toBe(13_000)
  })

  it('does not overwrite price for CANADA holding', () => {
    const h = makeHolding({ id: 'h1', symbol: 'RY.TO', currentPrice: 130, currentValue: 13_000 })
    const qr = [{ holdingId: 'h1', symbol: 'RY.TO', quote: makeQuote({ price: 999, trustMode: 'DEGRADED', exchange: 'n/a' }) }]
    const { holdings } = computeRefreshedState([h], NO_CASH, qr)
    expect(holdings[0].currentPrice).toBe(130)
    expect(holdings[0].currentValue).toBe(13_000)
  })

  it('does not overwrite price for MOCK holding', () => {
    const h = makeHolding({ id: 'h1', symbol: 'AAPL', currentPrice: 130, currentValue: 13_000 })
    const qr = [{ holdingId: 'h1', symbol: 'AAPL', quote: makeQuote({ price: 999, trustMode: 'TRUSTED', exchange: 'OtherVendor' }) }]
    const { holdings } = computeRefreshedState([h], NO_CASH, qr)
    expect(holdings[0].currentPrice).toBe(130)
    expect(holdings[0].currentValue).toBe(13_000)
  })

  it('renormalizes weights across all holdings after live update', () => {
    const h1 = makeHolding({ id: 'h1', symbol: 'AAPL', shares: 100, costBasis: 100, currentPrice: 100, currentValue: 10_000, weight: 0.5 })
    const h2 = makeHolding({ id: 'h2', symbol: 'MSFT', shares: 100, costBasis: 100, currentPrice: 100, currentValue: 10_000, weight: 0.5 })
    // AAPL live update doubles price; MSFT is FALLBACK
    const qr = [
      { holdingId: 'h1', symbol: 'AAPL', quote: makeQuote({ symbol: 'AAPL', price: 200, change: 0, changePct: 0, trustMode: 'TRUSTED', exchange: 'Polygon.io' }) },
      { holdingId: 'h2', symbol: 'MSFT', quote: makeQuote({ symbol: 'MSFT', price: 999, trustMode: 'DEGRADED', exchange: 'mock' }) },
    ]
    const { holdings } = computeRefreshedState([h1, h2], NO_CASH, qr)
    // AAPL: 20_000, MSFT: 10_000 (unchanged) → total 30_000
    expect(holdings[0].weight).toBeCloseTo(20_000 / 30_000)
    expect(holdings[1].weight).toBeCloseTo(10_000 / 30_000)
    const sum = holdings.reduce((s, h) => s + h.weight, 0)
    expect(sum).toBeCloseTo(1)
  })

  it('includes cash in total for weight normalization', () => {
    const h = makeHolding({ id: 'h1', currentValue: 9_000, weight: 1 })
    const cash: CashPosition[] = [{ currency: 'USD', amount: 1_000, usdEquivalent: 1_000, pct: 0 }]
    const qr = [{ holdingId: 'h1', symbol: 'AAPL', quote: makeQuote({ trustMode: 'TRUSTED', exchange: 'Polygon.io', price: 90 }) }]
    const { holdings } = computeRefreshedState([h], cash, qr)
    // currentValue = 90 * 100 = 9_000; totalValue = 9_000 + 1_000 = 10_000
    expect(holdings[0].weight).toBeCloseTo(0.9)
  })

  it('recomputes summary after refresh', () => {
    const h1 = makeHolding({ id: 'h1', shares: 100, costBasis: 100, currentPrice: 100, currentValue: 10_000, unrealizedPnL: 0, dayChange: 0 })
    const qr = [{ holdingId: 'h1', symbol: 'AAPL', quote: makeQuote({ price: 150, change: 2, changePct: 1.35, trustMode: 'TRUSTED', exchange: 'Polygon.io' }) }]
    const { summary } = computeRefreshedState([h1], NO_CASH, qr)
    expect(summary.totalValue).toBe(15_000) // 150 * 100
    expect(summary.totalUnrealizedPnL).toBe(5_000) // (150-100)*100
    expect(summary.holdingCount).toBe(1)
  })

  it('leaves unmatched holdings unchanged when no quote received', () => {
    const h = makeHolding({ id: 'h1', currentPrice: 130, currentValue: 13_000 })
    const { holdings } = computeRefreshedState([h], NO_CASH, [])
    expect(holdings[0].currentPrice).toBe(130)
    expect(holdings[0].currentValue).toBe(13_000)
  })
})

// ─── buildPriceRefreshAuditParams ────────────────────────────────────────────

describe('buildPriceRefreshAuditParams', () => {
  const BASE: Parameters<typeof buildPriceRefreshAuditParams>[0] = {
    previousSourceMap: { AAPL: 'MOCK', MSFT: 'MOCK' },
    newSourceMap: { AAPL: 'LIVE', MSFT: 'FALLBACK' },
    holdingCount: 2,
    resolvedCount: 2,
    completedAt: '2026-01-01T16:00:00.000Z',
  }

  it('returns correct category, action, entityType', () => {
    const p = buildPriceRefreshAuditParams(BASE)
    expect(p.category).toBe('MARKET_DATA')
    expect(p.action).toBe('MARKET_DATA.PRICE_REFRESH')
    expect(p.entityType).toBe('PORTFOLIO')
  })

  it('uses DEFAULT_PORTFOLIO_ID as entityId', () => {
    expect(buildPriceRefreshAuditParams(BASE).entityId).toBe(DEFAULT_PORTFOLIO_ID)
  })

  it('uses SYSTEM as source', () => {
    expect(buildPriceRefreshAuditParams(BASE).source).toBe('SYSTEM')
  })

  it('severity is INFO when resolvedCount > 0', () => {
    expect(buildPriceRefreshAuditParams({ ...BASE, resolvedCount: 1 }).severity).toBe('INFO')
  })

  it('severity is WARNING when resolvedCount is 0 and holdingCount > 0', () => {
    expect(buildPriceRefreshAuditParams({ ...BASE, resolvedCount: 0, holdingCount: 2 }).severity).toBe('WARNING')
  })

  it('severity is INFO when both resolvedCount and holdingCount are 0', () => {
    const p = buildPriceRefreshAuditParams({ ...BASE, resolvedCount: 0, holdingCount: 0, newSourceMap: {} })
    expect(p.severity).toBe('INFO')
  })

  it('before.priceSourceMap matches previousSourceMap', () => {
    const p = buildPriceRefreshAuditParams(BASE)
    expect((p.before as Record<string, unknown>).priceSourceMap).toEqual(BASE.previousSourceMap)
  })

  it('after.priceSourceMap matches newSourceMap', () => {
    const p = buildPriceRefreshAuditParams(BASE)
    expect((p.after as Record<string, unknown>).priceSourceMap).toEqual(BASE.newSourceMap)
  })

  it('metadata includes holdingCount and resolvedCount', () => {
    const m = buildPriceRefreshAuditParams(BASE).metadata as Record<string, unknown>
    expect(m.holdingCount).toBe(2)
    expect(m.resolvedCount).toBe(2)
  })

  it('metadata per-source counts reflect newSourceMap', () => {
    const m = buildPriceRefreshAuditParams(BASE).metadata as Record<string, unknown>
    expect(m.liveCount).toBe(1)      // AAPL → LIVE
    expect(m.fallbackCount).toBe(1)  // MSFT → FALLBACK
    expect(m.mockCount).toBe(0)
    expect(m.canadaCount).toBe(0)
  })

  it('metadata counts CANADA source correctly', () => {
    const input = { ...BASE, newSourceMap: { 'RY.TO': 'CANADA' as const, AAPL: 'MOCK' as const } }
    const m = buildPriceRefreshAuditParams(input).metadata as Record<string, unknown>
    expect(m.canadaCount).toBe(1)
    expect(m.mockCount).toBe(1)
    expect(m.liveCount).toBe(0)
  })

  it('metadata includes completedAt', () => {
    const m = buildPriceRefreshAuditParams(BASE).metadata as Record<string, unknown>
    expect(m.completedAt).toBe('2026-01-01T16:00:00.000Z')
  })

  it('does not throw', () => {
    expect(() => buildPriceRefreshAuditParams(BASE)).not.toThrow()
  })
})

// ─── computeSummary ───────────────────────────────────────────────────────────

describe('computeSummary', () => {
  it('totals equity + cash for totalValue', () => {
    const h = makeHolding({ currentValue: 10_000, unrealizedPnL: 0, dayChange: 0, costBasis: 100, shares: 100 })
    const cash: CashPosition[] = [{ currency: 'USD', amount: 2_000, usdEquivalent: 2_000, pct: 0 }]
    const s = computeSummary([h], cash)
    expect(s.totalValue).toBe(12_000)
    expect(s.cashTotal).toBe(2_000)
    expect(s.equityTotal).toBe(10_000)
  })

  it('reports correct holdingCount', () => {
    const h1 = makeHolding({ id: 'h1' })
    const h2 = makeHolding({ id: 'h2' })
    const s = computeSummary([h1, h2], NO_CASH)
    expect(s.holdingCount).toBe(2)
  })

  it('totalUnrealizedPnL is sum across all holdings', () => {
    const h1 = makeHolding({ id: 'h1', unrealizedPnL: 500, costBasis: 100, shares: 10, currentValue: 1_500, dayChange: 0 })
    const h2 = makeHolding({ id: 'h2', unrealizedPnL: -200, costBasis: 100, shares: 10, currentValue: 800, dayChange: 0 })
    const s = computeSummary([h1, h2], NO_CASH)
    expect(s.totalUnrealizedPnL).toBe(300)
  })
})
