import type { IMarketDataProvider } from './MarketDataProvider'
import { MockMarketDataProvider } from './MockMarketDataProvider'
import type {
  IndexCard,
  FxRate,
  CommodityQuote,
  RateQuote,
  MarketBreadth,
  Quote,
  ProviderHealth,
  OHLCVBar,
  HistoricalPricesResult,
  PriceRange,
} from './types'
import type { MarketMovers } from './types'

// ─── Polygon response shapes ──────────────────────────────────────────────────

interface PolygonSnapshotResponse {
  status: string
  ticker?: {
    ticker: string
    todaysChange: number
    todaysChangePerc: number
    updated: number
    day?: { o: number; h: number; l: number; c: number; v: number }
    prevDay?: { c: number }
    lastTrade?: { p: number }
  }
  error?: string
  message?: string
}

interface PolygonAggBar {
  t: number  // Unix ms
  o: number
  h: number
  l: number
  c: number
  v: number
}

interface PolygonAggsResponse {
  status: string
  ticker?: string
  resultsCount?: number
  results?: PolygonAggBar[] | null
  error?: string
  message?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const POLYGON_BASE = 'https://api.polygon.io'
const QUOTE_CACHE_TTL_MS = 30_000
const HISTORY_CACHE_TTL_MS = 5 * 60_000  // 5 min — price bars change slowly
const CANADIAN_RE = /\.(TO|TSX|V)$/i

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function subtractDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() - days)
  return r
}

// Extra calendar days added to each range to absorb weekends / holidays
const RANGE_PARAMS: Record<PriceRange, { calDays: number; multiplier: number; timespan: string }> = {
  '1D':  { calDays: 3,   multiplier: 30, timespan: 'minute' },
  '1W':  { calDays: 9,   multiplier: 1,  timespan: 'day' },
  '1M':  { calDays: 33,  multiplier: 1,  timespan: 'day' },
  '3M':  { calDays: 95,  multiplier: 1,  timespan: 'day' },
  '1Y':  { calDays: 370, multiplier: 1,  timespan: 'day' },
}

// ─── Caches ───────────────────────────────────────────────────────────────────

interface CachedQuote { quote: Quote; fetchedAt: number }
interface CachedHistory { result: HistoricalPricesResult; fetchedAt: number }

export class PolygonMarketDataProvider implements IMarketDataProvider {
  readonly name = 'PolygonMarketDataProvider'
  // HYBRID because non-quote methods still delegate to mock
  readonly dataSource = 'HYBRID' as const

  private readonly apiKey: string | undefined
  private readonly fallback: MockMarketDataProvider
  private readonly quoteCache = new Map<string, CachedQuote>()
  private readonly historyCache = new Map<string, CachedHistory>()
  private lastStatus: 'UP' | 'DEGRADED' | 'DOWN'
  private lastError: string | undefined
  private lastCheck: string

  constructor() {
    this.apiKey = import.meta.env.VITE_POLYGON_API_KEY as string | undefined
    this.fallback = new MockMarketDataProvider()
    this.lastStatus = this.apiKey ? 'UP' : 'DOWN'
    this.lastCheck = new Date().toISOString()
  }

  // ─── Delegated to mock ────────────────────────────────────────────────────

  getIndices(): IndexCard[] { return this.fallback.getIndices() }
  getFxRates(): FxRate[] { return this.fallback.getFxRates() }
  getCommodities(): CommodityQuote[] { return this.fallback.getCommodities() }
  getRates(): RateQuote[] { return this.fallback.getRates() }
  getMovers(): MarketMovers { return this.fallback.getMovers() }
  getMarketBreadth(): MarketBreadth { return this.fallback.getMarketBreadth() }

  // ─── getQuote ─────────────────────────────────────────────────────────────

  async getQuote(symbol: string): Promise<Quote> {
    if (!this.apiKey) return this.degradedQuote(symbol)
    if (CANADIAN_RE.test(symbol)) return this.degradedQuote(symbol)

    const cached = this.quoteCache.get(symbol)
    if (cached && Date.now() - cached.fetchedAt < QUOTE_CACHE_TTL_MS) return cached.quote

    const url = `${POLYGON_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}?apiKey=${this.apiKey}`
    let res: Response
    try { res = await fetch(url) } catch (err) {
      return this.recordQuoteError(symbol, err instanceof Error ? err.message : 'Network error')
    }

    if (res.status === 403) return this.recordQuoteError(symbol, 'API key rejected (403)')
    if (res.status === 404) return this.degradedQuote(symbol)
    if (!res.ok) return this.recordQuoteError(symbol, `HTTP ${res.status}`)

    let body: PolygonSnapshotResponse
    try { body = (await res.json()) as PolygonSnapshotResponse } catch {
      return this.recordQuoteError(symbol, 'Failed to parse response')
    }

    if (body.status !== 'OK' || !body.ticker) {
      return this.recordQuoteError(symbol, body.error ?? body.message ?? 'Unexpected response')
    }

    const t = body.ticker
    const price = t.day?.c ?? t.prevDay?.c ?? t.lastTrade?.p ?? 0
    const updatedMs = t.updated ? Math.floor(t.updated / 1_000_000) : Date.now()

    const quote: Quote = {
      symbol: t.ticker ?? symbol,
      name: symbol,
      price,
      change: t.todaysChange ?? 0,
      changePct: t.todaysChangePerc ?? 0,
      volume: t.day?.v ?? 0,
      marketCap: undefined,
      currency: 'USD',
      exchange: 'Polygon.io',
      lastUpdated: new Date(updatedMs).toISOString(),
      trustMode: 'TRUSTED',
    }

    this.quoteCache.set(symbol, { quote, fetchedAt: Date.now() })
    this.lastStatus = 'UP'
    this.lastError = undefined
    this.lastCheck = new Date().toISOString()
    return quote
  }

  // ─── getHistoricalPrices ──────────────────────────────────────────────────

  async getHistoricalPrices(symbol: string, range: PriceRange): Promise<HistoricalPricesResult> {
    // Canadian symbols — degrade immediately
    if (CANADIAN_RE.test(symbol)) {
      const fb = await this.fallback.getHistoricalPrices(symbol, range)
      return {
        ...fb,
        trustMode: 'DEGRADED',
        fallbackReason: 'Polygon US equities endpoint does not support this symbol',
      }
    }

    if (!this.apiKey) {
      const fb = await this.fallback.getHistoricalPrices(symbol, range)
      return { ...fb, trustMode: 'DEGRADED', fallbackReason: 'API key not configured' }
    }

    const cacheKey = `${symbol}::${range}`
    const cached = this.historyCache.get(cacheKey)
    if (cached && Date.now() - cached.fetchedAt < HISTORY_CACHE_TTL_MS) return cached.result

    const { calDays, multiplier, timespan } = RANGE_PARAMS[range]
    const to = toDateStr(new Date())
    const from = toDateStr(subtractDays(new Date(), calDays))
    const url = `${POLYGON_BASE}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=1000&apiKey=${this.apiKey}`

    let res: Response
    try { res = await fetch(url) } catch (err) {
      return this.degradedHistory(symbol, range, err instanceof Error ? err.message : 'Network error')
    }

    if (res.status === 403) return this.degradedHistory(symbol, range, 'API key rejected (403)')
    if (res.status === 404) return this.degradedHistory(symbol, range, `Symbol not found: ${symbol}`)
    if (!res.ok) return this.degradedHistory(symbol, range, `HTTP ${res.status}`)

    let body: PolygonAggsResponse
    try { body = (await res.json()) as PolygonAggsResponse } catch {
      return this.degradedHistory(symbol, range, 'Failed to parse response')
    }

    if (body.status !== 'OK') {
      return this.degradedHistory(symbol, range, body.error ?? body.message ?? 'Unexpected response')
    }

    const rawBars = body.results ?? []

    if (rawBars.length === 0) {
      // No bars returned (market closed / weekend) — degrade gracefully
      return this.degradedHistory(symbol, range, 'No price data returned for requested range')
    }

    const bars: OHLCVBar[] = rawBars.map(b => ({
      timestamp: new Date(b.t).toISOString(),
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v,
    }))

    const result: HistoricalPricesResult = {
      symbol,
      range,
      bars,
      provider: 'Polygon.io',
      trustMode: 'TRUSTED',
      isStale: false,
    }

    this.historyCache.set(cacheKey, { result, fetchedAt: Date.now() })
    this.lastStatus = 'UP'
    this.lastError = undefined
    this.lastCheck = new Date().toISOString()
    return result
  }

  // ─── getProviderHealth ────────────────────────────────────────────────────

  getProviderHealth(): ProviderHealth[] {
    const polygonHealth: ProviderHealth = {
      providerId: 'polygon',
      name: 'Polygon.io',
      status: this.lastStatus,
      lastCheck: this.lastCheck,
      errorMessage: this.lastError,
    }

    const mockFallback = this.fallback
      .getProviderHealth()
      .filter(p => p.providerId === 'mock')
      .map(p => ({ ...p, name: `${p.name} (fallback)` }))

    return [polygonHealth, ...mockFallback]
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async degradedQuote(symbol: string): Promise<Quote> {
    const base = await this.fallback.getQuote(symbol)
    return { ...base, symbol, trustMode: 'DEGRADED' as const }
  }

  private async recordQuoteError(symbol: string, reason: string): Promise<Quote> {
    this.lastStatus = 'DEGRADED'
    this.lastError = reason
    this.lastCheck = new Date().toISOString()
    return this.degradedQuote(symbol)
  }

  private async degradedHistory(
    symbol: string,
    range: PriceRange,
    reason: string,
  ): Promise<HistoricalPricesResult> {
    const fb = await this.fallback.getHistoricalPrices(symbol, range)
    return { ...fb, trustMode: 'DEGRADED', fallbackReason: reason }
  }
}
