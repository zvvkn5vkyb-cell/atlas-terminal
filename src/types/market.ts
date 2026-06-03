import type { DataProvenance } from './provenance'

export type TrustMode = 'TRUSTED' | 'DEGRADED' | 'INSUFFICIENT_DATA' | 'UNTRUSTED'

export interface Quote {
  symbol: string
  name: string
  price: number
  change: number
  changePct: number
  volume: number
  marketCap?: number
  currency: string
  exchange: string
  lastUpdated: string
  trustMode: TrustMode
  /**
   * Optional provenance envelope (Phase 0B). Additive — existing consumers that
   * rely only on `trustMode` are unaffected. Populated by market-data providers
   * where available.
   */
  provenance?: DataProvenance
}

export interface IndexCard {
  symbol: string
  name: string
  value: number
  change: number
  changePct: number
  region: string
  trustMode: TrustMode
}

export interface FxRate {
  pair: string
  rate: number
  change: number
  changePct: number
  trustMode: TrustMode
}

export interface CommodityQuote {
  name: string
  symbol: string
  price: number
  unit: string
  change: number
  changePct: number
  trustMode: TrustMode
}

export interface RateQuote {
  name: string
  tenor: string
  yield: number
  change: number
  trustMode: TrustMode
}

export interface Mover {
  symbol: string
  name: string
  price: number
  change: number
  changePct: number
  volume: number
  direction: 'up' | 'down'
}

export interface MarketBreadth {
  advancing: number
  declining: number
  unchanged: number
  newHighs: number
  newLows: number
  timestamp: string
}

export interface OHLCVBar {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TechnicalIndicators {
  rsi14?: number
  macd?: { value: number; signal: number; histogram: number }
  sma20?: number
  sma50?: number
  sma200?: number
  atr14?: number
  bbUpper?: number
  bbLower?: number
  bbMiddle?: number
}

export interface ValuationMetrics {
  peRatio?: number
  pbRatio?: number
  psRatio?: number
  evEbitda?: number
  dividendYield?: number
  eps?: number
  beta?: number
  week52High?: number
  week52Low?: number
}

export interface ProviderHealth {
  providerId: string
  name: string
  status: 'UP' | 'DEGRADED' | 'DOWN'
  lastCheck: string
  latencyMs?: number
  errorMessage?: string
}
