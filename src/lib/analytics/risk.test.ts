import { describe, it, expect } from 'vitest'
import {
  calculateConcentration,
  calculateSectorExposure,
  calculateCurrencyExposure,
  calculateDrawdown,
  calculateVolatility,
  calculateBeta,
  buildRiskFlags,
} from './risk'
import type { Holding, NAVSnapshot, BenchmarkPrice, ConcentrationMetric, DrawdownMetric, BetaMetric } from '@/types/portfolio'

function makeHolding(id: string, symbol: string, currentValue: number, opts: Partial<Holding> = {}): Holding {
  return {
    id, symbol, name: symbol, exchange: 'NYSE', currency: 'USD',
    sector: 'Technology', assetClass: 'EQUITY', shares: 100,
    costBasis: 10, currentPrice: currentValue / 100,
    currentValue, unrealizedPnL: 0, unrealizedPnLPct: 0,
    dayChange: 0, dayChangePct: 0, weight: 0,
    trustMode: 'TRUSTED', ...opts,
  }
}

function makeNav(date: string, nav: number): NAVSnapshot {
  return { date, nav, totalValue: nav, cashValue: 0, equityValue: nav }
}

function makeBench(date: string, price: number): BenchmarkPrice {
  return { date, price, symbol: 'SPY' }
}

// ─── Concentration ────────────────────────────────────────────────────────────

describe('calculateConcentration', () => {
  it('returns HIGH when top 3 exceed 40%', () => {
    const holdings = [
      makeHolding('h1', 'A', 50_000, { weight: 0.50 }),
      makeHolding('h2', 'B', 30_000, { weight: 0.30 }),
      makeHolding('h3', 'C', 10_000, { weight: 0.10 }),
      makeHolding('h4', 'D', 5_000,  { weight: 0.05 }),
      makeHolding('h5', 'E', 5_000,  { weight: 0.05 }),
    ]
    const r = calculateConcentration(holdings)
    expect(r.level).toBe('HIGH')
    expect(r.top3Pct).toBeGreaterThan(0.4)
  })

  it('returns MEDIUM when top 3 are between 25% and 40%', () => {
    const holdings = [
      makeHolding('h1', 'A', 20_000, { weight: 0.20 }),
      makeHolding('h2', 'B', 15_000, { weight: 0.15 }),
      makeHolding('h3', 'C', 10_000, { weight: 0.10 }),
      makeHolding('h4', 'D', 55_000, { weight: 0.55 }),
    ]
    // top3 = 0.20+0.55+0.15 = 0.90 ... let me fix weights
    // Actually concentration sorts by weight descending, so h4(0.55) + h1(0.20) + h2(0.15) = 0.90 → HIGH
    // Need a portfolio where top3 is 25-40%
    const balanced = [
      makeHolding('h1', 'A', 14_000, { weight: 0.14 }),
      makeHolding('h2', 'B', 13_000, { weight: 0.13 }),
      makeHolding('h3', 'C', 12_000, { weight: 0.12 }),
      makeHolding('h4', 'D', 11_000, { weight: 0.11 }),
      makeHolding('h5', 'E', 10_000, { weight: 0.10 }),
      makeHolding('h6', 'F', 10_000, { weight: 0.10 }),
      makeHolding('h7', 'G', 10_000, { weight: 0.10 }),
      makeHolding('h8', 'H', 10_000, { weight: 0.10 }),
      makeHolding('h9', 'I', 5_000,  { weight: 0.05 }),
      makeHolding('h10','J', 5_000,  { weight: 0.05 }),
    ]
    const r = calculateConcentration(balanced)
    // top3 = 0.14+0.13+0.12 = 0.39 → MEDIUM
    expect(r.level).toBe('MEDIUM')
  })

  it('returns LOW when top 3 are below 25%', () => {
    const equal = Array.from({ length: 20 }, (_, i) =>
      makeHolding(`h${i}`, `S${i}`, 5_000, { weight: 0.05 })
    )
    const r = calculateConcentration(equal)
    // top3 = 0.05*3 = 0.15 → LOW
    expect(r.level).toBe('LOW')
  })

  it('calculates top1, top3, top5 correctly', () => {
    const holdings = [
      makeHolding('h1', 'A', 50_000, { weight: 0.50 }),
      makeHolding('h2', 'B', 20_000, { weight: 0.20 }),
      makeHolding('h3', 'C', 15_000, { weight: 0.15 }),
      makeHolding('h4', 'D', 10_000, { weight: 0.10 }),
      makeHolding('h5', 'E', 5_000,  { weight: 0.05 }),
    ]
    const r = calculateConcentration(holdings)
    expect(r.top1Pct).toBeCloseTo(0.50)
    expect(r.top3Pct).toBeCloseTo(0.85)
    expect(r.top5Pct).toBeCloseTo(1.00)
  })
})

// ─── Sector / Currency Exposure ───────────────────────────────────────────────

describe('calculateSectorExposure', () => {
  it('aggregates holdings by sector', () => {
    const holdings = [
      makeHolding('h1', 'A', 60_000, { sector: 'Technology' }),
      makeHolding('h2', 'B', 30_000, { sector: 'Technology' }),
      makeHolding('h3', 'C', 10_000, { sector: 'Financials' }),
    ]
    const r = calculateSectorExposure(holdings)
    const tech = r.find(b => b.label === 'Technology')
    const fin  = r.find(b => b.label === 'Financials')
    expect(tech?.value).toBe(90_000)
    expect(fin?.value).toBe(10_000)
    expect(tech?.pct).toBeCloseTo(0.9)
  })

  it('labels empty sector as Unknown', () => {
    const holdings = [makeHolding('h1', 'A', 10_000, { sector: '' })]
    const r = calculateSectorExposure(holdings)
    expect(r[0].label).toBe('Unknown')
  })
})

describe('calculateCurrencyExposure', () => {
  it('aggregates by currency', () => {
    const holdings = [
      makeHolding('h1', 'A', 70_000, { currency: 'USD' }),
      makeHolding('h2', 'B', 30_000, { currency: 'CAD' }),
    ]
    const r = calculateCurrencyExposure(holdings)
    const usd = r.find(b => b.label === 'USD')
    expect(usd?.pct).toBeCloseTo(0.7)
  })
})

// ─── Drawdown ─────────────────────────────────────────────────────────────────

describe('calculateDrawdown', () => {
  it('returns INSUFFICIENT_DATA for fewer than 2 snapshots', () => {
    expect(calculateDrawdown([]).trustMode).toBe('INSUFFICIENT_DATA')
    expect(calculateDrawdown([makeNav('2024-01-01', 100_000)]).trustMode).toBe('INSUFFICIENT_DATA')
  })

  it('returns 0 drawdown when current NAV equals all-time peak', () => {
    const snapshots = [
      makeNav('2024-01-01', 100_000),
      makeNav('2024-06-01', 110_000),
      makeNav('2024-12-31', 110_000), // still at peak
    ]
    const r = calculateDrawdown(snapshots)
    expect(r.trustMode).toBe('TRUSTED')
    expect(r.currentDrawdown).toBeCloseTo(0)
  })

  it('calculates correct drawdown percentage', () => {
    const snapshots = [
      makeNav('2024-01-01', 100_000),
      makeNav('2024-06-01', 120_000), // peak
      makeNav('2024-12-31', 108_000), // -10% from peak
    ]
    const r = calculateDrawdown(snapshots)
    expect(r.currentDrawdown).toBeCloseTo(-0.1)
    expect(r.peakNav).toBe(120_000)
    expect(r.peakDate).toBe('2024-06-01')
  })

  it('identifies peak date correctly', () => {
    const snapshots = [
      makeNav('2024-03-01', 90_000),
      makeNav('2024-07-01', 130_000), // peak is here, not at end
      makeNav('2024-12-31', 110_000),
    ]
    const r = calculateDrawdown(snapshots)
    expect(r.peakDate).toBe('2024-07-01')
  })
})

// ─── Volatility ───────────────────────────────────────────────────────────────

describe('calculateVolatility', () => {
  it('returns INSUFFICIENT_DATA with fewer than 20 snapshots', () => {
    const few = Array.from({ length: 10 }, (_, i) => makeNav(`2024-01-${String(i + 1).padStart(2, '0')}`, 100_000))
    const r = calculateVolatility(few)
    expect(r.trustMode).toBe('INSUFFICIENT_DATA')
    expect(r.annualizedVol).toBeNull()
  })

  it('returns TRUSTED with 20+ snapshots', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      makeNav(`2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
        100_000 + (i % 5) * 1_000)
    )
    const r = calculateVolatility(many)
    expect(r.trustMode).toBe('TRUSTED')
    expect(r.annualizedVol).not.toBeNull()
    expect(r.annualizedVol!).toBeGreaterThan(0)
  })

  it('annualizedVol is 0 for perfectly flat NAV', () => {
    const flat = Array.from({ length: 25 }, (_, i) =>
      makeNav(`2024-01-${String(i + 1).padStart(2, '0')}`, 100_000)
    )
    const r = calculateVolatility(flat)
    expect(r.annualizedVol).toBeCloseTo(0)
  })
})

// ─── Beta ─────────────────────────────────────────────────────────────────────

describe('calculateBeta', () => {
  it('returns INSUFFICIENT_DATA with insufficient overlap', () => {
    const navs = [makeNav('2024-01-01', 100_000), makeNav('2024-01-02', 101_000)]
    const bench = [makeBench('2024-01-01', 400), makeBench('2024-01-02', 402)]
    const r = calculateBeta(navs, bench)
    expect(r.trustMode).toBe('INSUFFICIENT_DATA')
  })

  it('returns beta exactly 1.0 when portfolio and benchmark use identical varying returns', () => {
    // Key: must use VARYING (non-constant) returns so variance > 0.
    // With pr[i] == br[i] for every period:
    //   Cov(pr, br) = E[(r - mean_r)^2] = Var(r)
    //   Var(br)     = E[(r - mean_r)^2] = Var(r)
    //   beta = Var(r) / Var(r) = 1.0 exactly
    //
    // Rounding was the bug: Math.round() corrupted the return series so pr[i] ≠ br[i],
    // destroying the 1.0 relationship. Use exact floating-point values.
    const dailyReturns = [
      0.012, -0.008, 0.015, -0.005, 0.020, -0.010, 0.007,
      0.003, -0.009, 0.018, 0.004, -0.006, 0.011, -0.013,
      0.016, -0.007, 0.009, 0.002, -0.004, 0.014, -0.011,
      0.006, 0.019, -0.008, 0.005,
    ]
    const navs: NAVSnapshot[] = []
    const bench: BenchmarkPrice[] = []
    let nav = 100_000
    let price = 400
    for (let i = 0; i <= dailyReturns.length; i++) {
      const date = `2024-01-${String(i + 1).padStart(2, '0')}`
      navs.push(makeNav(date, nav))    // exact — no rounding
      bench.push(makeBench(date, price)) // exact — no rounding
      if (i < dailyReturns.length) {
        nav   *= (1 + dailyReturns[i])
        price *= (1 + dailyReturns[i])
      }
    }
    const r = calculateBeta(navs, bench)
    expect(r.trustMode).toBe('TRUSTED')
    expect(r.beta).not.toBeNull()
    expect(r.beta!).toBeCloseTo(1.0, 5) // accurate to 5 decimal places with exact inputs
  })

  it('returns beta ~2.0 when portfolio returns are 2× benchmark returns', () => {
    // With pr[i] = 2 * br[i]:
    //   Cov(pr, br) = E[(2r - 2*mean_r)(r - mean_r)] = 2 * Var(r)
    //   Var(br)     = Var(r)
    //   beta = 2 * Var(r) / Var(r) = 2.0 exactly
    const benchReturns = [
      0.010, -0.006, 0.014, -0.004, 0.018, -0.009, 0.006,
      0.003, -0.008, 0.016, 0.005, -0.007, 0.012, -0.011,
      0.015, -0.006, 0.008, 0.002, -0.005, 0.013, -0.009,
      0.007, 0.017, -0.007, 0.004,
    ]
    const navs: NAVSnapshot[] = []
    const bench: BenchmarkPrice[] = []
    let nav = 100_000
    let price = 400
    for (let i = 0; i <= benchReturns.length; i++) {
      const date = `2024-01-${String(i + 1).padStart(2, '0')}`
      navs.push(makeNav(date, nav))
      bench.push(makeBench(date, price))
      if (i < benchReturns.length) {
        nav   *= (1 + benchReturns[i] * 2) // 2× leverage
        price *= (1 + benchReturns[i])
      }
    }
    const r = calculateBeta(navs, bench)
    expect(r.trustMode).toBe('TRUSTED')
    expect(r.beta).not.toBeNull()
    expect(r.beta!).toBeCloseTo(2.0, 5)
  })

  it('returns INSUFFICIENT_DATA when benchmark dates do not overlap', () => {
    const navs  = Array.from({ length: 25 }, (_, i) => makeNav(`2024-01-${String(i + 1).padStart(2, '0')}`, 100_000 + i * 100))
    const bench = Array.from({ length: 25 }, (_, i) => makeBench(`2025-06-${String(i + 1).padStart(2, '0')}`, 400 + i))
    const r = calculateBeta(navs, bench)
    expect(r.trustMode).toBe('INSUFFICIENT_DATA')
  })
})

// ─── Risk flags ───────────────────────────────────────────────────────────────

describe('buildRiskFlags', () => {
  const highConcentration: ConcentrationMetric = { top1Pct: 0.5, top3Pct: 0.85, top5Pct: 1.0, level: 'HIGH' }
  const lowConcentration:  ConcentrationMetric = { top1Pct: 0.1, top3Pct: 0.2,  top5Pct: 0.35, level: 'LOW' }
  const sectorSafe   = [{ label: 'Technology', value: 30_000, pct: 0.30 }]
  const sectorHeavy  = [{ label: 'Technology', value: 80_000, pct: 0.80 }]
  const currencySafe = [{ label: 'USD', value: 40_000, pct: 0.40 }]
  const noDrawdown:  DrawdownMetric = { currentDrawdown: 0,    peakNav: 100_000, peakDate: '2024-01-01', currentNav: 100_000, trustMode: 'TRUSTED' }
  const badDrawdown: DrawdownMetric = { currentDrawdown: -0.15, peakNav: 100_000, peakDate: '2024-01-01', currentNav: 85_000,  trustMode: 'TRUSTED' }
  const betaOk:      BetaMetric     = { beta: 1.0, overlapDays: 50, trustMode: 'TRUSTED' }
  const betaMissing: BetaMetric     = { beta: null, overlapDays: 5, trustMode: 'INSUFFICIENT_DATA' }

  it('flags HIGH concentration when top3 exceeds threshold', () => {
    const flags = buildRiskFlags(highConcentration, sectorSafe, currencySafe, noDrawdown, betaOk)
    expect(flags.some(f => f.id === 'concentration_high')).toBe(true)
  })

  it('does not flag concentration when top3 is below threshold', () => {
    const flags = buildRiskFlags(lowConcentration, sectorSafe, currencySafe, noDrawdown, betaOk)
    expect(flags.some(f => f.id === 'concentration_high')).toBe(false)
  })

  it('flags sector concentration when dominant sector exceeds threshold', () => {
    const flags = buildRiskFlags(lowConcentration, sectorHeavy, currencySafe, noDrawdown, betaOk)
    expect(flags.some(f => f.id === 'sector_concentration')).toBe(true)
  })

  it('flags drawdown when current drawdown exceeds 10%', () => {
    const flags = buildRiskFlags(lowConcentration, sectorSafe, currencySafe, badDrawdown, betaOk)
    expect(flags.some(f => f.id === 'drawdown_warning')).toBe(true)
  })

  it('does not flag drawdown when within threshold', () => {
    const flags = buildRiskFlags(lowConcentration, sectorSafe, currencySafe, noDrawdown, betaOk)
    expect(flags.some(f => f.id === 'drawdown_warning')).toBe(false)
  })

  it('flags beta unavailable when trustMode is INSUFFICIENT_DATA', () => {
    const flags = buildRiskFlags(lowConcentration, sectorSafe, currencySafe, noDrawdown, betaMissing)
    expect(flags.some(f => f.id === 'beta_unavailable')).toBe(true)
  })

  it('caps flags at maxRiskFlags (5)', () => {
    const flags = buildRiskFlags(highConcentration, sectorHeavy, currencySafe, badDrawdown, betaMissing)
    expect(flags.length).toBeLessThanOrEqual(5)
  })
})
