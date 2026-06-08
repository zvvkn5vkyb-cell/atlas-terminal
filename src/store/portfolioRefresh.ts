import type { Quote, TrustMode } from '@/types/market'
import type { Holding, CashPosition, PortfolioSummary } from '@/types/portfolio'
import type { CreateAuditEntryParams } from '@/services/audit/auditLog'

// ─── PriceSource ──────────────────────────────────────────────────────────────
// Defined here (source of truth); re-exported by portfolioStore for UI imports.

export type PriceSource = 'LIVE' | 'FALLBACK' | 'MOCK' | 'CANADA'

export const CANADIAN_RE = /\.(TO|TSX|V)$/i

// ─── Summary ──────────────────────────────────────────────────────────────────
// Re-exported by portfolioStore; defined here so portfolioRefresh has no
// circular dependency back to the store.

export function computeSummary(holdings: Holding[], cash: CashPosition[]): PortfolioSummary {
  const totalEquity = holdings.reduce((s, h) => s + h.currentValue, 0)
  const totalCost = holdings.reduce((s, h) => s + h.costBasis * h.shares, 0)
  const totalCash = cash.reduce((s, c) => s + c.usdEquivalent, 0)
  const totalValue = totalEquity + totalCash
  const totalUnrealizedPnL = holdings.reduce((s, h) => s + h.unrealizedPnL, 0)
  const totalDayChange = holdings.reduce((s, h) => s + h.dayChange, 0)

  return {
    totalValue,
    totalCost,
    totalUnrealizedPnL,
    totalUnrealizedPnLPct: totalCost > 0 ? totalUnrealizedPnL / totalCost : 0,
    totalDayChange,
    totalDayChangePct: totalValue > 0 ? totalDayChange / (totalValue - totalDayChange) : 0,
    cashTotal: totalCash,
    cashPct: totalValue > 0 ? totalCash / totalValue : 0,
    equityTotal: totalEquity,
    equityPct: totalValue > 0 ? totalEquity / totalValue : 0,
    holdingCount: holdings.length,
    currency: 'USD',
    asOf: new Date().toISOString(),
  }
}

// ─── Source classification ────────────────────────────────────────────────────

export function classifySource(symbol: string, quote: Quote): PriceSource {
  // Symbol determines routing — Canadian suffix always wins regardless of quote data
  if (CANADIAN_RE.test(symbol)) return 'CANADA'
  if (quote.trustMode === 'TRUSTED' && quote.exchange === 'Polygon.io') return 'LIVE'
  if (quote.trustMode === 'DEGRADED') return 'FALLBACK'
  return 'MOCK'
}

// ─── Holding update ───────────────────────────────────────────────────────────

export function applyQuoteToHolding(holding: Holding, quote: Quote, src: PriceSource): Holding {
  if (src === 'LIVE') {
    const currentPrice = quote.price
    const currentValue = currentPrice * holding.shares
    const costTotal = holding.costBasis * holding.shares
    const unrealizedPnL = currentValue - costTotal
    return {
      ...holding,
      currentPrice,
      currentValue,
      unrealizedPnL,
      unrealizedPnLPct: costTotal > 0 ? unrealizedPnL / costTotal : 0,
      dayChange: quote.change * holding.shares,
      dayChangePct: quote.changePct,
      trustMode: 'TRUSTED' as TrustMode,
    }
  }
  if (src === 'FALLBACK') return { ...holding, trustMode: 'DEGRADED' as TrustMode }
  // CANADA and MOCK: price data unchanged
  return holding
}

// ─── Weight normalization ─────────────────────────────────────────────────────

export function normalizeWeights(holdings: Holding[], totalValue: number): Holding[] {
  return holdings.map(h => ({
    ...h,
    weight: totalValue > 0 ? h.currentValue / totalValue : 0,
  }))
}

// ─── Full refresh computation (pure — no store side-effects) ──────────────────

export interface QuoteResult {
  holdingId: string
  symbol: string
  quote: Quote
}

export interface RefreshedState {
  holdings: Holding[]
  priceSourceMap: Record<string, PriceSource>
  summary: PortfolioSummary
}

export function computeRefreshedState(
  holdings: Holding[],
  cashPositions: CashPosition[],
  quoteResults: QuoteResult[],
): RefreshedState {
  const sourceMap: Record<string, PriceSource> = {}
  const quoteById: Record<string, QuoteResult> = {}

  for (const r of quoteResults) {
    quoteById[r.holdingId] = r
    sourceMap[r.symbol] = classifySource(r.symbol, r.quote)
  }

  let updated = holdings.map((h): Holding => {
    const entry = quoteById[h.id]
    if (!entry) return h
    const src = sourceMap[h.symbol] ?? 'MOCK'
    return applyQuoteToHolding(h, entry.quote, src)
  })

  const totalCash = cashPositions.reduce((s, c) => s + c.usdEquivalent, 0)
  const totalEquity = updated.reduce((s, h) => s + h.currentValue, 0)
  updated = normalizeWeights(updated, totalEquity + totalCash)

  return {
    holdings: updated,
    priceSourceMap: sourceMap,
    summary: computeSummary(updated, cashPositions),
  }
}

// ─── Audit helper — price refresh event ──────────────────────────────────────
// Pure: no side-effects, fully testable in Node env. Called by portfolioStore
// after refreshPrices() completes.

export const DEFAULT_PORTFOLIO_ID = 'DEFAULT_PORTFOLIO'

export interface PriceRefreshAuditInput {
  previousSourceMap: Record<string, PriceSource>
  newSourceMap: Record<string, PriceSource>
  holdingCount: number
  resolvedCount: number
  completedAt: string
}

export function buildPriceRefreshAuditParams(input: PriceRefreshAuditInput): CreateAuditEntryParams {
  const { previousSourceMap, newSourceMap, holdingCount, resolvedCount, completedAt } = input
  let liveCount = 0, fallbackCount = 0, mockCount = 0, canadaCount = 0
  for (const src of Object.values(newSourceMap)) {
    if (src === 'LIVE') liveCount++
    else if (src === 'FALLBACK') fallbackCount++
    else if (src === 'MOCK') mockCount++
    else if (src === 'CANADA') canadaCount++
  }
  return {
    category: 'MARKET_DATA',
    action: 'MARKET_DATA.PRICE_REFRESH',
    entityType: 'PORTFOLIO',
    entityId: DEFAULT_PORTFOLIO_ID,
    source: 'SYSTEM',
    severity: resolvedCount === 0 && holdingCount > 0 ? 'WARNING' : 'INFO',
    reason: 'Portfolio price refresh completed',
    before: { priceSourceMap: previousSourceMap },
    after: { priceSourceMap: newSourceMap },
    metadata: { holdingCount, resolvedCount, liveCount, fallbackCount, mockCount, canadaCount, completedAt },
  }
}
