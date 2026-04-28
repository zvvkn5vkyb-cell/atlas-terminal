import { create } from 'zustand'
import type { Holding, NAVSnapshot, BenchmarkPrice, Timeframe, PortfolioSummary, CashPosition } from '@/types/portfolio'
import {
  MOCK_HOLDINGS,
  MOCK_NAV_SNAPSHOTS,
  MOCK_BENCHMARK_PRICES,
  MOCK_CASH_POSITIONS,
} from '@/lib/mockData'

interface PortfolioState {
  holdings: Holding[]
  navSnapshots: NAVSnapshot[]
  benchmarkPrices: BenchmarkPrice[]
  cashPositions: CashPosition[]
  activeTimeframe: Timeframe
  summary: PortfolioSummary
  setActiveTimeframe: (tf: Timeframe) => void
}

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

export const usePortfolioStore = create<PortfolioState>((set) => ({
  holdings: MOCK_HOLDINGS,
  navSnapshots: MOCK_NAV_SNAPSHOTS,
  benchmarkPrices: MOCK_BENCHMARK_PRICES,
  cashPositions: MOCK_CASH_POSITIONS,
  activeTimeframe: '1D',
  summary: computeSummary(MOCK_HOLDINGS, MOCK_CASH_POSITIONS),

  setActiveTimeframe: (tf) => set({ activeTimeframe: tf }),
}))
