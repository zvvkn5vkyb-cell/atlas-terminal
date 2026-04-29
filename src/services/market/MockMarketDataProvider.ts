import type { IMarketDataProvider } from './MarketDataProvider'
import type {
  IndexCard,
  FxRate,
  CommodityQuote,
  RateQuote,
  MarketBreadth,
  Quote,
  ProviderHealth,
  OHLCVBar,
  HistoricalPricesResult,
  PriceRange,
} from './types'
import type { MarketMovers } from './types'
import {
  MOCK_INDICES,
  MOCK_FX_RATES,
  MOCK_COMMODITIES,
  MOCK_RATES,
  MOCK_MOVERS_UP,
  MOCK_MOVERS_DOWN,
  MOCK_MARKET_BREADTH,
  MOCK_SECURITY_QUOTE,
  MOCK_PROVIDER_HEALTH,
} from '@/lib/mockData'

// Deterministic pseudo-random using sin — same symbol+index always gives same value
function det(seed: number, i: number): number {
  const v = Math.sin(seed * 0.17 + i * 0.91) * 43758.5453
  return v - Math.floor(v)
}

function symbolSeed(symbol: string): number {
  return symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

const BAR_COUNTS: Record<PriceRange, number> = {
  '1D': 13,  // 13 × 30-min bars = 6.5h trading day
  '1W': 5,
  '1M': 21,
  '3M': 63,
  '1Y': 252,
}

function generateMockBars(symbol: string, range: PriceRange): OHLCVBar[] {
  const seed = symbolSeed(symbol)
  const basePrice = 80 + (seed % 420)
  const count = BAR_COUNTS[range]
  const bars: OHLCVBar[] = []
  let price = basePrice

  for (let i = 0; i < count; i++) {
    const drift = (det(seed, i * 3) - 0.48) * 0.018
    const noise = (det(seed, i * 3 + 1) - 0.5) * 0.009
    const change = price * (drift + noise)
    const open = price
    price = Math.max(price + change, basePrice * 0.3)
    const close = price
    const spread = Math.abs(change) * 0.6 + price * 0.002 * det(seed, i * 3 + 2)
    const high = Math.max(open, close) + spread
    const low = Math.min(open, close) - spread
    const volume = Math.round(500_000 + det(seed, i + 100) * 9_500_000)

    let timestamp: string
    if (range === '1D') {
      const base = new Date()
      base.setHours(9, 30, 0, 0)
      const ts = new Date(base.getTime() + i * 30 * 60_000)
      timestamp = ts.toISOString()
    } else {
      const ts = new Date()
      ts.setDate(ts.getDate() - (count - 1 - i))
      timestamp = ts.toISOString().slice(0, 10)
    }

    bars.push({
      timestamp,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    })
  }

  return bars
}

export class MockMarketDataProvider implements IMarketDataProvider {
  readonly name = 'MockMarketDataProvider'
  readonly dataSource = 'MOCK' as const

  getIndices(): IndexCard[] { return MOCK_INDICES }
  getFxRates(): FxRate[] { return MOCK_FX_RATES }
  getCommodities(): CommodityQuote[] { return MOCK_COMMODITIES }
  getRates(): RateQuote[] { return MOCK_RATES }
  getMovers(): MarketMovers { return { up: MOCK_MOVERS_UP, down: MOCK_MOVERS_DOWN } }
  getMarketBreadth(): MarketBreadth { return MOCK_MARKET_BREADTH }

  async getQuote(symbol: string): Promise<Quote> {
    return { ...MOCK_SECURITY_QUOTE, symbol }
  }

  async getHistoricalPrices(symbol: string, range: PriceRange): Promise<HistoricalPricesResult> {
    return {
      symbol,
      range,
      bars: generateMockBars(symbol, range),
      provider: 'MockMarketDataProvider',
      trustMode: 'DEGRADED',
      isStale: false,
    }
  }

  getProviderHealth(): ProviderHealth[] { return MOCK_PROVIDER_HEALTH }
}
