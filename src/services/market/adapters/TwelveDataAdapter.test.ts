import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TwelveDataAdapter } from './TwelveDataAdapter'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response)
}

function mockFetchStatus(status: number) {
  return vi.fn().mockResolvedValue({ ok: false, status, json: () => Promise.resolve({}) } as unknown as Response)
}

function twelveQuote(overrides: Record<string, unknown> = {}) {
  return {
    symbol: 'RY',
    name: 'Royal Bank of Canada',
    exchange: 'TSX',
    currency: 'CAD',
    close: '132.50',
    change: '1.20',
    percent_change: '0.91',
    volume: '4200000',
    datetime: '2024-01-15 16:00:00',
    ...overrides,
  }
}

function twelveBar(datetime: string, close: string): Record<string, string> {
  return { datetime, open: '130.00', high: '133.00', low: '129.50', close, volume: '1000000' }
}

function twelveTimeSeries(values: ReturnType<typeof twelveBar>[]) {
  return {
    meta: { symbol: 'RY', interval: '1day', currency: 'CAD', exchange_timezone: 'America/Toronto', exchange: 'TSX', type: 'Common Stock' },
    values,
    status: 'ok',
  }
}

beforeEach(() => {
  vi.stubEnv('VITE_TWELVE_DATA_API_KEY', 'test-key-td')
  vi.spyOn(console, 'debug').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ─── No API key ───────────────────────────────────────────────────────────────

describe('no API key configured', () => {
  beforeEach(() => vi.stubEnv('VITE_TWELVE_DATA_API_KEY', ''))

  it('getQuote returns DEGRADED without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new TwelveDataAdapter()
    const quote = await adapter.getQuote('RY.TO')

    expect(quote.trustMode).toBe('DEGRADED')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('getHistoricalPrices returns DEGRADED without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new TwelveDataAdapter()
    const result = await adapter.getHistoricalPrices('RY.TO', '1M')

    expect(result.trustMode).toBe('DEGRADED')
    expect(result.fallbackReason).toMatch(/not configured/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('getProviderHealth reports DOWN', () => {
    const adapter = new TwelveDataAdapter()
    const health = adapter.getProviderHealth()

    expect(health.status).toBe('DOWN')
    expect(health.providerId).toBe('twelve_data')
  })
})

// ─── Non-Canadian symbols ─────────────────────────────────────────────────────

describe('non-Canadian symbol rejection', () => {
  it('getQuote degrades for AAPL without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new TwelveDataAdapter()
    const quote = await adapter.getQuote('AAPL')

    expect(quote.trustMode).toBe('DEGRADED')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('getHistoricalPrices degrades for MSFT without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new TwelveDataAdapter()
    const result = await adapter.getHistoricalPrices('MSFT', '1M')

    expect(result.trustMode).toBe('DEGRADED')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('getQuote degrades for empty string', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const adapter = new TwelveDataAdapter()
    const quote = await adapter.getQuote('')

    expect(quote.trustMode).toBe('DEGRADED')
  })
})

// ─── Successful responses ─────────────────────────────────────────────────────

describe('successful quote fetch', () => {
  it('returns TRUSTED quote with parsed price', async () => {
    vi.stubGlobal('fetch', mockFetchOk(twelveQuote()))
    const adapter = new TwelveDataAdapter()
    const quote = await adapter.getQuote('RY.TO')

    expect(quote.trustMode).toBe('TRUSTED')
    expect(quote.symbol).toBe('RY.TO')
    expect(quote.price).toBeCloseTo(132.50)
    expect(quote.change).toBeCloseTo(1.20)
    expect(quote.changePct).toBeCloseTo(0.91)
    expect(quote.currency).toBe('CAD')
    expect(quote.name).toBe('Royal Bank of Canada')
  })

  it('uses symbol as name when name is missing from response', async () => {
    vi.stubGlobal('fetch', mockFetchOk(twelveQuote({ name: undefined })))
    const adapter = new TwelveDataAdapter()
    const quote = await adapter.getQuote('RY.TO')

    expect(quote.name).toBe('RY.TO')
  })
})

describe('successful history fetch', () => {
  it('returns TRUSTED result with correct bar count', async () => {
    const bars = [
      twelveBar('2024-01-13', '130.00'),
      twelveBar('2024-01-14', '131.00'),
      twelveBar('2024-01-15', '132.50'),
    ]
    vi.stubGlobal('fetch', mockFetchOk(twelveTimeSeries(bars)))
    const adapter = new TwelveDataAdapter()
    const result = await adapter.getHistoricalPrices('RY.TO', '1M')

    expect(result.trustMode).toBe('TRUSTED')
    expect(result.bars.length).toBe(3)
    expect(result.provider).toBe('Twelve Data')
    expect(result.isStale).toBe(false)
  })

  it('parses numeric fields from string values', async () => {
    const bars = [twelveBar('2024-01-15', '132.50')]
    vi.stubGlobal('fetch', mockFetchOk(twelveTimeSeries(bars)))
    const adapter = new TwelveDataAdapter()
    const result = await adapter.getHistoricalPrices('TD.TO', '1M')

    const bar = result.bars[0]
    expect(typeof bar.open).toBe('number')
    expect(typeof bar.close).toBe('number')
    expect(typeof bar.volume).toBe('number')
    expect(bar.close).toBeCloseTo(132.50)
  })
})

// ─── HTTP error codes ─────────────────────────────────────────────────────────

describe('HTTP error handling', () => {
  it('429 rate limit → DEGRADED with rate limit message', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(429))
    const adapter = new TwelveDataAdapter()
    const quote = await adapter.getQuote('RY.TO')

    expect(quote.trustMode).toBe('DEGRADED')
    expect(quote.exchange).toMatch(/rate limit/i)
  })

  it('401 → DEGRADED with key rejected message', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(401))
    const adapter = new TwelveDataAdapter()
    const quote = await adapter.getQuote('RY.TO')

    expect(quote.trustMode).toBe('DEGRADED')
    expect(quote.exchange).toMatch(/key rejected/i)
  })

  it('403 → DEGRADED with key rejected message', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(403))
    const adapter = new TwelveDataAdapter()
    const result = await adapter.getHistoricalPrices('RY.TO', '1M')

    expect(result.trustMode).toBe('DEGRADED')
    expect(result.fallbackReason).toMatch(/key rejected/i)
  })

  it('500 → DEGRADED', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(500))
    const adapter = new TwelveDataAdapter()
    const result = await adapter.getHistoricalPrices('RY.TO', '1M')

    expect(result.trustMode).toBe('DEGRADED')
  })
})

// ─── Network errors ───────────────────────────────────────────────────────────

describe('network error handling', () => {
  it('getQuote degrades on fetch rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    const adapter = new TwelveDataAdapter()
    const quote = await adapter.getQuote('RY.TO')

    expect(quote.trustMode).toBe('DEGRADED')
    expect(quote.exchange).toMatch(/failed to fetch/i)
  })

  it('getHistoricalPrices degrades on fetch rejection with mock fallback bars', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    const adapter = new TwelveDataAdapter()
    const result = await adapter.getHistoricalPrices('RY.TO', '1M')

    expect(result.trustMode).toBe('DEGRADED')
    expect(result.bars.length).toBeGreaterThan(0)
    expect(result.fallbackReason).toMatch(/failed to fetch/i)
  })
})

// ─── Malformed responses ──────────────────────────────────────────────────────

describe('malformed response handling', () => {
  it('quote missing close field → DEGRADED', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ symbol: 'RY', name: 'Royal Bank' }))
    const adapter = new TwelveDataAdapter()
    const quote = await adapter.getQuote('RY.TO')

    expect(quote.trustMode).toBe('DEGRADED')
  })

  it('quote with status=error → DEGRADED', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ status: 'error', message: 'Invalid API key' }))
    const adapter = new TwelveDataAdapter()
    const quote = await adapter.getQuote('RY.TO')

    expect(quote.trustMode).toBe('DEGRADED')
  })

  it('history with empty values array → DEGRADED', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ meta: {}, values: [], status: 'ok' }))
    const adapter = new TwelveDataAdapter()
    const result = await adapter.getHistoricalPrices('RY.TO', '1M')

    expect(result.trustMode).toBe('DEGRADED')
  })

  it('history with status=error → DEGRADED', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ status: 'error', message: 'Symbol not found' }))
    const adapter = new TwelveDataAdapter()
    const result = await adapter.getHistoricalPrices('RY.TO', '1M')

    expect(result.trustMode).toBe('DEGRADED')
    expect(result.fallbackReason).toMatch(/symbol not found/i)
  })
})

// ─── Provenance classification ──────────────────────────────────────────────

describe('provenance classification', () => {
  it('successful quote with stale timestamp → STALE provenance', async () => {
    // twelveQuote() datetime is 2024-01-15, far past the staleness threshold
    vi.stubGlobal('fetch', mockFetchOk(twelveQuote()))
    const adapter = new TwelveDataAdapter()
    const quote = await adapter.getQuote('RY.TO')

    expect(quote.provenance?.source).toBe('TWELVE_DATA')
    expect(quote.provenance?.status).toBe('STALE')
  })

  it('successful quote with fresh timestamp → LIVE provenance', async () => {
    vi.stubGlobal('fetch', mockFetchOk(twelveQuote({ datetime: new Date().toISOString() })))
    const adapter = new TwelveDataAdapter()
    const quote = await adapter.getQuote('RY.TO')

    expect(quote.provenance?.status).toBe('LIVE')
  })

  it('successful history → LIVE provenance', async () => {
    vi.stubGlobal('fetch', mockFetchOk(twelveTimeSeries([twelveBar('2024-01-15', '132.50')])))
    const adapter = new TwelveDataAdapter()
    const result = await adapter.getHistoricalPrices('RY.TO', '1M')

    expect(result.provenance?.source).toBe('TWELVE_DATA')
    expect(result.provenance?.status).toBe('LIVE')
  })

  it('no API key → FALLBACK provenance (Canadian placeholder)', async () => {
    vi.stubEnv('VITE_TWELVE_DATA_API_KEY', '')
    vi.stubGlobal('fetch', vi.fn())
    const adapter = new TwelveDataAdapter()
    const quote = await adapter.getQuote('RY.TO')

    expect(quote.provenance?.status).toBe('FALLBACK')
    expect(quote.provenance?.source).toBe('CANADIAN_PLACEHOLDER')
  })

  it('non-Canadian symbol → FALLBACK provenance', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const adapter = new TwelveDataAdapter()
    const quote = await adapter.getQuote('AAPL')

    expect(quote.provenance?.status).toBe('FALLBACK')
  })

  it('network failure → ERROR provenance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    const adapter = new TwelveDataAdapter()
    const quote = await adapter.getQuote('RY.TO')

    expect(quote.provenance?.status).toBe('ERROR')
  })

  it('history HTTP 403 → ERROR provenance', async () => {
    vi.stubGlobal('fetch', mockFetchStatus(403))
    const adapter = new TwelveDataAdapter()
    const result = await adapter.getHistoricalPrices('RY.TO', '1M')

    expect(result.provenance?.status).toBe('ERROR')
  })

  it('history empty values → ERROR provenance', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ meta: {}, values: [], status: 'ok' }))
    const adapter = new TwelveDataAdapter()
    const result = await adapter.getHistoricalPrices('RY.TO', '1M')

    expect(result.provenance?.status).toBe('ERROR')
  })
})

// ─── Caching ──────────────────────────────────────────────────────────────────

describe('caching', () => {
  it('quote cache: second call does not fetch', async () => {
    const fetchMock = mockFetchOk(twelveQuote())
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new TwelveDataAdapter()

    await adapter.getQuote('RY.TO')
    await adapter.getQuote('RY.TO')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('history cache: second call does not fetch', async () => {
    const fetchMock = mockFetchOk(twelveTimeSeries([twelveBar('2024-01-15', '132.50')]))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new TwelveDataAdapter()

    await adapter.getHistoricalPrices('RY.TO', '1M')
    await adapter.getHistoricalPrices('RY.TO', '1M')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('history cache is keyed by symbol+range (different range calls fetch again)', async () => {
    const fetchMock = mockFetchOk(twelveTimeSeries([twelveBar('2024-01-15', '132.50')]))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new TwelveDataAdapter()

    await adapter.getHistoricalPrices('RY.TO', '1M')
    await adapter.getHistoricalPrices('RY.TO', '3M')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

// ─── Provider health ──────────────────────────────────────────────────────────

describe('getProviderHealth', () => {
  it('reports UP when API key is set', () => {
    const adapter = new TwelveDataAdapter()
    expect(adapter.getProviderHealth().status).toBe('UP')
  })

  it('reports DOWN when API key is absent', () => {
    vi.stubEnv('VITE_TWELVE_DATA_API_KEY', '')
    const adapter = new TwelveDataAdapter()
    expect(adapter.getProviderHealth().status).toBe('DOWN')
  })

  it('transitions to DEGRADED after a quote error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))
    const adapter = new TwelveDataAdapter()
    await adapter.getQuote('RY.TO')

    expect(adapter.getProviderHealth().status).toBe('DEGRADED')
    expect(adapter.getProviderHealth().errorMessage).toMatch(/network failure/i)
  })

  it('includes providerId and name', () => {
    const adapter = new TwelveDataAdapter()
    const health = adapter.getProviderHealth()

    expect(health.providerId).toBe('twelve_data')
    expect(health.name).toBe('Twelve Data')
  })
})

// ─── Symbol variants ──────────────────────────────────────────────────────────

describe('Canadian symbol variants', () => {
  it('passes TSX exchange for .TO symbol', async () => {
    const fetchMock = mockFetchOk(twelveQuote())
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new TwelveDataAdapter()
    await adapter.getQuote('RY.TO')

    const calledUrl = (fetchMock.mock.calls[0][0] as string)
    expect(calledUrl).toContain('exchange=TSX')
    expect(calledUrl).toContain('symbol=RY')
  })

  it('passes TSX exchange for .TSX symbol', async () => {
    const fetchMock = mockFetchOk(twelveQuote({ symbol: 'SU' }))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new TwelveDataAdapter()
    await adapter.getQuote('SU.TSX')

    const calledUrl = (fetchMock.mock.calls[0][0] as string)
    expect(calledUrl).toContain('exchange=TSX')
    expect(calledUrl).toContain('symbol=SU')
  })

  it('passes TSXV exchange for .V symbol', async () => {
    const fetchMock = mockFetchOk(twelveQuote({ symbol: 'ABC', exchange: 'TSXV' }))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new TwelveDataAdapter()
    await adapter.getQuote('ABC.V')

    const calledUrl = (fetchMock.mock.calls[0][0] as string)
    expect(calledUrl).toContain('exchange=TSXV')
    expect(calledUrl).toContain('symbol=ABC')
  })
})
