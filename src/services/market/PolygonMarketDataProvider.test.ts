import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PolygonMarketDataProvider } from './PolygonMarketDataProvider'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockBars(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    t: 1_700_000_000_000 + i * 86_400_000,
    o: 100 + i,
    h: 102 + i,
    l: 99 + i,
    c: 101 + i,
    v: 1_000_000,
  }))
}

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response)
}

function mockFetchStatus(status: number, body: unknown = {}) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response)
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubEnv('VITE_POLYGON_API_KEY', 'test-key-abc')
  // Silence dev-mode console.debug calls
  vi.spyOn(console, 'debug').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ─── Provider health ─────────────────────────────────────────────────────────

describe('getProviderHealth', () => {
  it('reports UP when API key is present', () => {
    const provider = new PolygonMarketDataProvider()
    const health = provider.getProviderHealth()
    const pg = health.find(h => h.providerId === 'polygon')
    expect(pg?.status).toBe('UP')
  })

  it('reports DOWN when API key is absent', () => {
    vi.stubEnv('VITE_POLYGON_API_KEY', '')
    const provider = new PolygonMarketDataProvider()
    const health = provider.getProviderHealth()
    const pg = health.find(h => h.providerId === 'polygon')
    expect(pg?.status).toBe('DOWN')
  })

  it('does not include unconfigured stubs from fallback', () => {
    const provider = new PolygonMarketDataProvider()
    const health = provider.getProviderHealth()
    // Must not expose the phantom alpha_vantage/polygon DOWN entries from mock fallback
    const hasPhantom = health.some(h => h.providerId === 'alpha_vantage')
    expect(hasPhantom).toBe(false)
  })
})

// ─── getHistoricalPrices — success cases ─────────────────────────────────────

describe('getHistoricalPrices — DELAYED status (free tier)', () => {
  it('accepts DELAYED status as a successful response', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      status: 'DELAYED',
      resultsCount: 3,
      results: mockBars(3),
    }))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.trustMode).toBe('TRUSTED')
    expect(result.bars).toHaveLength(3)
    expect(result.provider).toBe('Polygon.io')
  })

  it('sets isStale=true for DELAYED response', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      status: 'DELAYED',
      resultsCount: 2,
      results: mockBars(2),
    }))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.isStale).toBe(true)
  })

  it('sets isStale=false for OK response', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      status: 'OK',
      resultsCount: 5,
      results: mockBars(5),
    }))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.trustMode).toBe('TRUSTED')
    expect(result.isStale).toBe(false)
  })

  it('maps bars to OHLCVBar shape correctly', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      status: 'OK',
      resultsCount: 1,
      results: [{ t: 1_700_000_000_000, o: 180, h: 185, l: 179, c: 183, v: 42_000_000 }],
    }))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    const bar = result.bars[0]
    expect(bar.open).toBe(180)
    expect(bar.high).toBe(185)
    expect(bar.low).toBe(179)
    expect(bar.close).toBe(183)
    expect(bar.volume).toBe(42_000_000)
  })
})

describe('getHistoricalPrices — 1D range filters to single day', () => {
  it('returns only bars from the most recent day', async () => {
    // Simulate two days of 30-min bars
    const day1 = Array.from({ length: 13 }, (_, i) => ({
      t: new Date('2024-06-13T14:00:00Z').getTime() + i * 30 * 60_000,
      o: 100, h: 101, l: 99, c: 100, v: 1_000_000,
    }))
    const day2 = Array.from({ length: 13 }, (_, i) => ({
      t: new Date('2024-06-14T14:00:00Z').getTime() + i * 30 * 60_000,
      o: 105, h: 106, l: 104, c: 105, v: 1_000_000,
    }))

    vi.stubGlobal('fetch', mockFetchOk({
      status: 'OK',
      resultsCount: 26,
      results: [...day1, ...day2],
    }))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1D')

    // All returned bars should share the same date
    const dates = new Set(result.bars.map(b => b.timestamp.slice(0, 10)))
    expect(dates.size).toBe(1)
    expect(result.bars).toHaveLength(13)
  })
})

// ─── getHistoricalPrices — degraded cases ────────────────────────────────────

describe('getHistoricalPrices — empty results', () => {
  it('degrades when results are null', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ status: 'OK', resultsCount: 0, results: null }))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.trustMode).toBe('DEGRADED')
    expect(result.fallbackReason).toBeTruthy()
  })

  it('degrades when results array is empty', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ status: 'DELAYED', resultsCount: 0, results: [] }))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.trustMode).toBe('DEGRADED')
    expect(result.fallbackReason).toBeTruthy()
  })

  it('gives specific reason for 1D range with no bars', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ status: 'OK', resultsCount: 0, results: [] }))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1D')

    expect(result.fallbackReason).toMatch(/intraday|closed|market/i)
  })

  it('includes status in reason for unexpected status with no data', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ status: 'NOT_AUTHORIZED', resultsCount: 0, results: null }))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.trustMode).toBe('DEGRADED')
    expect(result.fallbackReason).toMatch(/NOT_AUTHORIZED|status/i)
  })
})

describe('getHistoricalPrices — Canadian tickers', () => {
  it.each(['RY.TO', 'TD.TO', 'XIU.TO', 'ENB.TO'])('%s degrades without calling fetch', async (symbol) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices(symbol, '1M')

    expect(result.trustMode).toBe('DEGRADED')
    expect(result.fallbackReason).toMatch(/not support|Canadian|endpoint/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('getHistoricalPrices — API key absent', () => {
  it('degrades without calling fetch', async () => {
    vi.stubEnv('VITE_POLYGON_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.trustMode).toBe('DEGRADED')
    expect(result.fallbackReason).toMatch(/key|configured/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('getHistoricalPrices — HTTP errors', () => {
  it('returns 403 reason for Forbidden', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(403))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.trustMode).toBe('DEGRADED')
    expect(result.fallbackReason).toContain('403')
  })

  it('returns symbol-specific reason for 404', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(404))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('XXXX', '1M')

    expect(result.trustMode).toBe('DEGRADED')
    expect(result.fallbackReason).toMatch(/not found|XXXX/i)
  })

  it('includes HTTP status in reason for other failures', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(500))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.trustMode).toBe('DEGRADED')
    expect(result.fallbackReason).toContain('500')
  })

  it('degrades on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.trustMode).toBe('DEGRADED')
    expect(result.fallbackReason).toMatch(/fetch|network/i)
  })
})

describe('getHistoricalPrices — fallback bars are always provided', () => {
  it('degraded results still include mock bars for chart rendering', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(403))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    // Even degraded, chart should have something to render
    expect(result.bars.length).toBeGreaterThan(0)
  })
})

// ─── Provenance classification ───────────────────────────────────────────────

describe('provenance — success paths', () => {
  it('quote success → LIVE provenance', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      status: 'OK',
      ticker: {
        ticker: 'AAPL',
        todaysChange: 1,
        todaysChangePerc: 0.5,
        updated: Date.now() * 1_000_000, // ns; maps to ~now → fresh
        day: { o: 184, h: 186, l: 183, c: 185, v: 1_000 },
        prevDay: { c: 184 },
        lastTrade: { p: 185 },
      },
    }))
    const provider = new PolygonMarketDataProvider()
    const quote = await provider.getQuote('AAPL')

    expect(quote.provenance?.source).toBe('POLYGON')
    expect(quote.provenance?.status).toBe('LIVE')
  })

  it('history OK → LIVE provenance', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ status: 'OK', resultsCount: 3, results: mockBars(3) }))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.provenance?.status).toBe('LIVE')
  })

  it('history DELAYED → DELAYED provenance', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ status: 'DELAYED', resultsCount: 3, results: mockBars(3) }))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.provenance?.status).toBe('DELAYED')
  })
})

describe('provenance — fallback vs error classification', () => {
  it('quote missing API key → FALLBACK provenance', async () => {
    vi.stubEnv('VITE_POLYGON_API_KEY', '')
    vi.stubGlobal('fetch', vi.fn())
    const provider = new PolygonMarketDataProvider()
    const quote = await provider.getQuote('AAPL')

    expect(quote.provenance?.status).toBe('FALLBACK')
    expect(quote.provenance?.source).toBe('POLYGON')
  })

  it('quote Canadian symbol → FALLBACK provenance', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const provider = new PolygonMarketDataProvider()
    const quote = await provider.getQuote('RY.TO')

    expect(quote.provenance?.status).toBe('FALLBACK')
  })

  it('quote network failure → ERROR provenance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    const provider = new PolygonMarketDataProvider()
    const quote = await provider.getQuote('AAPL')

    expect(quote.provenance?.status).toBe('ERROR')
    expect(quote.provenance?.error).toMatch(/fetch/i)
  })

  it('history Canadian symbol → FALLBACK provenance', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('RY.TO', '1M')

    expect(result.provenance?.status).toBe('FALLBACK')
  })

  it('history missing API key → FALLBACK provenance', async () => {
    vi.stubEnv('VITE_POLYGON_API_KEY', '')
    vi.stubGlobal('fetch', vi.fn())
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.provenance?.status).toBe('FALLBACK')
  })

  it('history 404 (symbol not found) → FALLBACK provenance', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(404))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('XXXX', '1M')

    expect(result.provenance?.status).toBe('FALLBACK')
  })

  it('history OK with no bars → FALLBACK provenance', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ status: 'OK', resultsCount: 0, results: [] }))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.provenance?.status).toBe('FALLBACK')
  })

  it('history 403 (key rejected) → ERROR provenance', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(403))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.provenance?.status).toBe('ERROR')
  })

  it('history network failure → ERROR provenance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    const provider = new PolygonMarketDataProvider()
    const result = await provider.getHistoricalPrices('AAPL', '1M')

    expect(result.provenance?.status).toBe('ERROR')
  })
})
