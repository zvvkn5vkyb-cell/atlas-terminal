import { create } from 'zustand'
import type { IndexCard, FxRate, CommodityQuote, RateQuote, Mover, MarketBreadth } from '@/types/market'
import {
  MOCK_INDICES,
  MOCK_FX_RATES,
  MOCK_COMMODITIES,
  MOCK_RATES,
  MOCK_MOVERS_UP,
  MOCK_MOVERS_DOWN,
  MOCK_MARKET_BREADTH,
} from '@/lib/mockData'

interface MarketState {
  indices: IndexCard[]
  fxRates: FxRate[]
  commodities: CommodityQuote[]
  rates: RateQuote[]
  moversUp: Mover[]
  moversDown: Mover[]
  breadth: MarketBreadth
  lastUpdated: string
}

export const useMarketStore = create<MarketState>(() => ({
  indices: MOCK_INDICES,
  fxRates: MOCK_FX_RATES,
  commodities: MOCK_COMMODITIES,
  rates: MOCK_RATES,
  moversUp: MOCK_MOVERS_UP,
  moversDown: MOCK_MOVERS_DOWN,
  breadth: MOCK_MARKET_BREADTH,
  lastUpdated: new Date().toISOString(),
}))
