import type { IMarketDataProvider } from './MarketDataProvider'
import { MockMarketDataProvider } from './MockMarketDataProvider'
import type {
  IndexCard,
  FxRate,
  CommodityQuote,
  RateQuote,
  MarketBreadth,
  Quote,
  ProviderHealth,
  HistoricalPricesResult,
  PriceRange,
} from './types'
import type { MarketMovers } from './types'

const NOT_CONFIGURED = 'Canadian market provider not configured'
const REALTIME_UNAVAILABLE = 'Real-time Canadian data requires configured provider'

export class CanadianMarketDataProvider implements IMarketDataProvider {
  readonly name = 'CanadianMarketDataProvider'
  readonly dataSource = 'MOCK' as const

  private readonly fallback = new MockMarketDataProvider()

  getIndices(): IndexCard[] { return this.fallback.getIndices() }
  getFxRates(): FxRate[] { return this.fallback.getFxRates() }
  getCommodities(): CommodityQuote[] { return this.fallback.getCommodities() }
  getRates(): RateQuote[] { return this.fallback.getRates() }
  getMovers(): MarketMovers { return this.fallback.getMovers() }
  getMarketBreadth(): MarketBreadth { return this.fallback.getMarketBreadth() }

  async getQuote(symbol: string): Promise<Quote> {
    const base = await this.fallback.getQuote(symbol)
    return {
      ...base,
      symbol,
      exchange: NOT_CONFIGURED,
      trustMode: 'DEGRADED',
    }
  }

  async getHistoricalPrices(symbol: string, range: PriceRange): Promise<HistoricalPricesResult> {
    const fb = await this.fallback.getHistoricalPrices(symbol, range)
    return {
      ...fb,
      trustMode: 'DEGRADED',
      fallbackReason: REALTIME_UNAVAILABLE,
    }
  }

  getProviderHealth(): ProviderHealth[] {
    return [
      {
        providerId: 'canadian',
        name: 'Canadian Market Data',
        status: 'DEGRADED',
        lastCheck: new Date().toISOString(),
        errorMessage: NOT_CONFIGURED,
      },
    ]
  }
}
