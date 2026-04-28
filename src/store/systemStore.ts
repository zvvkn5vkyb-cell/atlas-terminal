import { create } from 'zustand'
import type { SystemStatus } from '@/types/system'
import type { ProviderHealth } from '@/types/market'
import { MarketDataService } from '@/services/market/MarketDataService'

const svc = MarketDataService.getInstance()
const providerHealth = svc.getProviderHealth()
const upCount = providerHealth.filter((p) => p.status === 'UP').length
const totalCount = providerHealth.length

const providerStatus: SystemStatus['providerStatus'] =
  upCount === totalCount ? 'ALL_UP' :
  upCount === 0 ? 'DOWN' :
  upCount / totalCount >= 0.5 ? 'DEGRADED' : 'PARTIAL'

interface SystemState {
  status: SystemStatus
  providerHealth: ProviderHealth[]
}

export const useSystemStore = create<SystemState>(() => ({
  status: {
    dataAsOf: new Date().toISOString(),
    providerStatus,
    activeProviders: upCount,
    totalProviders: totalCount,
    lastRefresh: new Date().toISOString(),
  },
  providerHealth,
}))
