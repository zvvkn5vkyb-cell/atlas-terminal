import type { ICanadianAdapter } from './ICanadianAdapter'
import { MockMarketDataProvider } from '../MockMarketDataProvider'
import { parseCanadianSymbol } from '../canadianSymbol'
import type { Quote, ProviderHealth } from '../types'
import type { HistoricalPricesResult, PriceRange, OHLCVBar } from '../types'
import {
  createLiveProvenance,
  createErrorProvenance,
  createFallbackProvenance,
} from '@/lib/provenance/provenance'

// ─── Twelve Data response shapes ─────────────────────────────────────────────

interface TwelveDataQuoteResponse {
  symbol?: string
  name?: string
  exchange?: string
  currency?: string
  close?: string
  change?: string
  percent_change?: string
  volume?: string
  datetime?: string
  status?: 'error'
  message?: string
  code?: number
}

interface TwelveDataBar {
  datetime: string
  open: string
  high: string
  low: string
  close: string
  volume: string
}

interface TwelveDataTimeSeriesResponse {
  meta?: {
    symbol: string
    interval: string
    currency: string
    exchange_timezone: string
    exchange: string
    type: string
  }
  values?: TwelveDataBar[]
  status?: string
  message?: string
  code?: number
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TWELVE_DATA_BASE = 'https://api.twelvedata.com'
const QUOTE_CACHE_TTL_MS = 30_000
const HISTORY_CACHE_TTL_MS = 5 * 60_000

// Twelve Data interval + outputsize per PriceRange
const RANGE_PARAMS: Record<PriceRange, { interval: string; outputsize: number }> = {
  '1D': { interval: '5min',  outputsize: 78  },  // ~6.5h trading day
  '1W': { interval: '1h',    outputsize: 40  },
  '1M': { interval: '1day',  outputsize: 22  },
  '3M': { interval: '1day',  outputsize: 65  },
  '1Y': { interval: '1week', outputsize: 52  },
}

// ─── Caches ───────────────────────────────────────────────────────────────────

interface CachedQuote { quote: Quote; fetchedAt: number }
interface CachedHistory { result: HistoricalPricesResult; fetchedAt: number }

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class TwelveDataAdapter implements ICanadianAdapter {
  readonly name = 'TwelveDataAdapter'
  readonly providerId = 'twelve_data'

  private readonly apiKey: string | undefined
  private readonly fallback = new MockMarketDataProvider()
  private readonly quoteCache = new Map<string, CachedQuote>()
  private readonly historyCache = new Map<string, CachedHistory>()
  private lastStatus: 'UP' | 'DEGRADED' | 'DOWN'
  private lastError: string | undefined
  private lastCheck: string

  constructor() {
    this.apiKey = import.meta.env.VITE_TWELVE_DATA_API_KEY as string | undefined
    this.lastStatus = this.apiKey ? 'UP' : 'DOWN'
    this.lastCheck = new Date().toISOString()
  }

  // ─── getQuote ─────────────────────────────────────────────────────────────

  async getQuote(symbol: string): Promise<Quote> {
    const parsed = parseCanadianSymbol(symbol)
    if (!parsed) return this.degradedQuote(symbol, `Not a recognised Canadian symbol: ${symbol}`)
    if (!this.apiKey) return this.degradedQuote(symbol, 'Twelve Data API key not configured')

    const cached = this.quoteCache.get(symbol)
    if (cached && Date.now() - cached.fetchedAt < QUOTE_CACHE_TTL_MS) return cached.quote

    const url =
      `${TWELVE_DATA_BASE}/quote` +
      `?symbol=${encodeURIComponent(parsed.ticker)}` +
      `&exchange=${parsed.exchange}` +
      `&apikey=${this.apiKey}`

    let res: Response
    try { res = await fetch(url) } catch (err) {
      return this.recordQuoteError(symbol, err instanceof Error ? err.message : 'Network error')
    }

    if (res.status === 429) return this.recordQuoteError(symbol, 'Rate limit exceeded (429)')
    if (res.status === 401 || res.status === 403)
      return this.recordQuoteError(symbol, `API key rejected (${res.status})`)
    if (!res.ok) return this.recordQuoteError(symbol, `HTTP ${res.status}`)

    let body: TwelveDataQuoteResponse
    try { body = (await res.json()) as TwelveDataQuoteResponse } catch {
      return this.recordQuoteError(symbol, 'Failed to parse response')
    }

    if (body.status === 'error' || !body.close) {
      return this.recordQuoteError(symbol, body.message ?? 'Unexpected response shape')
    }

    const lastUpdated = body.datetime
      ? new Date(body.datetime).toISOString()
      : new Date().toISOString()

    const quote: Quote = {
      symbol,
      name: body.name ?? symbol,
      price: parseFloat(body.close),
      change: parseFloat(body.change ?? '0'),
      changePct: parseFloat(body.percent_change ?? '0'),
      volume: parseInt(body.volume ?? '0', 10),
      marketCap: undefined,
      currency: body.currency ?? 'CAD',
      exchange: body.exchange ?? parsed.exchange,
      lastUpdated,
      trustMode: 'TRUSTED',
      // asOf drives staleness: Canadian EOD data older than the threshold is
      // truthfully classified STALE rather than LIVE.
      provenance: createLiveProvenance({
        source: 'TWELVE_DATA',
        provider: 'Twelve Data',
        asOf: lastUpdated,
      }),
    }

    this.quoteCache.set(symbol, { quote, fetchedAt: Date.now() })
    this.lastStatus = 'UP'
    this.lastError = undefined
    this.lastCheck = new Date().toISOString()
    return quote
  }

  // ─── getHistoricalPrices ──────────────────────────────────────────────────

  async getHistoricalPrices(symbol: string, range: PriceRange): Promise<HistoricalPricesResult> {
    const parsed = parseCanadianSymbol(symbol)
    if (!parsed) return this.degradedHistory(symbol, range, `Not a recognised Canadian symbol: ${symbol}`)
    if (!this.apiKey) return this.degradedHistory(symbol, range, 'Twelve Data API key not configured')

    const cacheKey = `${symbol}::${range}`
    const cached = this.historyCache.get(cacheKey)
    if (cached && Date.now() - cached.fetchedAt < HISTORY_CACHE_TTL_MS) return cached.result

    const { interval, outputsize } = RANGE_PARAMS[range]
    const url =
      `${TWELVE_DATA_BASE}/time_series` +
      `?symbol=${encodeURIComponent(parsed.ticker)}` +
      `&exchange=${parsed.exchange}` +
      `&interval=${interval}` +
      `&outputsize=${outputsize}` +
      `&order=ASC` +
      `&apikey=${this.apiKey}`

    let res: Response
    try { res = await fetch(url) } catch (err) {
      return this.degradedHistory(symbol, range, err instanceof Error ? err.message : 'Network error', true)
    }

    if (res.status === 429) return this.degradedHistory(symbol, range, 'Rate limit exceeded (429)', true)
    if (res.status === 401 || res.status === 403)
      return this.degradedHistory(symbol, range, `API key rejected (${res.status})`, true)
    if (!res.ok) return this.degradedHistory(symbol, range, `HTTP ${res.status}`, true)

    let body: TwelveDataTimeSeriesResponse
    try { body = (await res.json()) as TwelveDataTimeSeriesResponse } catch {
      return this.degradedHistory(symbol, range, 'Failed to parse response', true)
    }

    if (body.status === 'error' || !body.values?.length) {
      return this.degradedHistory(symbol, range, body.message ?? 'No data returned', true)
    }

    const bars: OHLCVBar[] = body.values.map(b => ({
      timestamp: new Date(b.datetime).toISOString(),
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
      volume: parseInt(b.volume, 10),
    }))

    const result: HistoricalPricesResult = {
      symbol,
      range,
      bars,
      provider: 'Twelve Data',
      trustMode: 'TRUSTED',
      isStale: false,
      provenance: createLiveProvenance({ source: 'TWELVE_DATA', provider: 'Twelve Data' }),
    }

    this.historyCache.set(cacheKey, { result, fetchedAt: Date.now() })
    this.lastStatus = 'UP'
    this.lastError = undefined
    this.lastCheck = new Date().toISOString()
    return result
  }

  // ─── getProviderHealth ────────────────────────────────────────────────────

  getProviderHealth(): ProviderHealth {
    return {
      providerId: this.providerId,
      name: 'Twelve Data',
      status: this.lastStatus,
      lastCheck: this.lastCheck,
      errorMessage: this.lastError,
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // `errored` is true only when a live fetch actually failed (network/HTTP/parse),
  // yielding ERROR provenance. Not-configured / unsupported-symbol cases are
  // FALLBACK (data substituted because no real Canadian source is available).
  private async degradedQuote(symbol: string, reason: string, errored = false): Promise<Quote> {
    const base = await this.fallback.getQuote(symbol)
    return {
      ...base,
      symbol,
      trustMode: 'DEGRADED',
      exchange: reason,
      provenance: errored
        ? createErrorProvenance({ source: 'TWELVE_DATA', provider: 'Twelve Data', error: reason })
        : createFallbackProvenance({
            source: 'CANADIAN_PLACEHOLDER',
            provider: 'Twelve Data (not configured)',
            fallbackReason: reason,
          }),
    }
  }

  private async recordQuoteError(symbol: string, reason: string): Promise<Quote> {
    this.lastStatus = 'DEGRADED'
    this.lastError = reason
    this.lastCheck = new Date().toISOString()
    return this.degradedQuote(symbol, reason, true)
  }

  // `errored` distinguishes a failed live fetch (ERROR) from a not-configured /
  // unsupported-symbol fallback (FALLBACK), mirroring degradedQuote.
  private async degradedHistory(
    symbol: string,
    range: PriceRange,
    reason: string,
    errored = false,
  ): Promise<HistoricalPricesResult> {
    const fb = await this.fallback.getHistoricalPrices(symbol, range)
    return {
      ...fb,
      symbol,
      range,
      provider: 'Twelve Data (mock fallback)',
      trustMode: 'DEGRADED',
      fallbackReason: reason,
      provenance: errored
        ? createErrorProvenance({
            source: 'TWELVE_DATA',
            provider: 'Twelve Data',
            error: reason,
            fallbackReason: 'Served mock bars after Twelve Data fetch failed',
          })
        : createFallbackProvenance({
            source: 'CANADIAN_PLACEHOLDER',
            provider: 'Twelve Data (not configured)',
            fallbackReason: reason,
          }),
    }
  }
}
