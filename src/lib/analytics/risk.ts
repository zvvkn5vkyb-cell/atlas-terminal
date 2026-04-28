import type {
  Holding,
  NAVSnapshot,
  BenchmarkPrice,
  RiskSummary,
  ConcentrationMetric,
  DrawdownMetric,
  VolatilityMetric,
  BetaMetric,
  AllocationBucket,
  RiskFlag,
} from '@/types/portfolio'
import { RISK_THRESHOLDS } from '@/lib/constants'

export function calculateConcentration(holdings: Holding[]): ConcentrationMetric {
  const sorted = [...holdings].sort((a, b) => b.weight - a.weight)
  const top1 = sorted[0]?.weight ?? 0
  const top3 = sorted.slice(0, 3).reduce((s, h) => s + h.weight, 0)
  const top5 = sorted.slice(0, 5).reduce((s, h) => s + h.weight, 0)

  let level: ConcentrationMetric['level'] = 'LOW'
  if (top3 > RISK_THRESHOLDS.concentrationHigh) level = 'HIGH'
  else if (top3 > RISK_THRESHOLDS.concentrationMedium) level = 'MEDIUM'

  return { top1Pct: top1, top3Pct: top3, top5Pct: top5, level }
}

export function calculateSectorExposure(holdings: Holding[]): AllocationBucket[] {
  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0)
  const map = new Map<string, number>()
  for (const h of holdings) {
    const sector = h.sector || 'Unknown'
    map.set(sector, (map.get(sector) ?? 0) + h.currentValue)
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value, pct: value / totalValue }))
    .sort((a, b) => b.pct - a.pct)
}

export function calculateCurrencyExposure(holdings: Holding[]): AllocationBucket[] {
  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0)
  const map = new Map<string, number>()
  for (const h of holdings) {
    map.set(h.currency, (map.get(h.currency) ?? 0) + h.currentValue)
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value, pct: value / totalValue }))
    .sort((a, b) => b.pct - a.pct)
}

export function calculateDrawdown(snapshots: NAVSnapshot[]): DrawdownMetric {
  if (snapshots.length < 2) {
    return {
      currentDrawdown: 0,
      peakNav: 0,
      peakDate: '',
      currentNav: 0,
      trustMode: 'INSUFFICIENT_DATA',
    }
  }

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))
  let peak = sorted[0].nav
  let peakDate = sorted[0].date

  for (const s of sorted) {
    if (s.nav > peak) {
      peak = s.nav
      peakDate = s.date
    }
  }

  const current = sorted[sorted.length - 1].nav
  const drawdown = (current - peak) / peak

  return {
    currentDrawdown: drawdown,
    peakNav: peak,
    peakDate,
    currentNav: current,
    trustMode: 'TRUSTED',
  }
}

export function calculateVolatility(snapshots: NAVSnapshot[]): VolatilityMetric {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))

  const dailyReturns: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const r = (sorted[i].nav - sorted[i - 1].nav) / sorted[i - 1].nav
    dailyReturns.push(r)
  }

  if (dailyReturns.length < RISK_THRESHOLDS.minVolatilityDays) {
    return {
      annualizedVol: null,
      dailyReturnsUsed: dailyReturns.length,
      trustMode: 'INSUFFICIENT_DATA',
    }
  }

  const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length
  const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / dailyReturns.length
  const annualizedVol = Math.sqrt(variance) * Math.sqrt(252)

  return {
    annualizedVol,
    dailyReturnsUsed: dailyReturns.length,
    trustMode: 'TRUSTED',
  }
}

export function calculateBeta(
  navSnapshots: NAVSnapshot[],
  benchmarkPrices: BenchmarkPrice[],
): BetaMetric {
  const sortedNav = [...navSnapshots].sort((a, b) => a.date.localeCompare(b.date))
  const sortedBench = [...benchmarkPrices].sort((a, b) => a.date.localeCompare(b.date))

  const benchByDate = new Map(sortedBench.map(b => [b.date, b.price]))

  const pairs: { pr: number; br: number }[] = []
  for (let i = 1; i < sortedNav.length; i++) {
    const date = sortedNav[i].date
    const prevDate = sortedNav[i - 1].date
    const benchCurr = benchByDate.get(date)
    const benchPrev = benchByDate.get(prevDate)
    if (benchCurr == null || benchPrev == null) continue
    const pr = (sortedNav[i].nav - sortedNav[i - 1].nav) / sortedNav[i - 1].nav
    const br = (benchCurr - benchPrev) / benchPrev
    pairs.push({ pr, br })
  }

  if (pairs.length < RISK_THRESHOLDS.minVolatilityDays) {
    return { beta: null, overlapDays: pairs.length, trustMode: 'INSUFFICIENT_DATA' }
  }

  const meanPr = pairs.reduce((s, p) => s + p.pr, 0) / pairs.length
  const meanBr = pairs.reduce((s, p) => s + p.br, 0) / pairs.length

  const covariance = pairs.reduce((s, p) => s + (p.pr - meanPr) * (p.br - meanBr), 0) / pairs.length
  const variance = pairs.reduce((s, p) => s + (p.br - meanBr) ** 2, 0) / pairs.length

  if (variance === 0) return { beta: null, overlapDays: pairs.length, trustMode: 'INSUFFICIENT_DATA' }

  const beta = covariance / variance

  return { beta, overlapDays: pairs.length, trustMode: 'TRUSTED' }
}

export function buildRiskFlags(
  concentration: ConcentrationMetric,
  sectorExposure: AllocationBucket[],
  currencyExposure: AllocationBucket[],
  drawdown: DrawdownMetric,
  beta: BetaMetric,
): RiskFlag[] {
  const flags: RiskFlag[] = []

  if (concentration.top3Pct > RISK_THRESHOLDS.concentrationHigh) {
    flags.push({
      id: 'concentration_high',
      severity: 'HIGH',
      category: 'Concentration',
      message: `Top 3 positions represent ${(concentration.top3Pct * 100).toFixed(1)}% of portfolio`,
      value: concentration.top3Pct,
      threshold: RISK_THRESHOLDS.concentrationHigh,
    })
  }

  const dominantSector = sectorExposure[0]
  if (dominantSector && dominantSector.pct > RISK_THRESHOLDS.sectorConcentrationWarning) {
    flags.push({
      id: 'sector_concentration',
      severity: 'MEDIUM',
      category: 'Sector',
      message: `${dominantSector.label} represents ${(dominantSector.pct * 100).toFixed(1)}% of portfolio`,
      value: dominantSector.pct,
      threshold: RISK_THRESHOLDS.sectorConcentrationWarning,
    })
  }

  if (drawdown.trustMode === 'TRUSTED' && drawdown.currentDrawdown < -RISK_THRESHOLDS.drawdownWarning) {
    flags.push({
      id: 'drawdown_warning',
      severity: 'HIGH',
      category: 'Drawdown',
      message: `Portfolio in ${(Math.abs(drawdown.currentDrawdown) * 100).toFixed(1)}% drawdown from peak (${drawdown.peakDate})`,
      value: drawdown.currentDrawdown,
      threshold: -RISK_THRESHOLDS.drawdownWarning,
    })
  }

  const usdExposure = currencyExposure.find(c => c.label === 'USD')
  if (usdExposure && usdExposure.pct > RISK_THRESHOLDS.usdExposureWarning) {
    flags.push({
      id: 'usd_exposure',
      severity: 'LOW',
      category: 'Currency',
      message: `USD exposure at ${(usdExposure.pct * 100).toFixed(1)}% of portfolio`,
      value: usdExposure.pct,
      threshold: RISK_THRESHOLDS.usdExposureWarning,
    })
  }

  if (beta.trustMode === 'INSUFFICIENT_DATA') {
    flags.push({
      id: 'beta_unavailable',
      severity: 'LOW',
      category: 'Risk Metrics',
      message: `Beta unavailable — insufficient data overlap (${beta.overlapDays} days)`,
    })
  }

  return flags.slice(0, RISK_THRESHOLDS.maxRiskFlags)
}

export function calculateRiskSummary(
  holdings: Holding[],
  navSnapshots: NAVSnapshot[],
  benchmarkPrices: BenchmarkPrice[],
): RiskSummary {
  const concentration = calculateConcentration(holdings)
  const sectorExposure = calculateSectorExposure(holdings)
  const currencyExposure = calculateCurrencyExposure(holdings)
  const drawdown = calculateDrawdown(navSnapshots)
  const volatility = calculateVolatility(navSnapshots)
  const beta = calculateBeta(navSnapshots, benchmarkPrices)
  const riskFlags = buildRiskFlags(concentration, sectorExposure, currencyExposure, drawdown, beta)

  const degraded =
    drawdown.trustMode !== 'TRUSTED' ||
    volatility.trustMode !== 'TRUSTED' ||
    beta.trustMode !== 'TRUSTED'

  return {
    concentration,
    sectorExposure,
    currencyExposure,
    drawdown,
    volatility,
    beta,
    riskFlags,
    overallTrustMode: degraded ? 'DEGRADED' : 'TRUSTED',
  }
}
