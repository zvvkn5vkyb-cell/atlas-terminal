import type { IMarketDataProvider } from './MarketDataProvider'
import type {
  IndexCard,
  FxRate,
  CommodityQuote,
  RateQuote,
  MarketBreadth,
  Quote,
  ProviderHealth,
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

export class MockMarketDataProvider implements IMarketDataProvider {
  readonly name = 'MockMarketDataProvider'
  readonly dataSource = 'MOCK' as const

  getIndices(): IndexCard[] {
    return MOCK_INDICES
  }

  getFxRates(): FxRate[] {
    return MOCK_FX_RATES
  }

  getCommodities(): CommodityQuote[] {
    return MOCK_COMMODITIES
  }

  getRates(): RateQuote[] {
    return MOCK_RATES
  }

  getMovers(): MarketMovers {
    return { up: MOCK_MOVERS_UP, down: MOCK_MOVERS_DOWN }
  }

  getMarketBreadth(): MarketBreadth {
    return MOCK_MARKET_BREADTH
  }

  async getQuote(symbol: string): Promise<Quote> {
    return { ...MOCK_SECURITY_QUOTE, symbol }
  }

  getProviderHealth(): ProviderHealth[] {
    return MOCK_PROVIDER_HEALTH
  }
}
