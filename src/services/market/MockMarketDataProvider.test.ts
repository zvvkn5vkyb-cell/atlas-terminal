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

describe('MockMarketDataProvider security master identity (Phase 0C-2)', () => {
  const provider = new MockMarketDataProvider()

  it('returns correct name and USD/NASDAQ metadata for MSFT from security master', async () => {
    const quote = await provider.getQuote('MSFT')
    expect(quote.symbol).toBe('MSFT')
    expect(quote.name).toBe('Microsoft Corp.')
    expect(quote.currency).toBe('USD')
    expect(quote.exchange).toBe('NASDAQ')
  })

  it('returns CAD/TSX metadata for RY.TO from security master', async () => {
    const quote = await provider.getQuote('RY.TO')
    expect(quote.symbol).toBe('RY.TO')
    expect(quote.name).toBe('Royal Bank of Canada')
    expect(quote.currency).toBe('CAD')
    expect(quote.exchange).toBe('TSX')
  })

  it('does not throw for an unknown symbol and preserves safe fallback values', async () => {
    const quote = await provider.getQuote('UNKNOWN_SYMBOL')
    expect(quote.symbol).toBe('UNKNOWN_SYMBOL')
    // Falls back to MOCK_SECURITY_QUOTE values for identity fields
    expect(typeof quote.name).toBe('string')
    expect(quote.name.length).toBeGreaterThan(0)
    expect(typeof quote.currency).toBe('string')
    expect(typeof quote.exchange).toBe('string')
    // Numeric price fields are still present
    expect(typeof quote.price).toBe('number')
    expect(typeof quote.change).toBe('number')
    // Provenance is still MOCK
    expect(quote.provenance?.source).toBe('MOCK')
    expect(quote.provenance?.status).toBe('MOCK')
  })

  it('no longer returns Apple metadata for non-Apple seeded symbols', async () => {
    for (const symbol of ['MSFT', 'SPY', 'GOOGL', 'ENB.TO', 'XIU.TO']) {
      const quote = await provider.getQuote(symbol)
      expect(quote.name, `${symbol} should not report Apple's name`).not.toBe('Apple Inc.')
    }
  })
})
