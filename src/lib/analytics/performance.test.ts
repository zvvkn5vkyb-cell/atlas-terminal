import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { calculatePerformance, calculateContributions, calculatePortfolioValue } from './performance'
import type { NAVSnapshot, BenchmarkPrice } from '@/types/portfolio'
import type { Holding } from '@/types/portfolio'

// Fix system time so relative timeframes (1D, YTD, etc.) are deterministic
const FIXED_DATE = new Date('2024-06-15T12:00:00Z')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED_DATE) })
afterAll(() => { vi.useRealTimers() })

// NAV history: 2023-01-03 → 2024-06-14, ends above start → positive return
const NAV_SNAPSHOTS: NAVSnapshot[] = [
  { date: '2023-01-03', nav: 100_000, totalValue: 100_000, cashValue: 5_000, equityValue: 95_000 },
  { date: '2023-06-01', nav: 108_000, totalValue: 108_000, cashValue: 5_400, equityValue: 102_600 },
  { date: '2023-12-29', nav: 115_000, totalValue: 115_000, cashValue: 5_750, equityValue: 109_250 },
  { date: '2024-01-02', nav: 116_000, totalValue: 116_000, cashValue: 5_800, equityValue: 110_200 },
  { date: '2024-06-14', nav: 124_000, totalValue: 124_000, cashValue: 6_200, equityValue: 117_800 },
]

const BENCHMARK_PRICES: BenchmarkPrice[] = [
  { date: '2023-01-03', price: 400, symbol: 'SPY' },
  { date: '2023-06-01', price: 430, symbol: 'SPY' },
  { date: '2023-12-29', price: 450, symbol: 'SPY' },
  { date: '2024-01-02', price: 455, symbol: 'SPY' },
  { date: '2024-06-14', price: 470, symbol: 'SPY' },
]

function makeHolding(id: string, symbol: string, currentValue: number, dayChangePct: number): Holding {
  return {
    id, symbol, name: symbol, exchange: 'NYSE', currency: 'USD',
    sector: 'Technology', assetClass: 'EQUITY', shares: 100,
    costBasis: currentValue / 100, currentPrice: currentValue / 100,
    currentValue, unrealizedPnL: 0, unrealizedPnLPct: 0,
    dayChange: currentValue * dayChangePct / 100,
    dayChangePct, weight: 0.25, trustMode: 'TRUSTED',
  }
}

describe('calculatePerformance — SI timeframe', () => {
  it('returns TRUSTED result with positive portfolio return', () => {
    const r = calculatePerformance('SI', NAV_SNAPSHOTS, BENCHMARK_PRICES)
    expect(r.trustMode).toBe('TRUSTED')
    expect(r.portfolioReturn).toBeGreaterThan(0)
  })

  it('calculates portfolio return correctly: (124000 - 100000) / 100000 = 0.24', () => {
    const r = calculatePerformance('SI', NAV_SNAPSHOTS, BENCHMARK_PRICES)
    expect(r.portfolioReturn).toBeCloseTo(0.24)
  })

  it('calculates benchmark return correctly: (470 - 400) / 400 = 0.175', () => {
    const r = calculatePerformance('SI', NAV_SNAPSHOTS, BENCHMARK_PRICES)
    expect(r.benchmarkReturn).toBeCloseTo(0.175)
  })

  it('alpha = portfolioReturn - benchmarkReturn', () => {
    const r = calculatePerformance('SI', NAV_SNAPSHOTS, BENCHMARK_PRICES)
    expect(r.alpha).toBeCloseTo(r.portfolioReturn - r.benchmarkReturn)
  })

  it('populates startValue and endValue', () => {
    const r = calculatePerformance('SI', NAV_SNAPSHOTS, BENCHMARK_PRICES)
    expect(r.startValue).toBe(100_000)
    expect(r.endValue).toBe(124_000)
  })
})

describe('calculatePerformance — YTD timeframe (fixed at 2024-06-15)', () => {
  it('uses first valuation ON OR AFTER Jan 1 as YTD start', () => {
    const r = calculatePerformance('YTD', NAV_SNAPSHOTS, BENCHMARK_PRICES)
    expect(r.trustMode).toBe('TRUSTED')
    // YTD start is 2024-01-01 (Jan 1 is not a trading day).
    // findNAVOnOrAfter selects the first snapshot ≥ '2024-01-01' = '2024-01-02' (nav=116_000).
    // Prior methodology (onOrBefore) incorrectly used '2023-12-29' (115_000),
    // including Dec 29 → Jan 1 drift in the YTD return.
    expect(r.startValue).toBe(116_000)
  })

  it('YTD return is measured from first trading day of the year, not prior year close', () => {
    const r = calculatePerformance('YTD', NAV_SNAPSHOTS, BENCHMARK_PRICES)
    // start=116_000 (Jan 2), end=124_000 (Jun 14)
    // return = (124_000 - 116_000) / 116_000
    expect(r.portfolioReturn).toBeCloseTo(8_000 / 116_000)
  })
})

describe('calculatePerformance — insufficient data', () => {
  it('returns INSUFFICIENT_DATA when nav snapshots are empty', () => {
    const r = calculatePerformance('SI', [], BENCHMARK_PRICES)
    expect(r.trustMode).toBe('INSUFFICIENT_DATA')
    expect(r.portfolioReturn).toBe(0)
  })

  it('returns INSUFFICIENT_DATA when benchmark prices are empty', () => {
    const r = calculatePerformance('SI', NAV_SNAPSHOTS, [])
    expect(r.trustMode).toBe('INSUFFICIENT_DATA')
  })

  it('returns INSUFFICIENT_DATA when no benchmark prices exist', () => {
    const r = calculatePerformance('1D', NAV_SNAPSHOTS, [])
    expect(r.trustMode).toBe('INSUFFICIENT_DATA')
  })

  it('returns INSUFFICIENT_DATA when all nav snapshots pre-date the period start', () => {
    // 1D start = 2024-06-14; provide only snapshots from before that date.
    // findNAVOnOrAfter finds nothing → INSUFFICIENT_DATA.
    const oldNavs: NAVSnapshot[] = [
      { date: '2024-06-10', nav: 100_000, totalValue: 100_000, cashValue: 0, equityValue: 100_000 },
      { date: '2024-06-12', nav: 101_000, totalValue: 101_000, cashValue: 0, equityValue: 101_000 },
    ]
    const oldBench: BenchmarkPrice[] = [
      { date: '2024-06-10', price: 400, symbol: 'SPY' },
    ]
    const r = calculatePerformance('1D', oldNavs, oldBench)
    expect(r.trustMode).toBe('INSUFFICIENT_DATA')
  })
})

describe('calculateContributions', () => {
  const holdings = [
    makeHolding('h1', 'AAPL', 60_000, 2.0),   // positive contributor
    makeHolding('h2', 'MSFT', 30_000, 1.0),   // positive contributor
    makeHolding('h3', 'TD.TO', 10_000, -3.0), // negative contributor
  ]

  it('returns topPositive and topNegative', () => {
    const { topPositive, topNegative } = calculateContributions(holdings)
    expect(topPositive.length).toBeGreaterThan(0)
    expect(topNegative.length).toBeGreaterThan(0)
  })

  it('positive contributors have contribution >= 0', () => {
    const { topPositive } = calculateContributions(holdings)
    topPositive.forEach(c => expect(c.contribution).toBeGreaterThanOrEqual(0))
  })

  it('negative contributors have contribution < 0', () => {
    const { topNegative } = calculateContributions(holdings)
    topNegative.forEach(c => expect(c.contribution).toBeLessThan(0))
  })

  it('contribution = weight × holdingReturn', () => {
    const { topPositive } = calculateContributions(holdings)
    topPositive.forEach(c => {
      expect(c.contribution).toBeCloseTo(c.weight * c.holdingReturn)
    })
  })

  it('returns empty arrays when holdings are empty', () => {
    const { topPositive, topNegative } = calculateContributions([])
    expect(topPositive).toEqual([])
    expect(topNegative).toEqual([])
  })

  it('returns empty arrays when total value is zero', () => {
    const zeroHoldings = [makeHolding('h1', 'X', 0, 0)]
    const { topPositive, topNegative } = calculateContributions(zeroHoldings)
    expect(topPositive).toEqual([])
    expect(topNegative).toEqual([])
  })
})

describe('calculatePortfolioValue', () => {
  it('sums currentValue across all holdings', () => {
    const holdings = [
      makeHolding('h1', 'A', 50_000, 0),
      makeHolding('h2', 'B', 30_000, 0),
      makeHolding('h3', 'C', 20_000, 0),
    ]
    expect(calculatePortfolioValue(holdings)).toBe(100_000)
  })

  it('returns 0 for empty holdings', () => {
    expect(calculatePortfolioValue([])).toBe(0)
  })
})
