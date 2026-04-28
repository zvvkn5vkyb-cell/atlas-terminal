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

export type DataSource = 'MOCK' | 'LIVE' | 'HYBRID'

export interface MarketMovers {
  up: Mover[]
  down: Mover[]
}
