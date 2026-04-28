import type { NavModule } from '@/types/system'

export const NAV_MODULES: NavModule[] = [
  { id: 'market', label: 'Market Overview', shortcut: 'Alt+1', altKey: 1 },
  { id: 'security', label: 'Security Detail', shortcut: 'Alt+2', altKey: 2 },
  { id: 'portfolio', label: 'Portfolio', shortcut: 'Alt+3', altKey: 3 },
  { id: 'private-assets', label: 'Private Assets', shortcut: 'Alt+4', altKey: 4 },
  { id: 'macro', label: 'Macro', shortcut: 'Alt+5', altKey: 5 },
  { id: 'news', label: 'News', shortcut: 'Alt+6', altKey: 6 },
  { id: 'screener', label: 'Screener', shortcut: 'Alt+7', altKey: 7 },
  { id: 'intelligence', label: 'Intelligence', shortcut: 'Alt+8', altKey: 8 },
]

export const COMMAND_PALETTE_SYMBOLS = [
  'SPY',
  'XIU.TO',
  'RY.TO',
  'TD.TO',
  'AAPL',
  'MSFT',
  'QQQ',
  'IWM',
  'GLD',
  'TLT',
]

export const RISK_THRESHOLDS = {
  concentrationHigh: 0.4,
  concentrationMedium: 0.25,
  drawdownWarning: 0.1,
  usdExposureWarning: 0.5,
  sectorConcentrationWarning: 0.35,
  minVolatilityDays: 20,
  maxRiskFlags: 5,
}

export const BENCHMARK_SYMBOL = 'SPY'

export const CURRENCY_USD = 'USD'
export const CURRENCY_CAD = 'CAD'
