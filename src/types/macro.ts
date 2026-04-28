import type { TrustMode } from './market'

export type MacroTrend = 'RISING' | 'FALLING' | 'STABLE' | 'UNKNOWN'

export interface MacroIndicator {
  id: string
  name: string
  value: number
  unit: string
  previousValue: number
  change: number
  changePct: number
  trend: MacroTrend
  reportDate: string
  nextReleaseDate?: string
  source: string
  trustMode: TrustMode
}

export interface YieldCurvePoint {
  tenor: string
  yield: number
  change: number
}

export interface EconomicEvent {
  id: string
  date: string
  time?: string
  country: string
  indicator: string
  importance: 'HIGH' | 'MEDIUM' | 'LOW'
  actual?: number
  forecast?: number
  previous?: number
  unit?: string
}

export interface CentralBankDecision {
  bank: string
  country: string
  policyRate: number
  previousRate: number
  decisionDate: string
  nextMeetingDate?: string
  bias: 'HAWKISH' | 'DOVISH' | 'NEUTRAL'
  trustMode: TrustMode
}
