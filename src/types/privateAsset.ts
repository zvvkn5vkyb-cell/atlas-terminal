import type { TrustMode } from './market'

export type PrivateAssetType =
  | 'PRIVATE_EQUITY'
  | 'PRIVATE_CREDIT'
  | 'REAL_ESTATE'
  | 'HEDGE_FUND'
  | 'INFRASTRUCTURE'
  | 'VENTURE'
  | 'OTHER'

export type LiquidityProfile = 'ILLIQUID' | 'SEMI_LIQUID' | 'QUARTERLY' | 'ANNUAL'

export interface PrivateAsset {
  id: string
  name: string
  manager: string
  type: PrivateAssetType
  vintage: number
  commitment: number
  called: number
  uncalled: number
  nav: number
  distributions: number
  tvpi: number
  dpi: number
  irr?: number
  currency: string
  liquidity: LiquidityProfile
  nextLiquidityDate?: string
  lastValuationDate: string
  trustMode: TrustMode
}

export interface NAVHistoryPoint {
  date: string
  nav: number
  source: string
}

export interface Distribution {
  date: string
  amount: number
  currency: string
  type: 'RETURN_OF_CAPITAL' | 'INCOME' | 'CAPITAL_GAIN'
  assetId: string
}

export interface CashFlowEvent {
  date: string
  amount: number
  currency: string
  type: 'CALL' | 'DISTRIBUTION'
  assetId: string
  assetName: string
}

export interface NAVReconciliation {
  assetId: string
  reportedNAV: number
  calculatedNAV: number
  variance: number
  variancePct: number
  status: 'RECONCILED' | 'VARIANCE' | 'PENDING'
  notes?: string
}

export interface AuditEntry {
  id: string
  timestamp: string
  user: string
  action: string
  assetId?: string
  field?: string
  oldValue?: string
  newValue?: string
}
