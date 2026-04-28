import { create } from 'zustand'
import type { SystemStatus } from '@/types/system'
import type { ProviderHealth } from '@/types/market'
import { MOCK_PROVIDER_HEALTH } from '@/lib/mockData'

interface SystemState {
  status: SystemStatus
  providerHealth: ProviderHealth[]
}

export const useSystemStore = create<SystemState>(() => ({
  status: {
    dataAsOf: new Date().toISOString(),
    providerStatus: 'DEGRADED',
    activeProviders: 1,
    totalProviders: 3,
    lastRefresh: new Date().toISOString(),
  },
  providerHealth: MOCK_PROVIDER_HEALTH,
}))
