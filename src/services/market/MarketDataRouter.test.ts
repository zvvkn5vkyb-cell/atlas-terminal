import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MarketDataRouter } from './MarketDataRouter'

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response)
}

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

beforeEach(() => {
  vi.stubEnv('VITE_POLYGON_API_KEY', 'test-key-abc')
  vi.spyOn(console, 'debug').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ─── U.S. symbol routing ──────────────────────────────────────────────────────

describe('routing — U.S. symbols via Polygon', () => {
  it('AAPL routes to Polygon (provider field is Polygon.io)', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      status: 'OK',
      resultsCount: 3,
      results: mockBars(3),
    }))
    const router = new MarketDataRouter(true)
    const result = await router.getHistoricalPrices('AAPL', '1M')

    expect(result.provider).toBe('Polygon.io')
    expect(result.trustMode).toBe('TRUSTED')
  })

  it('MSFT routes to Polygon (provider field is Polygon.io)', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      status: 'OK',
      resultsCount: 5,
      results: mockBars(5),
    }))
    const router = new MarketDataRouter(true)
    const result = await router.getHistoricalPrices('MSFT', '1M')

    expect(result.provider).toBe('Polygon.io')
    expect(result.trustMode).toBe('TRUSTED')
  })

  it('AAPL uses fetch when Polygon is enabled', async () => {
    const fetchMock = mockFetchOk({ status: 'OK', resultsCount: 2, results: mockBars(2) })
    vi.stubGlobal('fetch', fetchMock)
    const router = new MarketDataRouter(true)
    await router.getHistoricalPrices('AAPL', '1M')

    expect(fetchMock).toHaveBeenCalled()
  })

  it('MSFT does not call fetch when Polygon is disabled (falls back to Mock)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const router = new MarketDataRouter(false)
    const result = await router.getHistoricalPrices('MSFT', '1M')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.provider).toBe('MockMarketDataProvider')
  })
})

// ─── Canadian symbol routing ──────────────────────────────────────────────────

describe('routing — Canadian symbols via CanadianMarketDataProvider', () => {
  it('RY.TO routes to Canadian provider (fallbackReason)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const router = new MarketDataRouter(true)
    const result = await router.getHistoricalPrices('RY.TO', '1M')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.trustMode).toBe('DEGRADED')
    expect(result.fallbackReason).toBe('Real-time Canadian data requires configured provider')
  })

  it('TD.TO routes to Canadian provider (fallbackReason)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const router = new MarketDataRouter(true)
    const result = await router.getHistoricalPrices('TD.TO', '1M')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.trustMode).toBe('DEGRADED')
    expect(result.fallbackReason).toBe('Real-time Canadian data requires configured provider')
  })

  it('symbol ending in .TSX routes to Canadian provider', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const router = new MarketDataRouter(true)
    const result = await router.getHistoricalPrices('SU.TSX', '1M')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.fallbackReason).toBe('Real-time Canadian data requires configured provider')
  })

  it('symbol ending in .V routes to Canadian provider', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const router = new MarketDataRouter(true)
    const result = await router.getHistoricalPrices('ABC.V', '1M')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.fallbackReason).toBe('Real-time Canadian data requires configured provider')
  })

  it('Canadian quote returns DEGRADED trustMode', async () => {
    const router = new MarketDataRouter(true)
    const quote = await router.getQuote('RY.TO')

    expect(quote.trustMode).toBe('DEGRADED')
    expect(quote.exchange).toMatch(/not configured/i)
  })
})

// ─── Unknown / unsupported symbol fallback ────────────────────────────────────

describe('routing — unknown symbol degrades safely', () => {
  it('unknown symbol without suffix falls back to Mock when Polygon is disabled', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const router = new MarketDataRouter(false)
    const result = await router.getHistoricalPrices('UNKNOWN_XYZ', '1M')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.bars.length).toBeGreaterThan(0) // mock bars always provided
  })

  it('unknown symbol with Polygon enabled degrades on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    const router = new MarketDataRouter(true)
    const result = await router.getHistoricalPrices('UNKN', '1M')

    expect(result.trustMode).toBe('DEGRADED')
    expect(result.bars.length).toBeGreaterThan(0) // fallback bars still provided
  })
})

// ─── Provider health ──────────────────────────────────────────────────────────

describe('getProviderHealth', () => {
  it('includes Polygon, Mock fallback, and Canadian entries', () => {
    const router = new MarketDataRouter(true)
    const health = router.getProviderHealth()
    const ids = health.map(h => h.providerId)

    expect(ids).toContain('polygon')
    expect(ids).toContain('mock')
    expect(ids).toContain('canadian')
  })

  it('shows Polygon UP when API key is present', () => {
    const router = new MarketDataRouter(true)
    const health = router.getProviderHealth()
    const pg = health.find(h => h.providerId === 'polygon')

    expect(pg?.status).toBe('UP')
  })

  it('shows Polygon DOWN when API key is absent', () => {
    vi.stubEnv('VITE_POLYGON_API_KEY', '')
    const router = new MarketDataRouter(true)
    const health = router.getProviderHealth()
    const pg = health.find(h => h.providerId === 'polygon')

    expect(pg?.status).toBe('DOWN')
  })

  it('shows Canadian provider as DEGRADED', () => {
    const router = new MarketDataRouter(true)
    const health = router.getProviderHealth()
    const ca = health.find(h => h.providerId === 'canadian')

    expect(ca?.status).toBe('DEGRADED')
    expect(ca?.errorMessage).toMatch(/not configured/i)
  })

  it('Mock fallback entry name includes "fallback"', () => {
    const router = new MarketDataRouter(false)
    const health = router.getProviderHealth()
    const mock = health.find(h => h.providerId === 'mock')

    expect(mock?.name).toMatch(/fallback/i)
  })

  it('does not expose alpha_vantage phantom entry', () => {
    const router = new MarketDataRouter(true)
    const health = router.getProviderHealth()
    const hasPhantom = health.some(h => h.providerId === 'alpha_vantage')

    expect(hasPhantom).toBe(false)
  })
})

// ─── Market overview stays on mock ───────────────────────────────────────────

describe('market overview always served from mock', () => {
  it('getIndices returns non-empty array without calling fetch', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const router = new MarketDataRouter(true)
    const indices = router.getIndices()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(indices.length).toBeGreaterThan(0)
  })
})
