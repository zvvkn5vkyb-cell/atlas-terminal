import type { IMarketDataProvider } from './MarketDataProvider'
import { MockMarketDataProvider } from './MockMarketDataProvider'
import { PolygonMarketDataProvider } from './PolygonMarketDataProvider'
import { CanadianMarketDataProvider } from './CanadianMarketDataProvider'
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

const CANADIAN_RE = /\.(TO|TSX|V)$/i

export class MarketDataRouter implements IMarketDataProvider {
  readonly name = 'MarketDataRouter'
  readonly dataSource: DataSource

  private readonly polygon: PolygonMarketDataProvider
  private readonly canadian: CanadianMarketDataProvider
  private readonly mock: MockMarketDataProvider
  private readonly usePolygon: boolean

  constructor(usePolygon: boolean) {
    this.usePolygon = usePolygon
    this.dataSource = usePolygon ? 'HYBRID' : 'MOCK'
    this.mock = new MockMarketDataProvider()
    this.canadian = new CanadianMarketDataProvider()
    this.polygon = new PolygonMarketDataProvider()
  }

  private get usProvider(): IMarketDataProvider {
    return this.usePolygon ? this.polygon : this.mock
  }

  // Market overview always served from mock
  getIndices(): IndexCard[] { return this.mock.getIndices() }
  getFxRates(): FxRate[] { return this.mock.getFxRates() }
  getCommodities(): CommodityQuote[] { return this.mock.getCommodities() }
  getRates(): RateQuote[] { return this.mock.getRates() }
  getMovers(): MarketMovers { return this.mock.getMovers() }
  getMarketBreadth(): MarketBreadth { return this.mock.getMarketBreadth() }

  getQuote(symbol: string): Promise<Quote> {
    if (CANADIAN_RE.test(symbol)) return this.canadian.getQuote(symbol)
    return this.usProvider.getQuote(symbol)
  }

  getHistoricalPrices(symbol: string, range: PriceRange): Promise<HistoricalPricesResult> {
    if (CANADIAN_RE.test(symbol)) return this.canadian.getHistoricalPrices(symbol, range)
    return this.usProvider.getHistoricalPrices(symbol, range)
  }

  getProviderHealth(): ProviderHealth[] {
    const polygonHealth = this.polygon
      .getProviderHealth()
      .filter(h => h.providerId === 'polygon')

    const mockHealth = this.mock
      .getProviderHealth()
      .filter(h => h.providerId === 'mock')
      .map(h => ({ ...h, name: `${h.name} (fallback)` }))

    const canadianHealth = this.canadian.getProviderHealth()

    return [...polygonHealth, ...mockHealth, ...canadianHealth]
  }
}
