import type { Holding, NAVSnapshot, BenchmarkPrice, CashPosition } from '@/types/portfolio'
import type { IndexCard, FxRate, CommodityQuote, RateQuote, Mover, MarketBreadth, Quote, ProviderHealth } from '@/types/market'
import type { PrivateAsset, Distribution, CashFlowEvent } from '@/types/privateAsset'
import type { MacroIndicator, YieldCurvePoint, EconomicEvent, CentralBankDecision } from '@/types/macro'
import type { NewsItem } from '@/types/news'

// ─── Holdings ────────────────────────────────────────────────────────────────

export const MOCK_HOLDINGS: Holding[] = [
  {
    id: 'h1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Technology',
    assetClass: 'EQUITY',
    shares: 450,
    costBasis: 155.40,
    currentPrice: 189.30,
    currentValue: 85185,
    unrealizedPnL: 15255,
    unrealizedPnLPct: 21.84,
    dayChange: 1230,
    dayChangePct: 1.46,
    weight: 0.1842,
    trustMode: 'TRUSTED',
  },
  {
    id: 'h2',
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Technology',
    assetClass: 'EQUITY',
    shares: 200,
    costBasis: 310.00,
    currentPrice: 415.50,
    currentValue: 83100,
    unrealizedPnL: 21100,
    unrealizedPnLPct: 34.03,
    dayChange: -830,
    dayChangePct: -0.99,
    weight: 0.1797,
    trustMode: 'TRUSTED',
  },
  {
    id: 'h3',
    symbol: 'RY.TO',
    name: 'Royal Bank of Canada',
    exchange: 'TSX',
    currency: 'CAD',
    sector: 'Financials',
    assetClass: 'EQUITY',
    shares: 600,
    costBasis: 118.20,
    currentPrice: 135.80,
    currentValue: 81480,
    unrealizedPnL: 10560,
    unrealizedPnLPct: 14.89,
    dayChange: 490,
    dayChangePct: 0.60,
    weight: 0.1762,
    trustMode: 'TRUSTED',
  },
  {
    id: 'h4',
    symbol: 'XIU.TO',
    name: 'iShares S&P/TSX 60 ETF',
    exchange: 'TSX',
    currency: 'CAD',
    sector: 'ETF',
    assetClass: 'ETF',
    shares: 1200,
    costBasis: 30.50,
    currentPrice: 35.20,
    currentValue: 42240,
    unrealizedPnL: 5640,
    unrealizedPnLPct: 15.41,
    dayChange: -170,
    dayChangePct: -0.40,
    weight: 0.0913,
    trustMode: 'TRUSTED',
  },
  {
    id: 'h5',
    symbol: 'TD.TO',
    name: 'Toronto-Dominion Bank',
    exchange: 'TSX',
    currency: 'CAD',
    sector: 'Financials',
    assetClass: 'EQUITY',
    shares: 700,
    costBasis: 88.40,
    currentPrice: 79.15,
    currentValue: 55405,
    unrealizedPnL: -6475,
    unrealizedPnLPct: -10.47,
    dayChange: -555,
    dayChangePct: -0.99,
    weight: 0.1198,
    trustMode: 'TRUSTED',
  },
  {
    id: 'h6',
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Technology',
    assetClass: 'EQUITY',
    shares: 120,
    costBasis: 130.00,
    currentPrice: 175.20,
    currentValue: 21024,
    unrealizedPnL: 5424,
    unrealizedPnLPct: 34.80,
    dayChange: 420,
    dayChangePct: 2.04,
    weight: 0.0455,
    trustMode: 'TRUSTED',
  },
  {
    id: 'h7',
    symbol: 'ENB.TO',
    name: 'Enbridge Inc.',
    exchange: 'TSX',
    currency: 'CAD',
    sector: 'Energy',
    assetClass: 'EQUITY',
    shares: 900,
    costBasis: 50.10,
    currentPrice: 54.30,
    currentValue: 48870,
    unrealizedPnL: 3780,
    unrealizedPnLPct: 8.38,
    dayChange: 270,
    dayChangePct: 0.56,
    weight: 0.1057,
    trustMode: 'DEGRADED',
  },
  {
    id: 'h8',
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF',
    exchange: 'NYSE',
    currency: 'USD',
    sector: 'ETF',
    assetClass: 'ETF',
    shares: 80,
    costBasis: 430.00,
    currentPrice: 512.40,
    currentValue: 40992,
    unrealizedPnL: 6592,
    unrealizedPnLPct: 19.19,
    dayChange: 350,
    dayChangePct: 0.86,
    weight: 0.0887,
    trustMode: 'TRUSTED',
  },
]

export const MOCK_CASH_POSITIONS: CashPosition[] = [
  { currency: 'USD', amount: 18500, usdEquivalent: 18500, pct: 0.04 },
  { currency: 'CAD', amount: 12000, usdEquivalent: 8880, pct: 0.019 },
]

// ─── NAV Snapshots ────────────────────────────────────────────────────────────

function generateNAVHistory(): NAVSnapshot[] {
  const snapshots: NAVSnapshot[] = []
  let nav = 380000
  const current = new Date('2023-01-03')
  const today = new Date()
  today.setHours(23, 59, 59, 0)
  while (current <= today) {
    const dow = current.getDay()
    if (dow !== 0 && dow !== 6) {
      const drift = 0.0003
      const vol = 0.008
      const change = nav * (drift + vol * (Math.random() - 0.5) * 2)
      nav = Math.max(nav + change, nav * 0.85)
      snapshots.push({
        date: current.toISOString().slice(0, 10),
        nav: Math.round(nav),
        totalValue: Math.round(nav),
        cashValue: Math.round(nav * 0.06),
        equityValue: Math.round(nav * 0.94),
      })
    }
    current.setDate(current.getDate() + 1)
  }
  return snapshots
}

export const MOCK_NAV_SNAPSHOTS: NAVSnapshot[] = generateNAVHistory()

// ─── Benchmark Prices ─────────────────────────────────────────────────────────

function generateBenchmarkHistory(): BenchmarkPrice[] {
  const prices: BenchmarkPrice[] = []
  let price = 390
  const current = new Date('2023-01-03')
  const today = new Date()
  today.setHours(23, 59, 59, 0)
  while (current <= today) {
    const dow = current.getDay()
    if (dow !== 0 && dow !== 6) {
      const drift = 0.0003
      const vol = 0.009
      const change = price * (drift + vol * (Math.random() - 0.5) * 2)
      price = Math.max(price + change, price * 0.85)
      prices.push({
        date: current.toISOString().slice(0, 10),
        price: Math.round(price * 100) / 100,
        symbol: 'SPY',
      })
    }
    current.setDate(current.getDate() + 1)
  }
  return prices
}

export const MOCK_BENCHMARK_PRICES: BenchmarkPrice[] = generateBenchmarkHistory()

// ─── Market Indices ───────────────────────────────────────────────────────────

export const MOCK_INDICES: IndexCard[] = [
  { symbol: 'SPX', name: 'S&P 500', value: 5234.18, change: 28.4, changePct: 0.55, region: 'US', trustMode: 'TRUSTED' },
  { symbol: 'NDX', name: 'NASDAQ 100', value: 18312.40, change: -45.2, changePct: -0.25, region: 'US', trustMode: 'TRUSTED' },
  { symbol: 'DJIA', name: 'Dow Jones', value: 39127.80, change: 112.5, changePct: 0.29, region: 'US', trustMode: 'TRUSTED' },
  { symbol: 'RTY', name: 'Russell 2000', value: 2082.30, change: -8.7, changePct: -0.42, region: 'US', trustMode: 'TRUSTED' },
  { symbol: 'TSX', name: 'S&P/TSX Composite', value: 22310.50, change: 95.3, changePct: 0.43, region: 'CA', trustMode: 'TRUSTED' },
  { symbol: 'FTSE', name: 'FTSE 100', value: 7940.20, change: -22.1, changePct: -0.28, region: 'UK', trustMode: 'DEGRADED' },
  { symbol: 'DAX', name: 'DAX 40', value: 18450.70, change: 65.4, changePct: 0.36, region: 'DE', trustMode: 'DEGRADED' },
  { symbol: 'N225', name: 'Nikkei 225', value: 38920.00, change: -180.4, changePct: -0.46, region: 'JP', trustMode: 'DEGRADED' },
]

export const MOCK_FX_RATES: FxRate[] = [
  { pair: 'USD/CAD', rate: 1.3510, change: 0.0025, changePct: 0.19, trustMode: 'TRUSTED' },
  { pair: 'EUR/USD', rate: 1.0845, change: -0.0012, changePct: -0.11, trustMode: 'TRUSTED' },
  { pair: 'GBP/USD', rate: 1.2680, change: 0.0030, changePct: 0.24, trustMode: 'TRUSTED' },
  { pair: 'USD/JPY', rate: 151.40, change: 0.35, changePct: 0.23, trustMode: 'TRUSTED' },
  { pair: 'AUD/USD', rate: 0.6520, change: -0.0018, changePct: -0.27, trustMode: 'DEGRADED' },
]

export const MOCK_COMMODITIES: CommodityQuote[] = [
  { name: 'Gold', symbol: 'GC', price: 2320.50, unit: 'USD/oz', change: 8.40, changePct: 0.36, trustMode: 'TRUSTED' },
  { name: 'Crude Oil (WTI)', symbol: 'CL', price: 78.30, unit: 'USD/bbl', change: -1.20, changePct: -1.51, trustMode: 'TRUSTED' },
  { name: 'Natural Gas', symbol: 'NG', price: 1.82, unit: 'USD/MMBtu', change: 0.04, changePct: 2.25, trustMode: 'DEGRADED' },
  { name: 'Silver', symbol: 'SI', price: 27.45, unit: 'USD/oz', change: 0.22, changePct: 0.81, trustMode: 'TRUSTED' },
]

export const MOCK_RATES: RateQuote[] = [
  { name: 'US 2Y', tenor: '2Y', yield: 4.85, change: 0.04, trustMode: 'TRUSTED' },
  { name: 'US 10Y', tenor: '10Y', yield: 4.32, change: -0.02, trustMode: 'TRUSTED' },
  { name: 'US 30Y', tenor: '30Y', yield: 4.48, change: -0.01, trustMode: 'TRUSTED' },
  { name: 'CA 2Y', tenor: 'CA 2Y', yield: 4.42, change: 0.03, trustMode: 'TRUSTED' },
  { name: 'CA 10Y', tenor: 'CA 10Y', yield: 3.88, change: -0.02, trustMode: 'TRUSTED' },
]

export const MOCK_MOVERS_UP: Mover[] = [
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 875.40, change: 45.20, changePct: 5.45, volume: 45200000, direction: 'up' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', price: 162.30, change: 7.80, changePct: 5.05, volume: 32100000, direction: 'up' },
  { symbol: 'META', name: 'Meta Platforms', price: 498.20, change: 18.40, changePct: 3.84, volume: 18900000, direction: 'up' },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 168.50, change: 5.30, changePct: 3.25, volume: 92400000, direction: 'up' },
  { symbol: 'SHOP.TO', name: 'Shopify Inc.', price: 82.40, change: 2.30, changePct: 2.87, volume: 5200000, direction: 'up' },
]

export const MOCK_MOVERS_DOWN: Mover[] = [
  { symbol: 'INTC', name: 'Intel Corp.', price: 30.15, change: -2.85, changePct: -8.64, volume: 68200000, direction: 'down' },
  { symbol: 'PFE', name: 'Pfizer Inc.', price: 26.40, change: -1.30, changePct: -4.69, volume: 28400000, direction: 'down' },
  { symbol: 'BA', name: 'Boeing Co.', price: 175.20, change: -6.40, changePct: -3.52, volume: 14300000, direction: 'down' },
  { symbol: 'SU.TO', name: 'Suncor Energy', price: 51.20, change: -1.60, changePct: -3.03, volume: 7800000, direction: 'down' },
  { symbol: 'RIO', name: 'Rio Tinto', price: 68.90, change: -1.90, changePct: -2.68, volume: 4200000, direction: 'down' },
]

export const MOCK_MARKET_BREADTH: MarketBreadth = {
  advancing: 312,
  declining: 188,
  unchanged: 7,
  newHighs: 42,
  newLows: 18,
  timestamp: new Date().toISOString(),
}

// ─── Security Quote ───────────────────────────────────────────────────────────

export const MOCK_SECURITY_QUOTE: Quote = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  price: 189.30,
  change: 2.75,
  changePct: 1.47,
  volume: 58200000,
  marketCap: 2_950_000_000_000,
  currency: 'USD',
  exchange: 'NASDAQ',
  lastUpdated: new Date().toISOString(),
  trustMode: 'TRUSTED',
}

// ─── Provider Health ──────────────────────────────────────────────────────────

export const MOCK_PROVIDER_HEALTH: ProviderHealth[] = [
  { providerId: 'mock', name: 'Mock Data', status: 'UP', lastCheck: new Date().toISOString(), latencyMs: 0 },
  { providerId: 'alpha_vantage', name: 'Alpha Vantage', status: 'DOWN', lastCheck: new Date().toISOString(), errorMessage: 'Not configured' },
  { providerId: 'polygon', name: 'Polygon.io', status: 'DOWN', lastCheck: new Date().toISOString(), errorMessage: 'Not configured' },
]

// ─── Private Assets ───────────────────────────────────────────────────────────

export const MOCK_PRIVATE_ASSETS: PrivateAsset[] = [
  {
    id: 'pa1',
    name: 'Northleaf Capital Partners III',
    manager: 'Northleaf Capital',
    type: 'PRIVATE_EQUITY',
    vintage: 2020,
    commitment: 500000,
    called: 380000,
    uncalled: 120000,
    nav: 495000,
    distributions: 60000,
    tvpi: 1.46,
    dpi: 0.16,
    irr: 18.4,
    currency: 'CAD',
    liquidity: 'ILLIQUID',
    nextLiquidityDate: '2028-06-30',
    lastValuationDate: '2024-09-30',
    trustMode: 'DEGRADED',
  },
  {
    id: 'pa2',
    name: 'Brookfield Real Estate Fund V',
    manager: 'Brookfield Asset Management',
    type: 'REAL_ESTATE',
    vintage: 2021,
    commitment: 300000,
    called: 245000,
    uncalled: 55000,
    nav: 278000,
    distributions: 22000,
    tvpi: 1.22,
    dpi: 0.09,
    currency: 'USD',
    liquidity: 'ILLIQUID',
    lastValuationDate: '2024-09-30',
    trustMode: 'DEGRADED',
  },
  {
    id: 'pa3',
    name: 'Kensington Private Credit Fund',
    manager: 'Kensington Capital',
    type: 'PRIVATE_CREDIT',
    vintage: 2022,
    commitment: 200000,
    called: 200000,
    uncalled: 0,
    nav: 214000,
    distributions: 18500,
    tvpi: 1.16,
    dpi: 0.09,
    irr: 11.2,
    currency: 'CAD',
    liquidity: 'QUARTERLY',
    lastValuationDate: '2024-12-31',
    trustMode: 'TRUSTED',
  },
]

export const MOCK_DISTRIBUTIONS: Distribution[] = [
  { date: '2024-09-15', amount: 22000, currency: 'CAD', type: 'RETURN_OF_CAPITAL', assetId: 'pa1' },
  { date: '2024-06-15', amount: 18000, currency: 'CAD', type: 'RETURN_OF_CAPITAL', assetId: 'pa1' },
  { date: '2024-03-15', amount: 20000, currency: 'CAD', type: 'RETURN_OF_CAPITAL', assetId: 'pa1' },
  { date: '2024-11-30', amount: 12000, currency: 'USD', type: 'INCOME', assetId: 'pa2' },
  { date: '2024-12-31', amount: 18500, currency: 'CAD', type: 'INCOME', assetId: 'pa3' },
]

export const MOCK_CASH_FLOWS: CashFlowEvent[] = [
  { date: '2024-12-15', amount: -50000, currency: 'CAD', type: 'CALL', assetId: 'pa1', assetName: 'Northleaf Capital Partners III' },
  { date: '2024-11-01', amount: -30000, currency: 'USD', type: 'CALL', assetId: 'pa2', assetName: 'Brookfield Real Estate Fund V' },
  { date: '2024-09-15', amount: 22000, currency: 'CAD', type: 'DISTRIBUTION', assetId: 'pa1', assetName: 'Northleaf Capital Partners III' },
  { date: '2024-11-30', amount: 12000, currency: 'USD', type: 'DISTRIBUTION', assetId: 'pa2', assetName: 'Brookfield Real Estate Fund V' },
  { date: '2024-12-31', amount: 18500, currency: 'CAD', type: 'DISTRIBUTION', assetId: 'pa3', assetName: 'Kensington Private Credit Fund' },
]

// ─── Macro ────────────────────────────────────────────────────────────────────

export const MOCK_MACRO_INDICATORS: MacroIndicator[] = [
  {
    id: 'cpi_us',
    name: 'CPI (US)',
    value: 3.2,
    unit: '%',
    previousValue: 3.4,
    change: -0.2,
    changePct: -5.88,
    trend: 'FALLING',
    reportDate: '2024-01-11',
    nextReleaseDate: '2024-02-13',
    source: 'BLS',
    trustMode: 'TRUSTED',
  },
  {
    id: 'gdp_us',
    name: 'GDP Growth (US)',
    value: 3.3,
    unit: '%',
    previousValue: 4.9,
    change: -1.6,
    changePct: -32.65,
    trend: 'FALLING',
    reportDate: '2024-01-25',
    nextReleaseDate: '2024-04-25',
    source: 'BEA',
    trustMode: 'TRUSTED',
  },
  {
    id: 'unemployment_us',
    name: 'Unemployment (US)',
    value: 3.7,
    unit: '%',
    previousValue: 3.7,
    change: 0,
    changePct: 0,
    trend: 'STABLE',
    reportDate: '2024-01-05',
    nextReleaseDate: '2024-02-02',
    source: 'BLS',
    trustMode: 'TRUSTED',
  },
  {
    id: 'fed_rate',
    name: 'Fed Funds Rate',
    value: 5.33,
    unit: '%',
    previousValue: 5.33,
    change: 0,
    changePct: 0,
    trend: 'STABLE',
    reportDate: '2024-01-31',
    nextReleaseDate: '2024-03-20',
    source: 'Fed',
    trustMode: 'TRUSTED',
  },
  {
    id: 'cpi_ca',
    name: 'CPI (Canada)',
    value: 3.4,
    unit: '%',
    previousValue: 3.1,
    change: 0.3,
    changePct: 9.68,
    trend: 'RISING',
    reportDate: '2024-01-16',
    nextReleaseDate: '2024-02-20',
    source: 'StatsCan',
    trustMode: 'TRUSTED',
  },
  {
    id: 'boc_rate',
    name: 'BoC Overnight Rate',
    value: 5.00,
    unit: '%',
    previousValue: 5.00,
    change: 0,
    changePct: 0,
    trend: 'STABLE',
    reportDate: '2024-01-24',
    nextReleaseDate: '2024-03-06',
    source: 'BoC',
    trustMode: 'TRUSTED',
  },
]

export const MOCK_YIELD_CURVE: YieldCurvePoint[] = [
  { tenor: '3M', yield: 5.38, change: 0.01 },
  { tenor: '6M', yield: 5.28, change: 0.01 },
  { tenor: '1Y', yield: 5.02, change: -0.01 },
  { tenor: '2Y', yield: 4.85, change: 0.04 },
  { tenor: '5Y', yield: 4.42, change: -0.01 },
  { tenor: '10Y', yield: 4.32, change: -0.02 },
  { tenor: '30Y', yield: 4.48, change: -0.01 },
]

export const MOCK_CENTRAL_BANKS: CentralBankDecision[] = [
  {
    bank: 'Federal Reserve',
    country: 'US',
    policyRate: 5.33,
    previousRate: 5.33,
    decisionDate: '2024-01-31',
    nextMeetingDate: '2024-03-20',
    bias: 'NEUTRAL',
    trustMode: 'TRUSTED',
  },
  {
    bank: 'Bank of Canada',
    country: 'CA',
    policyRate: 5.00,
    previousRate: 5.00,
    decisionDate: '2024-01-24',
    nextMeetingDate: '2024-03-06',
    bias: 'DOVISH',
    trustMode: 'TRUSTED',
  },
  {
    bank: 'European Central Bank',
    country: 'EU',
    policyRate: 4.50,
    previousRate: 4.50,
    decisionDate: '2024-01-25',
    nextMeetingDate: '2024-03-07',
    bias: 'NEUTRAL',
    trustMode: 'DEGRADED',
  },
]

export const MOCK_ECONOMIC_EVENTS: EconomicEvent[] = [
  { id: 'e1', date: '2024-02-02', time: '08:30', country: 'US', indicator: 'Nonfarm Payrolls', importance: 'HIGH', forecast: 185000, previous: 216000 },
  { id: 'e2', date: '2024-02-13', time: '08:30', country: 'US', indicator: 'CPI m/m', importance: 'HIGH', forecast: 0.2, previous: 0.3 },
  { id: 'e3', date: '2024-02-20', time: '08:30', country: 'CA', indicator: 'CPI y/y', importance: 'HIGH', forecast: 3.3, previous: 3.4 },
  { id: 'e4', date: '2024-03-06', time: '10:00', country: 'CA', indicator: 'BoC Rate Decision', importance: 'HIGH', forecast: 5.00, previous: 5.00 },
  { id: 'e5', date: '2024-03-20', time: '14:00', country: 'US', indicator: 'FOMC Rate Decision', importance: 'HIGH', forecast: 5.25, previous: 5.33 },
]

// ─── News ─────────────────────────────────────────────────────────────────────

export const MOCK_NEWS: NewsItem[] = [
  {
    id: 'n1',
    headline: 'Apple Reports Record Q1 Revenue of $119.6B, Beats Estimates',
    summary: 'Apple Inc. reported first-quarter fiscal 2024 revenue of $119.6 billion, surpassing analyst estimates. iPhone revenue came in at $69.7 billion, above the $68.1B consensus. Services revenue reached $23.1B, a record high.',
    source: 'Reuters',
    publishedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    signal: 'HIGH_SIGNAL',
    sentiment: 'POSITIVE',
    affectedSymbols: ['AAPL'],
    tags: ['earnings', 'revenue'],
    isStale: false,
  },
  {
    id: 'n2',
    headline: 'Fed Officials Signal No Rush to Cut Rates Despite Inflation Progress',
    summary: 'Several Federal Reserve officials indicated they are in no hurry to cut interest rates, emphasizing the need for more data to confirm inflation is durably moving toward the 2% target.',
    source: 'WSJ',
    publishedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    signal: 'HIGH_SIGNAL',
    sentiment: 'NEGATIVE',
    affectedSymbols: ['SPY', 'TLT', 'QQQ'],
    tags: ['fed', 'rates', 'policy'],
    isStale: false,
  },
  {
    id: 'n3',
    headline: 'TD Bank Faces Regulatory Scrutiny Over AML Controls in US Operations',
    summary: 'Toronto-Dominion Bank faces heightened regulatory scrutiny from US authorities regarding its anti-money laundering controls. The bank has set aside provisions for potential fines.',
    source: 'Globe and Mail',
    publishedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    signal: 'HIGH_SIGNAL',
    sentiment: 'NEGATIVE',
    affectedSymbols: ['TD.TO'],
    tags: ['regulatory', 'aml', 'banks'],
    isStale: false,
  },
  {
    id: 'n4',
    headline: 'Enbridge Completes Acquisition of US Gas Utilities from Dominion',
    summary: 'Enbridge Inc. has completed its $14 billion acquisition of three US natural gas utilities from Dominion Energy, strengthening its natural gas distribution footprint in the United States.',
    source: 'Financial Post',
    publishedAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    signal: 'MEDIUM_SIGNAL',
    sentiment: 'POSITIVE',
    affectedSymbols: ['ENB.TO'],
    tags: ['acquisition', 'utilities', 'gas'],
    isStale: false,
  },
  {
    id: 'n5',
    headline: 'Microsoft Azure Revenue Grows 28%, AI Services Drive Cloud Acceleration',
    summary: 'Microsoft reported strong Azure cloud revenue growth of 28% year-over-year, with AI-driven services contributing meaningfully for the first time. Copilot adoption is accelerating across enterprise customers.',
    source: 'Bloomberg',
    publishedAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    signal: 'HIGH_SIGNAL',
    sentiment: 'POSITIVE',
    affectedSymbols: ['MSFT'],
    tags: ['cloud', 'ai', 'azure', 'earnings'],
    isStale: false,
  },
  {
    id: 'n6',
    headline: 'Bank of Canada Holds Rates at 5%, Signals Potential Cuts Later in 2024',
    summary: 'The Bank of Canada held its overnight rate at 5% for the fourth consecutive meeting but signaled that rate cuts could come later in 2024 if inflation continues its downward trajectory.',
    source: 'CBC',
    publishedAt: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
    signal: 'MEDIUM_SIGNAL',
    sentiment: 'NEUTRAL',
    affectedSymbols: ['RY.TO', 'TD.TO', 'XIU.TO'],
    tags: ['boc', 'rates', 'canada'],
    isStale: true,
    staleReasonCode: 'OVER_4H',
  },
]
