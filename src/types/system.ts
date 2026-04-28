export type ModuleId =
  | 'market'
  | 'security'
  | 'portfolio'
  | 'private-assets'
  | 'macro'
  | 'news'
  | 'screener'
  | 'intelligence'

export interface NavModule {
  id: ModuleId
  label: string
  shortcut: string
  altKey: number
}

export interface CommandItem {
  id: string
  label: string
  category: 'navigation' | 'action' | 'symbol'
  action: () => void
  keywords?: string[]
}

export interface SystemStatus {
  dataAsOf: string
  providerStatus: 'ALL_UP' | 'DEGRADED' | 'PARTIAL' | 'DOWN'
  activeProviders: number
  totalProviders: number
  lastRefresh: string
}
