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
const METRICS_TTL = 60 * 60 * 1000  // 1 hour

function apiKey(): string {
  return (import.meta.env.VITE_FMP_API_KEY as string | undefined) ?? ''
}

export function isFMPConfigured(): boolean {
  return apiKey().length > 0
}

// ─── Free-tier endpoints: /quote + /profile ───────────────────────────────────

interface FMPQuote {
  symbol?: string
  pe?: number | null
  eps?: number | null
  marketCap?: number | null
  price?: number | null
}

interface FMPProfile {
  beta?: number | null
  lastDiv?: number | null  // annual dividend per share
  price?: number | null
}

export async function fetchKeyMetrics(symbol: string): Promise<FMPKeyMetrics> {
  const key = symbol.toUpperCase()
  const cached = metricsCache.get(key)
  if (cached && Date.now() - cached.ts < METRICS_TTL) return cached.data

  const [quoteRes, profileRes] = await Promise.all([
    fetch(`${BASE}/quote/${key}?apikey=${apiKey()}`),
    fetch(`${BASE}/profile/${key}?apikey=${apiKey()}`),
  ])

  if (!quoteRes.ok) throw new Error(`FMP quote ${quoteRes.status}`)
  if (!profileRes.ok) throw new Error(`FMP profile ${profileRes.status}`)

  const quoteJson = await quoteRes.json() as unknown[]
  const profileJson = await profileRes.json() as unknown[]

  const q = (Array.isArray(quoteJson) && quoteJson.length > 0 ? quoteJson[0] : {}) as FMPQuote
  const p = (Array.isArray(profileJson) && profileJson.length > 0 ? profileJson[0] : {}) as FMPProfile

  const price = q.price ?? p.price ?? null
  const lastDiv = p.lastDiv ?? null
  const dividendYield = (price && lastDiv && price > 0) ? lastDiv / price : null

  const data: FMPKeyMetrics = {
    peRatio: q.pe ?? null,
    pbRatio: null,           // requires paid plan
    priceToSalesRatio: null, // requires paid plan
    enterpriseValueOverEBITDA: null, // requires paid plan
    dividendYield,
    eps: q.eps ?? null,
    beta: p.beta ?? null,
    date: new Date().toISOString().slice(0, 10),
  }

  metricsCache.set(key, { data, ts: Date.now() })
  return data
}

// News is not available on the free FMP plan — return empty so the UI degrades cleanly.
export async function fetchNews(_symbol: string): Promise<FMPNewsItem[]> {
  return []
}
