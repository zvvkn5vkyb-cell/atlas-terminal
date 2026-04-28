import type { TrustMode } from './market'

export type Timeframe = '1D' | '7D' | '30D' | '90D' | 'YTD' | 'SI'

export type ConcentrationLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type RiskFlagSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface Holding {
  id: string
  symbol: string
  name: string
  exchange: string
  currency: string
  sector: string
  assetClass: 'EQUITY' | 'FIXED_INCOME' | 'ETF' | 'CASH' | 'DERIVATIVE' | 'OTHER'
  shares: number
  costBasis: number
  currentPrice: number
  currentValue: number
  unrealizedPnL: number
  unrealizedPnLPct: number
  dayChange: number
  dayChangePct: number
  weight: number
  trustMode: TrustMode
}

export interface NAVSnapshot {
  date: string
  nav: number
  totalValue: number
  cashValue: number
  equityValue: number
}

export interface BenchmarkPrice {
  date: string
  price: number
  symbol: string
}

export interface PerformanceResult {
  timeframe: Timeframe
  portfolioReturn: number
  benchmarkReturn: number
  alpha: number
  startValue: number
  endValue: number
  startDate: string
  endDate: string
  trustMode: TrustMode
}

export interface ContributionItem {
  symbol: string
  name: string
  weight: number
  holdingReturn: number
  contribution: number
  direction: 'positive' | 'negative'
}

export interface AllocationBucket {
  label: string
  value: number
  pct: number
}

export interface RiskFlag {
  id: string
  severity: RiskFlagSeverity
  category: string
  message: string
  value?: number
  threshold?: number
}

export interface ConcentrationMetric {
  top1Pct: number
  top3Pct: number
  top5Pct: number
  level: ConcentrationLevel
}

export interface DrawdownMetric {
  currentDrawdown: number
  peakNav: number
  peakDate: string
  currentNav: number
  trustMode: TrustMode
}

export interface VolatilityMetric {
  annualizedVol: number | null
  dailyReturnsUsed: number
  trustMode: TrustMode
}

export interface BetaMetric {
  beta: number | null
  overlapDays: number
  trustMode: TrustMode
}

export interface RiskSummary {
  concentration: ConcentrationMetric
  sectorExposure: AllocationBucket[]
  currencyExposure: AllocationBucket[]
  drawdown: DrawdownMetric
  volatility: VolatilityMetric
  beta: BetaMetric
  riskFlags: RiskFlag[]
  overallTrustMode: TrustMode
}

export interface CashPosition {
  currency: string
  amount: number
  usdEquivalent: number
  pct: number
}

export interface PortfolioSummary {
  totalValue: number
  totalCost: number
  totalUnrealizedPnL: number
  totalUnrealizedPnLPct: number
  totalDayChange: number
  totalDayChangePct: number
  cashTotal: number
  cashPct: number
  equityTotal: number
  equityPct: number
  holdingCount: number
  currency: string
  asOf: string
}
