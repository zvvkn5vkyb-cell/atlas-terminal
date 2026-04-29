import { create } from 'zustand'
import type {
  Holding,
  NAVSnapshot,
  BenchmarkPrice,
  Timeframe,
  PortfolioSummary,
  CashPosition,
} from '@/types/portfolio'
import type { TrustMode } from '@/types/market'
import {
  MOCK_HOLDINGS,
  MOCK_NAV_SNAPSHOTS,
  MOCK_BENCHMARK_PRICES,
  MOCK_CASH_POSITIONS,
} from '@/lib/mockData'
import { MarketDataService } from '@/services/market/MarketDataService'

export type PriceSource = 'LIVE' | 'FALLBACK' | 'MOCK'

function computeSummary(holdings: Holding[], cash: CashPosition[]): PortfolioSummary {
  const totalEquity = holdings.reduce((s, h) => s + h.currentValue, 0)
  const totalCost = holdings.reduce((s, h) => s + h.costBasis * h.shares, 0)
  const totalCash = cash.reduce((s, c) => s + c.usdEquivalent, 0)
  const totalValue = totalEquity + totalCash
  const totalUnrealizedPnL = holdings.reduce((s, h) => s + h.unrealizedPnL, 0)
  const totalDayChange = holdings.reduce((s, h) => s + h.dayChange, 0)

  return {
    totalValue,
    totalCost,
    totalUnrealizedPnL,
    totalUnrealizedPnLPct: totalCost > 0 ? totalUnrealizedPnL / totalCost : 0,
    totalDayChange,
    totalDayChangePct: totalValue > 0 ? totalDayChange / (totalValue - totalDayChange) : 0,
    cashTotal: totalCash,
    cashPct: totalValue > 0 ? totalCash / totalValue : 0,
    equityTotal: totalEquity,
    equityPct: totalValue > 0 ? totalEquity / totalValue : 0,
    holdingCount: holdings.length,
    currency: 'USD',
    asOf: new Date().toISOString(),
  }
}

const initialSourceMap: Record<string, PriceSource> = Object.fromEntries(
  MOCK_HOLDINGS.map(h => [h.symbol, 'MOCK' as PriceSource])
)

interface PortfolioState {
  holdings: Holding[]
  navSnapshots: NAVSnapshot[]
  benchmarkPrices: BenchmarkPrice[]
  cashPositions: CashPosition[]
  activeTimeframe: Timeframe
  summary: PortfolioSummary
  priceSourceMap: Record<string, PriceSource>
  isRefreshing: boolean
  lastPriceRefresh: string | null
  setActiveTimeframe: (tf: Timeframe) => void
  refreshPrices: () => Promise<void>
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  holdings: MOCK_HOLDINGS,
  navSnapshots: MOCK_NAV_SNAPSHOTS,
  benchmarkPrices: MOCK_BENCHMARK_PRICES,
  cashPositions: MOCK_CASH_POSITIONS,
  activeTimeframe: '1D',
  summary: computeSummary(MOCK_HOLDINGS, MOCK_CASH_POSITIONS),
  priceSourceMap: { ...initialSourceMap },
  isRefreshing: false,
  lastPriceRefresh: null,

  setActiveTimeframe: (tf) => set({ activeTimeframe: tf }),

  refreshPrices: async () => {
    set({ isRefreshing: true })

    const { holdings, cashPositions } = get()
    const svc = MarketDataService.getInstance()

    // Fetch all quotes concurrently — never let one failure block the rest
    const settled = await Promise.allSettled(
      holdings.map(h =>
        svc.getQuote(h.symbol).then(quote => ({ holdingId: h.id, symbol: h.symbol, quote }))
      )
    )

    // Build lookup maps
    const sourceMap: Record<string, PriceSource> = {}
    const quoteById: Record<string, { symbol: string; quote: Awaited<ReturnType<typeof svc.getQuote>> }> = {}

    for (const result of settled) {
      if (result.status !== 'fulfilled') continue
      const { holdingId, symbol, quote } = result.value
      quoteById[holdingId] = { symbol, quote }
      // Polygon live: exchange is 'Polygon.io' AND trustMode TRUSTED
      const isLive = quote.trustMode === 'TRUSTED' && quote.exchange === 'Polygon.io'
      sourceMap[symbol] = isLive ? 'LIVE' : quote.trustMode === 'DEGRADED' ? 'FALLBACK' : 'MOCK'
    }

    // Update holdings — only overwrite price for confirmed live quotes
    let updated = holdings.map((h): Holding => {
      const entry = quoteById[h.id]
      if (!entry) return h

      const { quote } = entry
      const src = sourceMap[h.symbol] ?? 'MOCK'

      if (src === 'LIVE') {
        const currentPrice = quote.price
        const currentValue = currentPrice * h.shares
        const costTotal = h.costBasis * h.shares
        const unrealizedPnL = currentValue - costTotal
        return {
          ...h,
          currentPrice,
          currentValue,
          unrealizedPnL,
          unrealizedPnLPct: costTotal > 0 ? unrealizedPnL / costTotal : 0,
          dayChange: quote.change * h.shares,
          dayChangePct: quote.changePct,
          trustMode: 'TRUSTED' as TrustMode,
        }
      }

      // FALLBACK: keep original price, mark trustMode as degraded
      if (src === 'FALLBACK') {
        return { ...h, trustMode: 'DEGRADED' as TrustMode }
      }

      // MOCK: keep everything as-is
      return h
    })

    // Recalculate weights with updated values
    const totalCash = cashPositions.reduce((s, c) => s + c.usdEquivalent, 0)
    const totalEquity = updated.reduce((s, h) => s + h.currentValue, 0)
    const totalValue = totalEquity + totalCash
    updated = updated.map(h => ({
      ...h,
      weight: totalValue > 0 ? h.currentValue / totalValue : 0,
    }))

    set({
      holdings: updated,
      priceSourceMap: sourceMap,
      summary: computeSummary(updated, cashPositions),
      isRefreshing: false,
      lastPriceRefresh: new Date().toISOString(),
    })
  },
}))
