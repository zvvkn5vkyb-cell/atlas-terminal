import type { IMarketDataProvider } from './MarketDataProvider'
import { MarketDataRouter } from './MarketDataRouter'
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
import type { DataSource, MarketMovers } from './types'

function buildProvider(): IMarketDataProvider {
  const requested = (import.meta.env.VITE_MARKET_PROVIDER as string | undefined)?.toLowerCase()
  return new MarketDataRouter(requested === 'polygon')
}

export class MarketDataService {
  private static instance: MarketDataService
  private provider: IMarketDataProvider

  private constructor(provider: IMarketDataProvider) {
    this.provider = provider
  }

  static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService(buildProvider())
    }
    return MarketDataService.instance
  }

  static setProvider(provider: IMarketDataProvider): void {
    MarketDataService.getInstance().provider = provider
  }

  get dataSource(): DataSource { return this.provider.dataSource }
  get providerName(): string { return this.provider.name }

  getIndices(): IndexCard[] { return this.provider.getIndices() }
  getFxRates(): FxRate[] { return this.provider.getFxRates() }
  getCommodities(): CommodityQuote[] { return this.provider.getCommodities() }
  getRates(): RateQuote[] { return this.provider.getRates() }
  getMovers(): MarketMovers { return this.provider.getMovers() }
  getMarketBreadth(): MarketBreadth { return this.provider.getMarketBreadth() }
  getQuote(symbol: string): Promise<Quote> { return this.provider.getQuote(symbol) }
  getHistoricalPrices(symbol: string, range: PriceRange): Promise<HistoricalPricesResult> {
    return this.provider.getHistoricalPrices(symbol, range)
  }
  getProviderHealth(): ProviderHealth[] { return this.provider.getProviderHealth() }
}
