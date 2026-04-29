export type {
  IndexCard,
  FxRate,
  CommodityQuote,
  RateQuote,
  Mover,
  MarketBreadth,
  Quote,
  ProviderHealth,
  TrustMode,
} from '@/types/market'

import type { Mover } from '@/types/market'
import type { TrustMode } from '@/types/market'

export type DataSource = 'MOCK' | 'LIVE' | 'HYBRID'

export interface MarketMovers {
  up: Mover[]
  down: Mover[]
}

export type PriceRange = '1D' | '1W' | '1M' | '3M' | '1Y'

export interface OHLCVBar {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface HistoricalPricesResult {
  symbol: string
  range: PriceRange
  bars: OHLCVBar[]
  provider: string
  trustMode: TrustMode
  isStale: boolean
  fallbackReason?: string
}
