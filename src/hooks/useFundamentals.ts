import { useState, useEffect } from 'react'
import {
  fetchKeyMetrics,
  fetchNews,
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

    Promise.all([fetchKeyMetrics(symbol), fetchNews(symbol)])
      .then(([metrics, news]) => {
        if (!cancelled) setState({ metrics, news, loading: false, error: null, configured: true })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState(s => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : 'FMP fetch failed',
        }))
      })

    return () => { cancelled = true }
  }, [symbol])

  return state
}
