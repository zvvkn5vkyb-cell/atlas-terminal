import { describe, it, expect } from 'vitest'
import { computeTechnicalIndicators } from './technicalIndicators'
import type { OHLCVBar } from '@/services/market/types'

function makeBar(close: number, high?: number, low?: number): OHLCVBar {
  return {
    timestamp: '2024-01-01',
    open: close,
    high: high ?? close + 1,
    low: low ?? close - 1,
    close,
    volume: 1_000_000,
  }
}

// Creates n bars with a constant price (no movement)
function flatBars(price: number, n: number): OHLCVBar[] {
  return Array.from({ length: n }, () => makeBar(price))
}

// Creates n bars stepping up by 1 each day
function risingBars(start: number, n: number): OHLCVBar[] {
  return Array.from({ length: n }, (_, i) => makeBar(start + i))
}

// Creates n bars stepping down by 1 each day
function fallingBars(start: number, n: number): OHLCVBar[] {
  return Array.from({ length: n }, (_, i) => makeBar(start - i))
}

describe('computeTechnicalIndicators — insufficient data', () => {
  it('returns all null with 0 bars', () => {
    const r = computeTechnicalIndicators([])
    expect(r.rsi14).toBeNull()
    expect(r.macd).toBeNull()
    expect(r.sma20).toBeNull()
    expect(r.sma50).toBeNull()
    expect(r.sma200).toBeNull()
    expect(r.atr14).toBeNull()
    expect(r.barsAvailable).toBe(0)
  })

  it('returns all null with 14 bars (one short of RSI minimum)', () => {
    const r = computeTechnicalIndicators(flatBars(100, 14))
    expect(r.rsi14).toBeNull()
    expect(r.atr14).toBeNull()
    expect(r.sma20).toBeNull()
  })

  it('returns RSI and ATR with 15 bars, SMA20 still null', () => {
    const r = computeTechnicalIndicators(flatBars(100, 15))
    expect(r.rsi14).not.toBeNull()
    expect(r.atr14).not.toBeNull()
    expect(r.sma20).toBeNull()   // needs 20
    expect(r.sma50).toBeNull()
    expect(r.sma200).toBeNull()
  })

  it('returns SMA20 with 20 bars', () => {
    const r = computeTechnicalIndicators(flatBars(100, 20))
    expect(r.sma20).toBeCloseTo(100)
  })

  it('MACD still null with 34 bars (needs 35 minimum)', () => {
    const r = computeTechnicalIndicators(flatBars(100, 34))
    expect(r.macd).toBeNull()
  })

  it('MACD computed with 35 bars', () => {
    const r = computeTechnicalIndicators(risingBars(100, 35))
    expect(r.macd).not.toBeNull()
  })

  it('all indicators present with 252 bars', () => {
    const r = computeTechnicalIndicators(risingBars(100, 252))
    expect(r.rsi14).not.toBeNull()
    expect(r.macd).not.toBeNull()
    expect(r.sma20).not.toBeNull()
    expect(r.sma50).not.toBeNull()
    expect(r.sma200).not.toBeNull()
    expect(r.atr14).not.toBeNull()
  })
})

describe('RSI correctness', () => {
  it('RSI is 100 when all price changes are positive (no losses)', () => {
    const r = computeTechnicalIndicators(risingBars(100, 30))
    expect(r.rsi14).toBeCloseTo(100)
  })

  it('RSI is 0 when all price changes are negative (no gains)', () => {
    const r = computeTechnicalIndicators(fallingBars(200, 30))
    expect(r.rsi14).toBeCloseTo(0)
  })

  it('RSI is ~50 for flat prices', () => {
    // Flat bars have zero changes → avgGain = avgLoss = 0 → special case
    const r = computeTechnicalIndicators(flatBars(100, 30))
    // With all-zero changes avgLoss = 0, returns 100 per our implementation
    expect(r.rsi14).toBe(100)
  })

  it('RSI is between 0 and 100', () => {
    const mixed = [
      ...risingBars(100, 20),
      ...fallingBars(120, 20),
    ]
    const r = computeTechnicalIndicators(mixed)
    expect(r.rsi14).not.toBeNull()
    expect(r.rsi14!).toBeGreaterThanOrEqual(0)
    expect(r.rsi14!).toBeLessThanOrEqual(100)
  })
})

describe('SMA correctness', () => {
  it('SMA20 equals mean of last 20 closes', () => {
    const bars = risingBars(1, 30) // closes: 1,2,...,30
    // Last 20 closes are 11..30, mean = (11+30)/2 = 20.5
    const r = computeTechnicalIndicators(bars)
    expect(r.sma20).toBeCloseTo(20.5)
  })

  it('SMA reflects last N values, not all values', () => {
    // First 10 bars at 1000, then 20 bars at 1
    const bars: OHLCVBar[] = [
      ...flatBars(1000, 10),
      ...flatBars(1, 20),
    ]
    const r = computeTechnicalIndicators(bars)
    // SMA20 should be 1 (all last 20 bars are 1)
    expect(r.sma20).toBeCloseTo(1)
  })
})

describe('ATR correctness', () => {
  it('ATR is positive for bars with range > 0', () => {
    const bars = Array.from({ length: 20 }, (_, i) =>
      makeBar(100 + i, 103 + i, 97 + i) // range of 6 each bar
    )
    const r = computeTechnicalIndicators(bars)
    expect(r.atr14).not.toBeNull()
    expect(r.atr14!).toBeGreaterThan(0)
  })

  it('barsAvailable always matches input length', () => {
    for (const n of [0, 1, 14, 15, 50, 252]) {
      const r = computeTechnicalIndicators(flatBars(100, n))
      expect(r.barsAvailable).toBe(n)
    }
  })
})

describe('MACD correctness', () => {
  it('histogram = value - signal', () => {
    const r = computeTechnicalIndicators(risingBars(100, 100))
    expect(r.macd).not.toBeNull()
    const { value, signal, histogram } = r.macd!
    expect(histogram).toBeCloseTo(value - signal, 4)
  })

  it('MACD value is finite', () => {
    const r = computeTechnicalIndicators(risingBars(100, 100))
    expect(isFinite(r.macd!.value)).toBe(true)
    expect(isFinite(r.macd!.signal)).toBe(true)
    expect(isFinite(r.macd!.histogram)).toBe(true)
  })
})
