import { create } from 'zustand'
import type { IndexCard, FxRate, CommodityQuote, RateQuote, Mover, MarketBreadth, Quote } from '@/types/market'
import type { HistoricalPricesResult, PriceRange } from '@/services/market/types'
import { MarketDataService } from '@/services/market/MarketDataService'

const svc = MarketDataService.getInstance()
const initialMovers = svc.getMovers()

interface MarketState {
  indices: IndexCard[]
  fxRates: FxRate[]
  commodities: CommodityQuote[]
  rates: RateQuote[]
  moversUp: Mover[]
  moversDown: Mover[]
  breadth: MarketBreadth
  lastUpdated: string
  dataSource: string
  quoteCache: Record<string, Quote>
  // key = `${symbol}::${range}`
  priceHistoryCache: Record<string, HistoricalPricesResult>
  loadQuote: (symbol: string) => Promise<void>
  loadPriceHistory: (symbol: string, range: PriceRange) => Promise<void>
}

export const useMarketStore = create<MarketState>((set) => ({
  indices: svc.getIndices(),
  fxRates: svc.getFxRates(),
  commodities: svc.getCommodities(),
  rates: svc.getRates(),
  moversUp: initialMovers.up,
  moversDown: initialMovers.down,
  breadth: svc.getMarketBreadth(),
  lastUpdated: new Date().toISOString(),
  dataSource: svc.dataSource,
  quoteCache: {},
  priceHistoryCache: {},

  loadQuote: async (symbol: string) => {
    const quote = await svc.getQuote(symbol)
    set((state) => ({ quoteCache: { ...state.quoteCache, [symbol]: quote } }))
  },

  loadPriceHistory: async (symbol: string, range: PriceRange) => {
    const result = await svc.getHistoricalPrices(symbol, range)
    const key = `${symbol}::${range}`
    set((state) => ({ priceHistoryCache: { ...state.priceHistoryCache, [key]: result } }))
  },
}))
