import { useState, useEffect } from 'react'
import type { IndexCard } from '@/types/market'
import { fetchPolygonIndices } from '@/services/market/PolygonMarketDataProvider'
import { MOCK_INDICES } from '@/lib/mockData'

export type IndicesStatus = 'loading' | 'live' | 'mock'

const POLL_MS = 60_000

export function useLiveIndices(): { indices: IndexCard[]; status: IndicesStatus } {
  const [indices, setIndices] = useState<IndexCard[]>(MOCK_INDICES)
  const [status, setStatus] = useState<IndicesStatus>('mock')

  useEffect(() => {
    const apiKey = import.meta.env.VITE_POLYGON_API_KEY as string | undefined
    if (!apiKey) return

    let cancelled = false

    async function load() {
      setStatus('loading')
      try {
        const live = await fetchPolygonIndices()
        if (cancelled) return
        if (live.length === 0) {
          setStatus('mock')
          return
        }
        setIndices(prev => prev.map(m => live.find(l => l.symbol === m.symbol) ?? m))
        setStatus('live')
      } catch {
        if (!cancelled) setStatus('mock')
      }
    }

    load()
    const id = setInterval(load, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return { indices, status }
}
