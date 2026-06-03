import { describe, it, expect } from 'vitest'
import { MockMarketDataProvider } from './MockMarketDataProvider'

describe('MockMarketDataProvider provenance', () => {
  const provider = new MockMarketDataProvider()

  it('returns MOCK provenance on quotes', async () => {
    const quote = await provider.getQuote('AAPL')
    expect(quote.provenance?.source).toBe('MOCK')
    expect(quote.provenance?.status).toBe('MOCK')
    expect(quote.provenance?.fetchedAt).toBeTruthy()
  })

  it('returns MOCK provenance on historical prices', async () => {
    const result = await provider.getHistoricalPrices('AAPL', '1M')
    expect(result.provenance?.source).toBe('MOCK')
    expect(result.provenance?.status).toBe('MOCK')
  })
})
