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
} from './types'
import type { DataSource, MarketMovers } from './types'

export class MarketDataService {
  private static instance: MarketDataService
  private provider: IMarketDataProvider

  private constructor(provider: IMarketDataProvider) {
    this.provider = provider
  }

  static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService(new MockMarketDataProvider())
    }
    return MarketDataService.instance
  }

  /** Swap the underlying provider (e.g. when wiring a live API later). */
  static setProvider(provider: IMarketDataProvider): void {
    MarketDataService.getInstance().provider = provider
  }

  get dataSource(): DataSource {
    return this.provider.dataSource
  }

  get providerName(): string {
    return this.provider.name
  }

  getIndices(): IndexCard[] {
    return this.provider.getIndices()
  }

  getFxRates(): FxRate[] {
    return this.provider.getFxRates()
  }

  getCommodities(): CommodityQuote[] {
    return this.provider.getCommodities()
  }

  getRates(): RateQuote[] {
    return this.provider.getRates()
  }

  getMovers(): MarketMovers {
    return this.provider.getMovers()
  }

  getMarketBreadth(): MarketBreadth {
    return this.provider.getMarketBreadth()
  }

  getQuote(symbol: string): Quote {
    return this.provider.getQuote(symbol)
  }

  getProviderHealth(): ProviderHealth[] {
    return this.provider.getProviderHealth()
  }
}
