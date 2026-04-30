import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Holding,
  NAVSnapshot,
  BenchmarkPrice,
  Timeframe,
  PortfolioSummary,
  CashPosition,
} from '@/types/portfolio'
import {
  MOCK_HOLDINGS,
  MOCK_NAV_SNAPSHOTS,
  MOCK_BENCHMARK_PRICES,
  MOCK_CASH_POSITIONS,
} from '@/lib/mockData'
import { MarketDataService } from '@/services/market/MarketDataService'
import { PORTFOLIO_STORAGE_KEY } from '@/store/workspaceStore'
import {
  type PriceSource,
  computeSummary,
  computeRefreshedState,
  CANADIAN_RE,
} from '@/store/portfolioRefresh'

// Re-export for UI components that import PriceSource or computeSummary from this module
export type { PriceSource }
export { computeSummary }

const initialSourceMap: Record<string, PriceSource> = Object.fromEntries(
  MOCK_HOLDINGS.map(h => [h.symbol, CANADIAN_RE.test(h.symbol) ? 'CANADA' : 'MOCK'])
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

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
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

        const settled = await Promise.allSettled(
          holdings.map(h =>
            svc.getQuote(h.symbol).then(quote => ({ holdingId: h.id, symbol: h.symbol, quote }))
          )
        )

        const quoteResults = settled
          .filter((r): r is PromiseFulfilledResult<{ holdingId: string; symbol: string; quote: Awaited<ReturnType<typeof svc.getQuote>> }> =>
            r.status === 'fulfilled'
          )
          .map(r => r.value)

        const { holdings: updated, priceSourceMap: sourceMap, summary } =
          computeRefreshedState(holdings, cashPositions, quoteResults)

        set({
          holdings: updated,
          priceSourceMap: sourceMap,
          summary,
          isRefreshing: false,
          lastPriceRefresh: new Date().toISOString(),
        })
      },
    }),
    {
      name: PORTFOLIO_STORAGE_KEY,
      version: 1,
      // Persist refreshed prices and metadata; never persist loading state,
      // large NAV/benchmark history arrays, or derived summary.
      partialize: (state) => ({
        holdings: state.holdings,
        priceSourceMap: state.priceSourceMap,
        lastPriceRefresh: state.lastPriceRefresh,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        try {
          // Recompute derived summary from persisted holdings.
          // cashPositions is not persisted — always falls back to mock.
          state.summary = computeSummary(state.holdings, state.cashPositions ?? MOCK_CASH_POSITIONS)
        } catch {
          // Persisted holdings are corrupt or schema has changed — reset to mock
          state.holdings = MOCK_HOLDINGS
          state.priceSourceMap = { ...initialSourceMap }
          state.lastPriceRefresh = null
          state.summary = computeSummary(MOCK_HOLDINGS, MOCK_CASH_POSITIONS)
        }
      },
      migrate: (persisted, _version) => {
        // v1 is the initial persisted version.
        // Validate shape; fall back to safe defaults if corrupt.
        const p = (persisted ?? {}) as Record<string, unknown>
        return {
          holdings: Array.isArray(p.holdings) ? (p.holdings as Holding[]) : MOCK_HOLDINGS,
          priceSourceMap: (p.priceSourceMap && typeof p.priceSourceMap === 'object')
            ? (p.priceSourceMap as Record<string, PriceSource>)
            : { ...initialSourceMap },
          lastPriceRefresh: typeof p.lastPriceRefresh === 'string' ? p.lastPriceRefresh : null,
        }
      },
    }
  )
)
