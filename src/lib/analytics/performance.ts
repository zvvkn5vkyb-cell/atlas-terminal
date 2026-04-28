import type { Holding, NAVSnapshot, BenchmarkPrice, PerformanceResult, ContributionItem, Timeframe } from '@/types/portfolio'

function getDateFromOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function getYTDStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-01-01`
}

function timeframeStartDate(tf: Timeframe): string {
  switch (tf) {
    case '1D': return getDateFromOffset(1)
    case '7D': return getDateFromOffset(7)
    case '30D': return getDateFromOffset(30)
    case '90D': return getDateFromOffset(90)
    case 'YTD': return getYTDStart()
    case 'SI': return '2023-01-03'
  }
}

function findNAVOnOrBefore(snapshots: NAVSnapshot[], date: string): NAVSnapshot | null {
  const filtered = snapshots.filter(s => s.date <= date)
  if (!filtered.length) return null
  return filtered[filtered.length - 1]
}

function findBenchmarkOnOrBefore(prices: BenchmarkPrice[], date: string): BenchmarkPrice | null {
  const filtered = prices.filter(p => p.date <= date)
  if (!filtered.length) return null
  return filtered[filtered.length - 1]
}

export function calculatePerformance(
  timeframe: Timeframe,
  navSnapshots: NAVSnapshot[],
  benchmarkPrices: BenchmarkPrice[],
): PerformanceResult {
  const sortedNavs = [...navSnapshots].sort((a, b) => a.date.localeCompare(b.date))
  const sortedBench = [...benchmarkPrices].sort((a, b) => a.date.localeCompare(b.date))

  const startDateStr = timeframeStartDate(timeframe)
  const today = new Date().toISOString().slice(0, 10)

  const startNav = findNAVOnOrBefore(sortedNavs, startDateStr)
  const endNav = sortedNavs[sortedNavs.length - 1] ?? null

  const startBench = findBenchmarkOnOrBefore(sortedBench, startDateStr)
  const endBench = sortedBench[sortedBench.length - 1] ?? null

  if (!startNav || !endNav || !startBench || !endBench) {
    return {
      timeframe,
      portfolioReturn: 0,
      benchmarkReturn: 0,
      alpha: 0,
      startValue: 0,
      endValue: 0,
      startDate: startDateStr,
      endDate: today,
      trustMode: 'INSUFFICIENT_DATA',
    }
  }

  const portfolioReturn = (endNav.nav - startNav.nav) / startNav.nav
  const benchmarkReturn = (endBench.price - startBench.price) / startBench.price
  const alpha = portfolioReturn - benchmarkReturn

  return {
    timeframe,
    portfolioReturn,
    benchmarkReturn,
    alpha,
    startValue: startNav.nav,
    endValue: endNav.nav,
    startDate: startNav.date,
    endDate: endNav.date,
    trustMode: 'TRUSTED',
  }
}

export function calculateContributions(holdings: Holding[]): {
  topPositive: ContributionItem[]
  topNegative: ContributionItem[]
} {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0)
  if (totalValue === 0) return { topPositive: [], topNegative: [] }

  const items: ContributionItem[] = holdings.map(h => {
    const weight = h.currentValue / totalValue
    const holdingReturn = h.dayChangePct / 100
    const contribution = weight * holdingReturn
    return {
      symbol: h.symbol,
      name: h.name,
      weight,
      holdingReturn,
      contribution,
      direction: contribution >= 0 ? 'positive' : 'negative',
    }
  })

  const sorted = [...items].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
  const topPositive = sorted.filter(i => i.direction === 'positive').slice(0, 5)
  const topNegative = sorted.filter(i => i.direction === 'negative').slice(0, 5)

  return { topPositive, topNegative }
}

export function calculatePortfolioValue(holdings: Holding[]): number {
  return holdings.reduce((sum, h) => sum + h.currentValue, 0)
}
