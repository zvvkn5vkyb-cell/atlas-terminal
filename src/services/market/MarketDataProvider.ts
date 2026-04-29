import type {
  IndexCard,
  FxRate,
  CommodityQuote,
  RateQuote,
  MarketBreadth,
  Quote,
  ProviderHealth,
} from './types'
import type { DataSource, MarketMovers, PriceRange, HistoricalPricesResult } from './types'

export interface IMarketDataProvider {
  readonly name: string
  readonly dataSource: DataSource

  getIndices(): IndexCard[]
  getFxRates(): FxRate[]
  getCommodities(): CommodityQuote[]
  getRates(): RateQuote[]
  getMovers(): MarketMovers
  getMarketBreadth(): MarketBreadth
  getQuote(symbol: string): Promise<Quote>
  getHistoricalPrices(symbol: string, range: PriceRange): Promise<HistoricalPricesResult>
  getProviderHealth(): ProviderHealth[]
}
