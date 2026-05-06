import type { Quote, ProviderHealth } from '../types'
import type { HistoricalPricesResult, PriceRange } from '../types'

/**
 * Narrow interface that any Canadian data backend must satisfy.
 * CanadianMarketDataProvider accepts one of these and delegates quote/history to it,
 * so swapping Twelve Data for Alpha Vantage or Finnhub is a one-line constructor change.
 */
export interface ICanadianAdapter {
  readonly name: string
  readonly providerId: string

  getQuote(symbol: string): Promise<Quote>
  getHistoricalPrices(symbol: string, range: PriceRange): Promise<HistoricalPricesResult>
  /** Returns a single health record — the provider owns its own status tracking. */
  getProviderHealth(): ProviderHealth
}
