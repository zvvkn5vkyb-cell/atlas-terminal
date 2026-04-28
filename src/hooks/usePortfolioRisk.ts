import { useMemo } from 'react'
import { usePortfolioStore } from '@/store/portfolioStore'
import { calculateRiskSummary } from '@/lib/analytics/risk'
import type { RiskSummary } from '@/types/portfolio'

export function usePortfolioRisk(): RiskSummary {
  const { holdings, navSnapshots, benchmarkPrices } = usePortfolioStore()

  return useMemo(
    () => calculateRiskSummary(holdings, navSnapshots, benchmarkPrices),
    [holdings, navSnapshots, benchmarkPrices],
  )
}
