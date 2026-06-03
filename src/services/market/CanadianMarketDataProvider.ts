import type { IMarketDataProvider } from './MarketDataProvider'
import { MockMarketDataProvider } from './MockMarketDataProvider'
import type { ICanadianAdapter } from './adapters/ICanadianAdapter'
import { TwelveDataAdapter } from './adapters/TwelveDataAdapter'
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

export class CanadianMarketDataProvider implements IMarketDataProvider {
  readonly name = 'CanadianMarketDataProvider'
  readonly dataSource = 'MOCK' as const

  private readonly fallback = new MockMarketDataProvider()
  private readonly adapter: ICanadianAdapter

  /**
   * @param adapter - Swap to AlphaVantageAdapter, FinnhubAdapter, etc. for comparison.
   *                  Defaults to TwelveDataAdapter.
   */
  constructor(adapter: ICanadianAdapter = new TwelveDataAdapter()) {
    this.adapter = adapter
  }

  // Market overview always served from mock — no Canadian adapter covers indices/FX/commodities
  getIndices(): IndexCard[] { return this.fallback.getIndices() }
  getFxRates(): FxRate[] { return this.fallback.getFxRates() }
  getCommodities(): CommodityQuote[] { return this.fallback.getCommodities() }
  getRates(): RateQuote[] { return this.fallback.getRates() }
  getMovers(): MarketMovers { return this.fallback.getMovers() }
  getMarketBreadth(): MarketBreadth { return this.fallback.getMarketBreadth() }

  // Quote/history (and their provenance envelopes) are produced by the delegated
  // adapter — see TwelveDataAdapter, which emits LIVE / FALLBACK / ERROR
  // provenance. This provider intentionally adds no provenance of its own so the
  // envelope reflects the concrete backend that served the data.
  getQuote(symbol: string): Promise<Quote> {
    return this.adapter.getQuote(symbol)
  }

  getHistoricalPrices(symbol: string, range: PriceRange): Promise<HistoricalPricesResult> {
    return this.adapter.getHistoricalPrices(symbol, range)
  }

  getProviderHealth(): ProviderHealth[] {
    const adapterHealth = this.adapter.getProviderHealth()
    return [{
      providerId: 'canadian',
      name: `Canadian Market Data (${this.adapter.name})`,
      status: adapterHealth.status,
      lastCheck: adapterHealth.lastCheck,
      errorMessage: adapterHealth.errorMessage,
    }]
  }
}
