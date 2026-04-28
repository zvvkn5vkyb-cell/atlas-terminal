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
} from './types'
import type { MarketMovers } from './types'

// Polygon v2 snapshot response shape (partial)
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

const POLYGON_BASE = 'https://api.polygon.io'
const CACHE_TTL_MS = 30_000

interface CachedQuote {
  quote: Quote
  fetchedAt: number
}

export class PolygonMarketDataProvider implements IMarketDataProvider {
  readonly name = 'PolygonMarketDataProvider'
  // HYBRID because non-quote methods still delegate to mock
  readonly dataSource = 'HYBRID' as const

  private readonly apiKey: string | undefined
  private readonly fallback: MockMarketDataProvider
  private readonly cache = new Map<string, CachedQuote>()
  private lastStatus: 'UP' | 'DEGRADED' | 'DOWN'
  private lastError: string | undefined
  private lastCheck: string

  constructor() {
    this.apiKey = import.meta.env.VITE_POLYGON_API_KEY as string | undefined
    this.fallback = new MockMarketDataProvider()
    this.lastStatus = this.apiKey ? 'UP' : 'DOWN'
    this.lastCheck = new Date().toISOString()
  }

  // ─── Delegated to mock (not yet implemented for Polygon) ──────────────────

  getIndices(): IndexCard[] { return this.fallback.getIndices() }
  getFxRates(): FxRate[] { return this.fallback.getFxRates() }
  getCommodities(): CommodityQuote[] { return this.fallback.getCommodities() }
  getRates(): RateQuote[] { return this.fallback.getRates() }
  getMovers(): MarketMovers { return this.fallback.getMovers() }
  getMarketBreadth(): MarketBreadth { return this.fallback.getMarketBreadth() }

  // ─── getQuote ─────────────────────────────────────────────────────────────

  async getQuote(symbol: string): Promise<Quote> {
    if (!this.apiKey) {
      return this.degraded(symbol, 'API key not configured')
    }

    // Canadian / TSX symbols: Polygon US equities endpoint does not cover them
    if (symbol.includes('.TO') || symbol.includes('.TSX') || symbol.includes('.V')) {
      return this.degraded(symbol, 'Symbol not supported by Polygon US equities endpoint')
    }

    // Return cached value if still fresh
    const cached = this.cache.get(symbol)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.quote
    }

    const url = `${POLYGON_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}`

    let response: Response
    try {
      response = await fetch(`${url}?apiKey=${this.apiKey}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      return this.recordError(symbol, msg)
    }

    if (response.status === 403) {
      return this.recordError(symbol, 'API key rejected (403)')
    }
    if (response.status === 404) {
      return this.degraded(symbol, `Symbol not found: ${symbol}`)
    }
    if (!response.ok) {
      return this.recordError(symbol, `HTTP ${response.status}`)
    }

    let body: PolygonSnapshotResponse
    try {
      body = (await response.json()) as PolygonSnapshotResponse
    } catch {
      return this.recordError(symbol, 'Failed to parse response')
    }

    if (body.status !== 'OK' || !body.ticker) {
      const reason = body.error ?? body.message ?? 'Unexpected API response'
      return this.recordError(symbol, reason)
    }

    const t = body.ticker
    // Use day close if available, fall back to prevDay close, then lastTrade
    const price = t.day?.c ?? t.prevDay?.c ?? t.lastTrade?.p ?? 0
    const volume = t.day?.v ?? 0
    // Polygon updated is nanoseconds; convert to ms
    const updatedMs = t.updated ? Math.floor(t.updated / 1_000_000) : Date.now()

    const quote: Quote = {
      symbol: t.ticker ?? symbol,
      name: symbol,
      price,
      change: t.todaysChange ?? 0,
      changePct: t.todaysChangePerc ?? 0,
      volume,
      marketCap: undefined,
      currency: 'USD',
      exchange: 'Polygon.io',
      lastUpdated: new Date(updatedMs).toISOString(),
      trustMode: 'TRUSTED',
    }

    this.cache.set(symbol, { quote, fetchedAt: Date.now() })
    this.lastStatus = 'UP'
    this.lastError = undefined
    this.lastCheck = new Date().toISOString()

    return quote
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

    // Only include the mock provider itself as fallback — not the unconfigured
    // alpha_vantage / polygon stubs from the mock health list, which would
    // otherwise pollute the UP/DOWN count with phantom DOWN entries.
    const mockFallback = this.fallback
      .getProviderHealth()
      .filter(p => p.providerId === 'mock')
      .map(p => ({ ...p, name: `${p.name} (fallback)` }))

    return [polygonHealth, ...mockFallback]
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async degraded(symbol: string, _reason: string): Promise<Quote> {
    const base = await this.fallback.getQuote(symbol)
    return { ...base, symbol, trustMode: 'DEGRADED' as const }
  }

  private async recordError(symbol: string, reason: string): Promise<Quote> {
    this.lastStatus = 'DEGRADED'
    this.lastError = reason
    this.lastCheck = new Date().toISOString()
    return this.degraded(symbol, reason)
  }
}
