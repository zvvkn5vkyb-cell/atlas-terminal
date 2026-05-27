const BASE = 'https://financialmodelingprep.com/api/v3'

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
const METRICS_TTL = 60 * 60 * 1000  // 1 hour
const NEWS_TTL = 15 * 60 * 1000     // 15 minutes

function apiKey(): string {
  return (import.meta.env.VITE_FMP_API_KEY as string | undefined) ?? ''
}

export function isFMPConfigured(): boolean {
  return apiKey().length > 0
}

export async function fetchKeyMetrics(symbol: string): Promise<FMPKeyMetrics> {
  const key = symbol.toUpperCase()
  const cached = metricsCache.get(key)
  if (cached && Date.now() - cached.ts < METRICS_TTL) return cached.data

  const res = await fetch(`${BASE}/key-metrics/${key}?apikey=${apiKey()}&limit=1`)
  if (!res.ok) throw new Error(`FMP ${res.status}`)
  const json = await res.json() as unknown[]
  const row = (Array.isArray(json) && json.length > 0 ? json[0] : {}) as Record<string, number | string | null>

  const data: FMPKeyMetrics = {
    peRatio: (row.peRatio as number | null) ?? null,
    pbRatio: (row.pbRatio as number | null) ?? null,
    priceToSalesRatio: (row.priceToSalesRatio as number | null) ?? null,
    enterpriseValueOverEBITDA: (row.enterpriseValueOverEBITDA as number | null) ?? null,
    dividendYield: (row.dividendYield as number | null) ?? null,
    eps: (row.eps as number | null) ?? null,
    beta: (row.beta as number | null) ?? null,
    date: (row.date as string | null) ?? '',
  }
  metricsCache.set(key, { data, ts: Date.now() })
  return data
}

export async function fetchNews(symbol: string): Promise<FMPNewsItem[]> {
  const key = symbol.toUpperCase()
  const cached = newsCache.get(key)
  if (cached && Date.now() - cached.ts < NEWS_TTL) return cached.data

  const res = await fetch(`${BASE}/stock_news?tickers=${key}&limit=10&apikey=${apiKey()}`)
  if (!res.ok) throw new Error(`FMP news ${res.status}`)
  const json = await res.json() as unknown[]
  const data: FMPNewsItem[] = (Array.isArray(json) ? json : []).map(item => {
    const i = item as Record<string, string>
    return {
      title: i.title ?? '',
      publishedDate: i.publishedDate ?? '',
      site: i.site ?? '',
      url: i.url ?? '',
      text: i.text ?? '',
    }
  })
  newsCache.set(key, { data, ts: Date.now() })
  return data
}
