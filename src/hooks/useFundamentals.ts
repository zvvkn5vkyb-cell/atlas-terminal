import { useState, useEffect } from 'react'
import {
  fetchKeyMetrics,
  isFMPConfigured,
  type FMPKeyMetrics,
  type FMPNewsItem,
} from '@/services/fundamentals/FMPService'

export interface FundamentalsState {
  metrics: FMPKeyMetrics | null
  news: FMPNewsItem[]
  loading: boolean
  error: string | null
  configured: boolean
}

// ─── Polygon news (free tier) ─────────────────────────────────────────────────

interface PolygonNewsResult {
  title: string
  published_utc: string
  article_url: string
  publisher?: { name?: string }
  description?: string
}

async function fetchPolygonNews(symbol: string): Promise<FMPNewsItem[]> {
  const key = (import.meta.env.VITE_POLYGON_API_KEY as string | undefined) ?? ''
  if (!key) return []

  const url =
    `https://api.polygon.io/v2/reference/news?ticker=${encodeURIComponent(symbol.toUpperCase())}&limit=10&apiKey=${key}`

  const res = await fetch(url)
  if (!res.ok) return []

  const json = await res.json() as { results?: PolygonNewsResult[] }
  return (json.results ?? []).map(item => ({
    title: item.title,
    publishedDate: item.published_utc?.slice(0, 10) ?? '',
    site: item.publisher?.name ?? 'Polygon.io',
    url: item.article_url,
    text: item.description ?? '',
  }))
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFundamentals(symbol: string): FundamentalsState {
  const [state, setState] = useState<FundamentalsState>({
    metrics: null,
    news: [],
    loading: false,
    error: null,
    configured: isFMPConfigured(),
  })

  useEffect(() => {
    if (!isFMPConfigured()) return
    let cancelled = false
    setState(s => ({ ...s, loading: true, error: null, metrics: null, news: [] }))

    // Metrics and news are independent — one failure must not block the other
    fetchKeyMetrics(symbol)
      .then(metrics => {
        if (!cancelled) setState(s => ({ ...s, metrics, loading: false, error: null }))
      })
      .catch((err: unknown) => {
        if (!cancelled) setState(s => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : 'FMP fetch failed',
        }))
      })

    fetchPolygonNews(symbol)
      .then(news => {
        if (!cancelled) setState(s => ({ ...s, news }))
      })
      .catch(() => { /* non-fatal */ })

    return () => { cancelled = true }
  }, [symbol])

  return state
}
