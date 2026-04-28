import { useMemo } from 'react'
import { usePortfolioStore } from '@/store/portfolioStore'
import { calculatePerformance, calculateContributions } from '@/lib/analytics/performance'
import type { PerformanceResult, ContributionItem } from '@/types/portfolio'

export function usePortfolioAnalytics() {
  const { holdings, navSnapshots, benchmarkPrices, activeTimeframe, summary } =
    usePortfolioStore()

  const performance: PerformanceResult = useMemo(
    () => calculatePerformance(activeTimeframe, navSnapshots, benchmarkPrices),
    [activeTimeframe, navSnapshots, benchmarkPrices],
  )

  const contributions: { topPositive: ContributionItem[]; topNegative: ContributionItem[] } =
    useMemo(() => calculateContributions(holdings), [holdings])

  return { performance, contributions, summary, activeTimeframe }
}
