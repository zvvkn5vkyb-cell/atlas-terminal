import { useMarketStore } from '@/store/marketStore'

export function useMockMarketData() {
  const { indices, fxRates, commodities, rates, moversUp, moversDown, breadth, lastUpdated } =
    useMarketStore()

  return { indices, fxRates, commodities, rates, moversUp, moversDown, breadth, lastUpdated }
}
