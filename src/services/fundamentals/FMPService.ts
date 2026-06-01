import type { IndexCard } from '@/types/market'

const BASE = 'https://financialmodelingprep.com/stable'

export interface FMPKeyMetrics {
  peRatio: number | null
  pbRatio: number | null
  priceToSalesRatio: number | null
  enterpriseValueOverEBITDA: number | null
  dividendYield: number | null
  eps: number | null
  beta: number | null
  date: string
}

export interface FMPNewsItem {
  title: string
  publishedDate: string
  site: string
  url: string
  text: string
}

interface CacheEntry<T> { data: T; ts: number }
const metricsCache = new Map<string, CacheEntry<FMPKeyMetrics>>()
const newsCache = new Map<string, CacheEntry<FMPNewsItem[]>>()
const METRICS_TTL = 60 * 60 * 1000
const NEWS_TTL = 15 * 60 * 1000

function apiKey(): string {
  return (import.meta.env.VITE_FMP_API_KEY as string | undefined) ?? ''
}

export function isFMPConfigured(): boolean {
  return apiKey().length > 0
}

interface FMPProfile {
  beta?: number | null
  lastDividend?: number | null
  price?: number | null
  eps?: number | null
}

interface FMPRatiosTTM {
  priceToEarningsRatioTTM?: number | null
  priceToBookRatioTTM?: number | null
  priceToSalesRatioTTM?: number | null
  dividendYieldTTM?: number | null
}

interface FMPKeyMetricsRow {
  evToEBITDA?: number | null
  earningsYield?: number | null
  date?: string
}

export async function fetchKeyMetrics(symbol: string): Promise<FMPKeyMetrics> {
  const key = symbol.toUpperCase()
  const cached = metricsCache.get(key)
  if (cached && Date.now() - cached.ts < METRICS_TTL) return cached.data

  const k = apiKey()
  const [profileRes, ratiosRes, kmRes] = await Promise.all([
    fetch(`${BASE}/profile?symbol=${key}&apikey=${k}`),
    fetch(`${BASE}/ratios-ttm?symbol=${key}&apikey=${k}`),
    fetch(`${BASE}/key-metrics?symbol=${key}&period=annual&limit=1&apikey=${k}`),
  ])

  if (!profileRes.ok) throw new Error(`FMP profile ${profileRes.status}`)
  if (!ratiosRes.ok) throw new Error(`FMP ratios ${ratiosRes.status}`)
  if (!kmRes.ok) throw new Error(`FMP key-metrics ${kmRes.status}`)

  const profileJson = await profileRes.json() as unknown[]
  const ratiosJson = await ratiosRes.json() as unknown[]
  const kmJson = await kmRes.json() as unknown[]

  const p = (Array.isArray(profileJson) && profileJson.length > 0 ? profileJson[0] : {}) as FMPProfile
  const r = (Array.isArray(ratiosJson) && ratiosJson.length > 0 ? ratiosJson[0] : {}) as FMPRatiosTTM
  const km = (Array.isArray(kmJson) && kmJson.length > 0 ? kmJson[0] : {}) as FMPKeyMetricsRow

  const price = p.price ?? null
  const lastDiv = p.lastDividend ?? null
  const dividendYield = r.dividendYieldTTM != null
    ? r.dividendYieldTTM
    : (price && lastDiv && price > 0 ? lastDiv / price : null)

  // Derive EPS from earnings yield × price if not directly available
  const ey = km.earningsYield ?? null
  const eps = p.eps ?? (ey && price ? ey * price : null)

  const data: FMPKeyMetrics = {
    peRatio: r.priceToEarningsRatioTTM ?? null,
    pbRatio: r.priceToBookRatioTTM ?? null,
    priceToSalesRatio: r.priceToSalesRatioTTM ?? null,
    enterpriseValueOverEBITDA: km.evToEBITDA ?? null,
    dividendYield,
    eps,
    beta: p.beta ?? null,
    date: km.date ?? new Date().toISOString().slice(0, 10),
  }

  metricsCache.set(key, { data, ts: Date.now() })
  return data
}

// Symbol-specific news requires a paid FMP plan — return empty gracefully.
export async function fetchNews(_symbol: string): Promise<FMPNewsItem[]> {
  return []
}

// ─── Live Index Quotes ────────────────────────────────────────────────────────

const INDEX_META = [
  { fmp: '^GSPC',   display: 'SPX',  name: 'S&P 500',            region: 'US' },
  { fmp: '^NDX',    display: 'NDX',  name: 'NASDAQ 100',          region: 'US' },
  { fmp: '^DJI',    display: 'DJIA', name: 'Dow Jones',           region: 'US' },
  { fmp: '^RUT',    display: 'RTY',  name: 'Russell 2000',        region: 'US' },
  { fmp: '^GSPTSE', display: 'TSX',  name: 'S&P/TSX Composite',   region: 'CA' },
  { fmp: '^FTSE',   display: 'FTSE', name: 'FTSE 100',            region: 'UK' },
  { fmp: '^GDAXI',  display: 'DAX',  name: 'DAX 40',              region: 'DE' },
  { fmp: '^N225',   display: 'N225', name: 'Nikkei 225',          region: 'JP' },
] as const

interface FMPQuoteItem {
  symbol: string
  price?: number
  change?: number
  changesPercentage?: number
}

const INDEX_TTL = 10 * 60 * 1000
let indicesCache: { data: IndexCard[]; ts: number } | null = null

export async function fetchLiveIndices(): Promise<IndexCard[]> {
  if (indicesCache && Date.now() - indicesCache.ts < INDEX_TTL) return indicesCache.data

  const k = apiKey()
  if (!k) return []

  const symbols = INDEX_META.map(m => m.fmp).join(',')
  const res = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(symbols)}&apikey=${k}`)
  if (!res.ok) throw new Error(`FMP quote ${res.status}`)

  const json = await res.json() as FMPQuoteItem[]
  const byFmp = new Map(json.map(q => [q.symbol, q]))

  const cards: IndexCard[] = INDEX_META
    .map((meta): IndexCard | null => {
      const q = byFmp.get(meta.fmp)
      if (!q || q.price == null) return null
      return {
        symbol: meta.display,
        name: meta.name,
        value: q.price,
        change: q.change ?? 0,
        changePct: q.changesPercentage ?? 0,
        region: meta.region,
        trustMode: 'TRUSTED',
      }
    })
    .filter((c): c is IndexCard => c !== null)

  indicesCache = { data: cards, ts: Date.now() }
  return cards
}
