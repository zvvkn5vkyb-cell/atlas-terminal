import { describe, it, expect } from 'vitest'
import { calculateAssetClassAllocation, calculateHoldingWeights } from './attribution'
import type { Holding } from '@/types/portfolio'

function makeHolding(overrides: Partial<Holding>): Holding {
  return {
    id: 'h1', symbol: 'AAA', name: 'Test', exchange: 'NYSE', currency: 'USD',
    sector: 'Technology', assetClass: 'EQUITY', shares: 100, costBasis: 100,
    currentPrice: 100, currentValue: 10000, unrealizedPnL: 0, unrealizedPnLPct: 0,
    dayChange: 0, dayChangePct: 0, weight: 0.5, trustMode: 'TRUSTED',
    ...overrides,
  }
}

const HOLDINGS: Holding[] = [
  makeHolding({ id: 'h1', symbol: 'AAPL', assetClass: 'EQUITY', currentValue: 60000 }),
  makeHolding({ id: 'h2', symbol: 'MSFT', assetClass: 'EQUITY', currentValue: 30000 }),
  makeHolding({ id: 'h3', symbol: 'SPY',  assetClass: 'ETF',    currentValue: 10000 }),
]

describe('calculateAssetClassAllocation', () => {
  it('aggregates by asset class', () => {
    const result = calculateAssetClassAllocation(HOLDINGS)
    const equity = result.find(b => b.label === 'EQUITY')
    const etf    = result.find(b => b.label === 'ETF')
    expect(equity?.value).toBe(90000)
    expect(etf?.value).toBe(10000)
  })

  it('calculates correct percentages (sum to 1)', () => {
    const result = calculateAssetClassAllocation(HOLDINGS)
    const total = result.reduce((s, b) => s + b.pct, 0)
    expect(total).toBeCloseTo(1)
  })

  it('sorts by descending percentage', () => {
    const result = calculateAssetClassAllocation(HOLDINGS)
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].pct).toBeGreaterThanOrEqual(result[i].pct)
    }
  })

  it('returns empty array for empty holdings', () => {
    expect(calculateAssetClassAllocation([])).toEqual([])
  })
})

describe('calculateHoldingWeights', () => {
  it('weights sum to 1 when totalValue > 0', () => {
    const weights = calculateHoldingWeights(HOLDINGS)
    let total = 0
    weights.forEach(w => { total += w })
    expect(total).toBeCloseTo(1)
  })

  it('assigns correct weight to each symbol', () => {
    const weights = calculateHoldingWeights(HOLDINGS)
    expect(weights.get('AAPL')).toBeCloseTo(0.6)
    expect(weights.get('MSFT')).toBeCloseTo(0.3)
    expect(weights.get('SPY')).toBeCloseTo(0.1)
  })

  it('returns empty map for empty holdings', () => {
    expect(calculateHoldingWeights([]).size).toBe(0)
  })
})
