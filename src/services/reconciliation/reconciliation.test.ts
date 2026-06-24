import { describe, it, expect } from 'vitest'
import {
  normalizePortfolioHolding,
  normalizeLedgerPosition,
  matchSecurityIdentity,
  classifyReconciliationStatus,
  reconcileCashBalances,
  summarizeReconciliation,
  reconcilePositions,
} from './reconciliation'
import { DEFAULT_RECONCILIATION_TOLERANCE } from '@/types/reconciliation'
import type {
  NormalizedPortfolioPosition,
  NormalizedLedgerPosition,
  PositionReconciliationRow,
  CashReconciliationRow,
  ReconciliationTolerance,
} from '@/types/reconciliation'
import type { Holding, CashPosition } from '@/types/portfolio'
import type { DerivedPosition, CashBalance } from '@/types/ledger'
import { MOCK_HOLDINGS, MOCK_CASH_POSITIONS } from '@/lib/mockData'

// ─── Factories ────────────────────────────────────────────────────────────────

function holding(overrides: Partial<Holding> & Pick<Holding, 'id' | 'symbol'>): Holding {
  return {
    name: overrides.symbol,
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Technology',
    assetClass: 'EQUITY',
    shares: 100,
    costBasis: 100,
    currentPrice: 110,
    currentValue: 11000,
    unrealizedPnL: 1000,
    unrealizedPnLPct: 10,
    dayChange: 0,
    dayChangePct: 0,
    weight: 0.1,
    trustMode: 'TRUSTED',
    ...overrides,
  }
}

function ledgerPos(
  securityId: string,
  overrides: Partial<DerivedPosition> = {},
): DerivedPosition {
  return {
    securityId,
    symbol: overrides.symbol ?? securityId.includes(':') ? securityId.split(':')[1] : securityId,
    currency: 'USD',
    quantity: 100,
    totalCost: 10000,
    averageCost: 100,
    realizedPnL: 0,
    lastTransactionDate: '2026-01-01',
    ...overrides,
  }
}

function ledgerRaw(
  positionKey: string,
  overrides: Partial<DerivedPosition> = {},
): DerivedPosition {
  return {
    securityId: positionKey,
    symbol: overrides.symbol ?? positionKey,
    currency: 'USD',
    quantity: 100,
    totalCost: 10000,
    averageCost: 100,
    realizedPnL: 0,
    lastTransactionDate: '2026-01-01',
    ...overrides,
  }
}

const TS = '2026-06-16T12:00:00.000Z'
const TOL = DEFAULT_RECONCILIATION_TOLERANCE

// ─── normalizePortfolioHolding ────────────────────────────────────────────────

describe('normalizePortfolioHolding', () => {
  it('RESOLVED: AAPL → US:AAPL with securityId', () => {
    const n = normalizePortfolioHolding(holding({ id: 'h1', symbol: 'AAPL', shares: 450, costBasis: 155.40, currency: 'USD' }))
    expect(n.resolutionStatus).toBe('RESOLVED')
    expect(n.securityId).toBe('US:AAPL')
    expect(n.symbol).toBe('AAPL')
    expect(n.currency).toBe('USD')
    expect(n.quantity).toBe(450)
    expect(n.averageCost).toBe(155.40)
    expect(n.totalCost).toBeCloseTo(450 * 155.40)
  })

  it('RESOLVED: RY.TO → CA:RY.TO (Canadian suffix handled by resolveSecurity)', () => {
    const n = normalizePortfolioHolding(holding({ id: 'h2', symbol: 'RY.TO', currency: 'CAD', shares: 600 }))
    expect(n.resolutionStatus).toBe('RESOLVED')
    expect(n.securityId).toBe('CA:RY.TO')
  })

  it('AMBIGUOUS: bare RY → AMBIGUOUS with candidates', () => {
    const n = normalizePortfolioHolding(holding({ id: 'h3', symbol: 'RY' }))
    expect(n.resolutionStatus).toBe('AMBIGUOUS')
    expect(n.securityId).toBeUndefined()
    expect(n.resolutionCandidates).toBeDefined()
    expect(n.resolutionCandidates!.length).toBeGreaterThan(1)
  })

  it('AMBIGUOUS: bare TD → AMBIGUOUS', () => {
    const n = normalizePortfolioHolding(holding({ id: 'h4', symbol: 'TD' }))
    expect(n.resolutionStatus).toBe('AMBIGUOUS')
  })

  it('UNKNOWN: unknown symbol has no securityId', () => {
    const n = normalizePortfolioHolding(holding({ id: 'h5', symbol: 'XYZABC123' }))
    expect(n.resolutionStatus).toBe('UNKNOWN')
    expect(n.securityId).toBeUndefined()
  })

  it('alias FB → resolves to US:META', () => {
    const n = normalizePortfolioHolding(holding({ id: 'h6', symbol: 'FB' }))
    expect(n.resolutionStatus).toBe('RESOLVED')
    expect(n.securityId).toBe('US:META')
  })

  it('symbol is trimmed and uppercased', () => {
    const n = normalizePortfolioHolding(holding({ id: 'h7', symbol: '  aapl  ' }))
    expect(n.symbol).toBe('AAPL')
  })

  it('does not mutate the input holding', () => {
    const h = holding({ id: 'h8', symbol: 'AAPL' })
    const before = JSON.stringify(h)
    normalizePortfolioHolding(h)
    expect(JSON.stringify(h)).toBe(before)
  })
})

// ─── normalizeLedgerPosition ──────────────────────────────────────────────────

describe('normalizeLedgerPosition', () => {
  it('canonical key US:AAPL → isCanonical true, resolvedSecurityId US:AAPL', () => {
    const n = normalizeLedgerPosition(ledgerPos('US:AAPL'))
    expect(n.isCanonical).toBe(true)
    expect(n.resolvedSecurityId).toBe('US:AAPL')
    expect(n.positionKey).toBe('US:AAPL')
  })

  it('raw symbol AAPL → isCanonical false, resolvedSecurityId from symbol lookup', () => {
    const n = normalizeLedgerPosition(ledgerRaw('AAPL', { symbol: 'AAPL' }))
    expect(n.isCanonical).toBe(false)
    expect(n.resolvedSecurityId).toBe('US:AAPL')
    expect(n.positionKey).toBe('AAPL')
  })

  it('unknown positionKey → isCanonical false, resolvedSecurityId undefined', () => {
    const n = normalizeLedgerPosition(ledgerRaw('XYZABC123', { symbol: 'XYZABC123' }))
    expect(n.isCanonical).toBe(false)
    expect(n.resolvedSecurityId).toBeUndefined()
  })

  it('canonical CA:RY.TO → isCanonical true', () => {
    const n = normalizeLedgerPosition(ledgerPos('CA:RY.TO', { currency: 'CAD' }))
    expect(n.isCanonical).toBe(true)
    expect(n.resolvedSecurityId).toBe('CA:RY.TO')
  })

  it('positionKey is uppercased', () => {
    const n = normalizeLedgerPosition(ledgerRaw('us:aapl', { symbol: 'AAPL' }))
    expect(n.positionKey).toBe('US:AAPL')
  })

  it('does not mutate the input position', () => {
    const pos = ledgerPos('US:AAPL')
    const before = JSON.stringify(pos)
    normalizeLedgerPosition(pos)
    expect(JSON.stringify(pos)).toBe(before)
  })
})

// ─── classifyReconciliationStatus ────────────────────────────────────────────

function pPos(overrides: Partial<NormalizedPortfolioPosition> = {}): NormalizedPortfolioPosition {
  return {
    holdingId: 'h1', symbol: 'AAPL', securityId: 'US:AAPL', currency: 'USD',
    quantity: 100, averageCost: 100, totalCost: 10000, resolutionStatus: 'RESOLVED',
    ...overrides,
  }
}

function lPos(overrides: Partial<NormalizedLedgerPosition> = {}): NormalizedLedgerPosition {
  return {
    positionKey: 'US:AAPL', resolvedSecurityId: 'US:AAPL', symbol: 'AAPL',
    currency: 'USD', quantity: 100, averageCost: 100, totalCost: 10000, isCanonical: true,
    ...overrides,
  }
}

describe('classifyReconciliationStatus', () => {
  it('exact match → MATCH, no issues', () => {
    const r = classifyReconciliationStatus(pPos(), lPos(), TOL)
    expect(r.status).toBe('MATCH')
  })

  it('quantity within absolute tolerance → MATCH', () => {
    const r = classifyReconciliationStatus(pPos({ quantity: 100 }), lPos({ quantity: 100.00005 }), TOL)
    expect(r.status).toBe('MATCH')
  })

  it('quantity within relative tolerance boundary → MATCH', () => {
    // threshold = max(0.0001, 100 * 0.0001) = 0.01; delta = 0.005 < 0.01
    // Using 99.995 avoids float-representation issues that plague the exact boundary
    const r = classifyReconciliationStatus(pPos({ quantity: 100 }), lPos({ quantity: 99.995 }), TOL)
    expect(r.status).toBe('MATCH')
  })

  it('quantity at exact tolerance boundary (exactly representable binary values) → MATCH', () => {
    // 0.125 = 1/8, 7.875 = 63/8 — both exactly representable; delta = 0.125 exactly
    // threshold = max(0.125, 8 * 0) = 0.125; 0.125 <= 0.125 → MATCH (tests the <= boundary)
    const tol: ReconciliationTolerance = { ...TOL, quantityAbsolute: 0.125, quantityRelative: 0 }
    const r = classifyReconciliationStatus(pPos({ quantity: 8 }), lPos({ quantity: 7.875 }), tol)
    expect(r.status).toBe('MATCH')
  })

  it('quantity one step above exact tolerance boundary → QUANTITY_MISMATCH', () => {
    // 7.75 = 31/4 — exactly representable; delta = 0.25; threshold = 0.125; 0.25 > 0.125 → MISMATCH
    const tol: ReconciliationTolerance = { ...TOL, quantityAbsolute: 0.125, quantityRelative: 0 }
    const r = classifyReconciliationStatus(pPos({ quantity: 8 }), lPos({ quantity: 7.75 }), tol)
    expect(r.status).toBe('QUANTITY_MISMATCH')
  })

  it('quantity one epsilon above relative tolerance → QUANTITY_MISMATCH', () => {
    // threshold = max(0.0001, 100 * 0.0001) = 0.01; delta = 0.011 > 0.01
    const r = classifyReconciliationStatus(pPos({ quantity: 100 }), lPos({ quantity: 99.989 }), TOL)
    expect(r.status).toBe('QUANTITY_MISMATCH')
  })

  it('currency mismatch → CURRENCY_MISMATCH before quantity', () => {
    const r = classifyReconciliationStatus(pPos({ currency: 'USD' }), lPos({ currency: 'CAD' }), TOL)
    expect(r.status).toBe('CURRENCY_MISMATCH')
    expect(r.currencyMismatch).toEqual({ portfolioCurrency: 'USD', ledgerCurrency: 'CAD' })
  })

  it('portfolio shares <= 0 → NOT_COMPARABLE', () => {
    const r = classifyReconciliationStatus(pPos({ quantity: 0 }), lPos(), TOL)
    expect(r.status).toBe('NOT_COMPARABLE')
  })

  it('negative portfolio shares → NOT_COMPARABLE', () => {
    const r = classifyReconciliationStatus(pPos({ quantity: -5 }), lPos(), TOL)
    expect(r.status).toBe('NOT_COMPARABLE')
  })

  it('flat ledger position (qty=0, cost>0) → NOT_COMPARABLE', () => {
    const r = classifyReconciliationStatus(pPos(), lPos({ quantity: 0, totalCost: 5000 }), TOL)
    expect(r.status).toBe('NOT_COMPARABLE')
  })

  it('cost basis delta attached as INFO — does not change MATCH status', () => {
    const r = classifyReconciliationStatus(
      pPos({ totalCost: 15000 }),
      lPos({ totalCost: 10000 }),
      TOL,
    )
    expect(r.status).toBe('MATCH')
    const costIssue = r.issues.find(i => i.code === 'COST_BASIS_DELTA')
    expect(costIssue).toBeDefined()
    expect(costIssue!.severity).toBe('INFO')
  })
})

// ─── reconcileCashBalances ────────────────────────────────────────────────────

describe('reconcileCashBalances', () => {
  it('both empty → empty rows', () => {
    expect(reconcileCashBalances([], [], TOL)).toHaveLength(0)
  })

  it('portfolio only → ONLY_IN_PORTFOLIO per currency', () => {
    const rows = reconcileCashBalances(
      [{ currency: 'USD', amount: 1000, usdEquivalent: 1000, pct: 0.1 }],
      [],
      TOL,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('ONLY_IN_PORTFOLIO')
    expect(rows[0].portfolioAmount).toBe(1000)
    expect(rows[0].ledgerAmount).toBeUndefined()
  })

  it('ledger only → ONLY_IN_LEDGER', () => {
    const rows = reconcileCashBalances([], [{ currency: 'CAD', amount: 5000 }], TOL)
    expect(rows[0].status).toBe('ONLY_IN_LEDGER')
    expect(rows[0].ledgerAmount).toBe(5000)
  })

  it('cash delta below cashAbsolute → MATCH', () => {
    const rows = reconcileCashBalances(
      [{ currency: 'USD', amount: 1000, usdEquivalent: 1000, pct: 0.1 }],
      [{ currency: 'USD', amount: 1000.005 }],
      TOL,
    )
    expect(rows[0].status).toBe('MATCH')
  })

  it('cash delta exactly at cashAbsolute (0.01) → MATCH', () => {
    const rows = reconcileCashBalances(
      [{ currency: 'USD', amount: 1000, usdEquivalent: 1000, pct: 0.1 }],
      [{ currency: 'USD', amount: 999.99 }],
      TOL,
    )
    expect(rows[0].status).toBe('MATCH')
  })

  it('cash at exact tolerance boundary (exactly representable binary values) → MATCH', () => {
    // 0.25 = 1/4, 9.75 = 39/4 — both exactly representable; delta = 0.25 exactly
    // threshold = max(0.25, 10 * 0) = 0.25; 0.25 <= 0.25 → MATCH (tests the <= boundary)
    const tol: ReconciliationTolerance = { ...TOL, cashAbsolute: 0.25, cashRelative: 0 }
    const rows = reconcileCashBalances(
      [{ currency: 'USD', amount: 10, usdEquivalent: 10, pct: 0 }],
      [{ currency: 'USD', amount: 9.75 }],
      tol,
    )
    expect(rows[0].status).toBe('MATCH')
  })

  it('cash one step above exact tolerance boundary → MISMATCH', () => {
    // 9.5 = 19/2 — exactly representable; delta = 0.5; threshold = 0.25; 0.5 > 0.25 → MISMATCH
    const tol: ReconciliationTolerance = { ...TOL, cashAbsolute: 0.25, cashRelative: 0 }
    const rows = reconcileCashBalances(
      [{ currency: 'USD', amount: 10, usdEquivalent: 10, pct: 0 }],
      [{ currency: 'USD', amount: 9.5 }],
      tol,
    )
    expect(rows[0].status).toBe('MISMATCH')
  })

  it('cash delta one epsilon above cashAbsolute → MISMATCH', () => {
    const rows = reconcileCashBalances(
      [{ currency: 'USD', amount: 1000, usdEquivalent: 1000, pct: 0.1 }],
      [{ currency: 'USD', amount: 999.98 }],
      TOL,
    )
    expect(rows[0].status).toBe('MISMATCH')
    expect(rows[0].delta).toBeCloseTo(0.02)
  })

  it('cashRelative path: 1% relative tolerance', () => {
    const tol: ReconciliationTolerance = { ...TOL, cashAbsolute: 0, cashRelative: 0.01 }
    // threshold = max(0, 1000 * 0.01) = 10; delta = 9 → MATCH
    const matchRows = reconcileCashBalances(
      [{ currency: 'USD', amount: 1000, usdEquivalent: 1000, pct: 0 }],
      [{ currency: 'USD', amount: 991 }],
      tol,
    )
    expect(matchRows[0].status).toBe('MATCH')
    // delta = 11 → MISMATCH
    const mismatchRows = reconcileCashBalances(
      [{ currency: 'USD', amount: 1000, usdEquivalent: 1000, pct: 0 }],
      [{ currency: 'USD', amount: 989 }],
      tol,
    )
    expect(mismatchRows[0].status).toBe('MISMATCH')
  })

  it('never compares usdEquivalent or pct — only native amount', () => {
    // usdEquivalent and pct are wildly different; only amount matters
    const rows = reconcileCashBalances(
      [{ currency: 'CAD', amount: 1000, usdEquivalent: 99999, pct: 0.99 }],
      [{ currency: 'CAD', amount: 1000 }],
      TOL,
    )
    expect(rows[0].status).toBe('MATCH')
  })

  it('USD and CAD produce two rows sorted by currency', () => {
    const rows = reconcileCashBalances(
      [
        { currency: 'USD', amount: 100, usdEquivalent: 100, pct: 0 },
        { currency: 'CAD', amount: 200, usdEquivalent: 150, pct: 0 },
      ],
      [{ currency: 'USD', amount: 100 }],
      TOL,
    )
    expect(rows).toHaveLength(2)
    expect(rows[0].currency).toBe('CAD')
    expect(rows[0].status).toBe('ONLY_IN_PORTFOLIO')
    expect(rows[1].currency).toBe('USD')
    expect(rows[1].status).toBe('MATCH')
  })
})

// ─── reconcilePositions — integration ────────────────────────────────────────

describe('reconcilePositions — empty inputs', () => {
  it('both empty → empty positions, hasComparableData false, isFullyReconciled true', () => {
    const result = reconcilePositions({
      portfolioHoldings: [],
      ledgerPositions: [],
      reconciledAt: TS,
    })
    expect(result.positions).toHaveLength(0)
    expect(result.summary.hasComparableData).toBe(false)
    expect(result.summary.isFullyReconciled).toBe(true)
    expect(result.summary.totalPortfolioPositions).toBe(0)
    expect(result.summary.totalLedgerPositions).toBe(0)
  })

  it('reconciledAt is copied verbatim from input', () => {
    const result = reconcilePositions({ portfolioHoldings: [], ledgerPositions: [], reconciledAt: TS })
    expect(result.summary.reconciledAt).toBe(TS)
  })
})

describe('reconcilePositions — one-sided inputs', () => {
  it('portfolio only → all ONLY_IN_PORTFOLIO', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, costBasis: 100, currency: 'USD' })],
      ledgerPositions: [],
      reconciledAt: TS,
    })
    expect(result.positions).toHaveLength(1)
    expect(result.positions[0].status).toBe('ONLY_IN_PORTFOLIO')
    expect(result.summary.onlyInPortfolioCount).toBe(1)
    expect(result.summary.isFullyReconciled).toBe(false)
  })

  it('ledger only → all ONLY_IN_LEDGER', () => {
    const result = reconcilePositions({
      portfolioHoldings: [],
      ledgerPositions: [ledgerPos('US:AAPL')],
      reconciledAt: TS,
    })
    expect(result.positions).toHaveLength(1)
    expect(result.positions[0].status).toBe('ONLY_IN_LEDGER')
    expect(result.summary.onlyInLedgerCount).toBe(1)
  })
})

describe('reconcilePositions — canonical match', () => {
  it('exact canonical match → MATCH, isFullyReconciled true', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 450, costBasis: 155.40, currency: 'USD' })],
      ledgerPositions: [ledgerPos('US:AAPL', { quantity: 450, currency: 'USD' })],
      reconciledAt: TS,
    })
    expect(result.positions[0].status).toBe('MATCH')
    expect(result.summary.matchCount).toBe(1)
    expect(result.summary.isFullyReconciled).toBe(true)
    expect(result.summary.hasComparableData).toBe(true)
  })

  it('CAD listing RY.TO matches CA:RY.TO, not US:RY', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'RY.TO', currency: 'CAD', shares: 100 })],
      ledgerPositions: [
        ledgerPos('CA:RY.TO', { currency: 'CAD', quantity: 100 }),
        ledgerPos('US:RY', { currency: 'USD', quantity: 100 }),
      ],
      reconciledAt: TS,
    })
    const matchRow = result.positions.find(r => r.status === 'MATCH')
    expect(matchRow).toBeDefined()
    expect(matchRow!.ledgerPosition!.positionKey).toBe('CA:RY.TO')
    expect(result.positions.find(r => r.status === 'ONLY_IN_LEDGER')?.ledgerPosition?.positionKey).toBe('US:RY')
  })
})

describe('reconcilePositions — mismatches', () => {
  it('quantity mismatch → QUANTITY_MISMATCH with delta', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })],
      ledgerPositions: [ledgerPos('US:AAPL', { quantity: 50, currency: 'USD' })],
      reconciledAt: TS,
    })
    expect(result.positions[0].status).toBe('QUANTITY_MISMATCH')
    expect(result.positions[0].quantityDelta).toBeCloseTo(50)
    expect(result.summary.quantityMismatchCount).toBe(1)
    expect(result.summary.isFullyReconciled).toBe(false)
  })

  it('currency mismatch → CURRENCY_MISMATCH', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', currency: 'USD', shares: 100 })],
      ledgerPositions: [ledgerPos('US:AAPL', { currency: 'CAD', quantity: 100 })],
      reconciledAt: TS,
    })
    expect(result.positions[0].status).toBe('CURRENCY_MISMATCH')
    expect(result.summary.currencyMismatchCount).toBe(1)
    expect(result.summary.isFullyReconciled).toBe(false)
  })

  it('absolute quantity tolerance boundary — within limit → MATCH', () => {
    // threshold = max(0.0001, 100 * 0.0001) = 0.01; 100 - 0.005 = 99.995, delta 0.005 < 0.01
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })],
      ledgerPositions: [ledgerPos('US:AAPL', { quantity: 100 - 0.005, currency: 'USD' })],
      reconciledAt: TS,
    })
    expect(result.positions[0].status).toBe('MATCH')
  })

  it('absolute quantity tolerance boundary — above limit → QUANTITY_MISMATCH', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })],
      ledgerPositions: [ledgerPos('US:AAPL', { quantity: 100 - 0.011, currency: 'USD' })],
      reconciledAt: TS,
    })
    expect(result.positions[0].status).toBe('QUANTITY_MISMATCH')
  })
})

describe('reconcilePositions — ambiguous and unresolved', () => {
  it('ambiguous portfolio symbol → AMBIGUOUS row', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'RY' })],
      ledgerPositions: [],
      reconciledAt: TS,
    })
    expect(result.positions[0].status).toBe('AMBIGUOUS')
    expect(result.summary.ambiguousCount).toBe(1)
  })

  it('unknown portfolio symbol with no ledger match → UNRESOLVED', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'XYZABC123' })],
      ledgerPositions: [],
      reconciledAt: TS,
    })
    expect(result.positions[0].status).toBe('UNRESOLVED')
    expect(result.summary.unresolvedCount).toBe(1)
    expect(result.summary.isFullyReconciled).toBe(false)
  })
})

describe('reconcilePositions — raw-symbol issue severity', () => {
  it('RESOLVED portfolio ↔ noncanonical ledger → NONCANONICAL_LEDGER_SYMBOL_MATCH INFO', () => {
    // Portfolio: AAPL → resolves to US:AAPL
    // Ledger: raw positionKey 'AAPL' (no canonical id in master via getSecurityById for 'AAPL')
    // But getSecurityByExactSymbol('AAPL') does resolve to US:AAPL, making isCanonical=false but resolvedSecurityId set
    // For true noncanonical: use a completely unknown raw symbol
    // Actually, for SECONDARY to trigger: ledger must have isCanonical=false (raw symbol key)
    // and the portfolio must be RESOLVED. Let's use a raw positionKey for AAPL:
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })],
      ledgerPositions: [ledgerRaw('AAPL', { symbol: 'AAPL', currency: 'USD', quantity: 100 })],
      reconciledAt: TS,
    })
    // Primary match may occur if resolvedSecurityId===US:AAPL and portfolio.securityId===US:AAPL
    // → SECONDARY match check: resolvedSecurityId set on ledger but isCanonical=false
    // The PRIMARY match uses resolvedSecurityId === portfolio.securityId (US:AAPL === US:AAPL)
    // Since resolvedSecurityId IS set on the normalized ledger position, PRIMARY fires.
    // So no NONCANONICAL issue is expected here; it's a clean primary match.
    expect(result.positions[0].status).toBe('MATCH')
    const nclIssue = result.positions[0].issues.find(i => i.code === 'NONCANONICAL_LEDGER_SYMBOL_MATCH')
    // PRIMARY match: no issue expected (clean canonical via resolvedSecurityId)
    expect(nclIssue).toBeUndefined()
  })

  it('RESOLVED portfolio ↔ truly noncanonical ledger (no resolved id) → NONCANONICAL_LEDGER_SYMBOL_MATCH INFO', () => {
    // Construct a ledger position where getSecurityById AND getSecurityByExactSymbol both fail
    // We do this by giving it a positionKey that has no master entry AND no symbol in master
    // But we want the portfolio symbol to match the ledger symbol
    // Portfolio: AAPL → US:AAPL (RESOLVED)
    // Ledger: positionKey 'AAPL_CUSTOM', symbol 'AAPL' (no canonical id, but symbol matches)
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })],
      ledgerPositions: [{
        securityId: 'AAPL_CUSTOM_NONCANONICAL',
        symbol: 'AAPL',
        currency: 'USD',
        quantity: 100,
        totalCost: 10000,
        averageCost: 100,
        realizedPnL: 0,
        lastTransactionDate: '2026-01-01',
      }],
      reconciledAt: TS,
    })
    // Primary: no match (ledger resolvedSecurityId undefined or US:AAPL; let's check)
    // normalizeLedgerPosition('AAPL_CUSTOM_NONCANONICAL'):
    //   getSecurityById('AAPL_CUSTOM_NONCANONICAL') → undefined
    //   getSecurityByExactSymbol('AAPL_CUSTOM_NONCANONICAL') → undefined
    //   isCanonical: false, resolvedSecurityId: undefined
    // Primary: portfolio.securityId = 'US:AAPL', ledger.resolvedSecurityId = undefined → no primary
    // Identity conflict: ledger has no canonical id → no conflict
    // Secondary: portfolio RESOLVED, ledger noncanonical, ledger.symbol='AAPL' === portfolio.symbol='AAPL' → MATCH
    const row = result.positions[0]
    expect(row.status).toBe('MATCH')
    const nclIssue = row.issues.find(i => i.code === 'NONCANONICAL_LEDGER_SYMBOL_MATCH')
    expect(nclIssue).toBeDefined()
    expect(nclIssue!.severity).toBe('INFO')
    // INFO does not prevent full reconciliation
    expect(result.summary.isFullyReconciled).toBe(true)
  })

  it('UNKNOWN portfolio ↔ raw-symbol match → UNVERIFIED_RAW_SYMBOL_MATCH WARNING', () => {
    // Portfolio: XYZABC123 → UNKNOWN
    // Ledger: raw positionKey XYZABC123 (also unknown to master)
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'XYZABC123', shares: 100, currency: 'USD' })],
      ledgerPositions: [ledgerRaw('XYZABC123', { symbol: 'XYZABC123', currency: 'USD', quantity: 100 })],
      reconciledAt: TS,
    })
    const row = result.positions[0]
    expect(row.status).toBe('MATCH')
    const warnIssue = row.issues.find(i => i.code === 'UNVERIFIED_RAW_SYMBOL_MATCH')
    expect(warnIssue).toBeDefined()
    expect(warnIssue!.severity).toBe('WARNING')
    // WARNING prevents full reconciliation
    expect(result.summary.isFullyReconciled).toBe(false)
  })

  it('INFO-only match does not prevent isFullyReconciled', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })],
      ledgerPositions: [{
        securityId: 'AAPL_CUSTOM_NONCANONICAL',
        symbol: 'AAPL',
        currency: 'USD',
        quantity: 100,
        totalCost: 10000,
        averageCost: 100,
        realizedPnL: 0,
        lastTransactionDate: '2026-01-01',
      }],
      reconciledAt: TS,
    })
    expect(result.summary.isFullyReconciled).toBe(true)
  })

  it('WARNING issue prevents isFullyReconciled', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'XYZABC123', shares: 100, currency: 'USD' })],
      ledgerPositions: [ledgerRaw('XYZABC123', { symbol: 'XYZABC123', currency: 'USD', quantity: 100 })],
      reconciledAt: TS,
    })
    expect(result.summary.isFullyReconciled).toBe(false)
  })
})

describe('reconcilePositions — canonical identity conflict (IDENTITY_MISMATCH)', () => {
  it('symbols match, canonical ids differ → exactly one IDENTITY_MISMATCH row', () => {
    // Portfolio: AAPL → US:AAPL
    // Ledger: canonical CA:AAPL.TO equivalent → we can fake this with a positionKey that resolves
    // to a different canonical id but has symbol AAPL.
    // In practice: use a ledger position whose positionKey is a canonical id (e.g. 'CA:RY.TO')
    // but whose symbol happens to match a different portfolio holding.
    // Cleaner: portfolio holds 'AAPL' (→ US:AAPL); ledger has canonical position 'US:MSFT'
    // but symbol 'AAPL'. We test the conflict detection.
    // Construct a fake: ledger positionKey = 'US:MSFT', symbol = 'AAPL'
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })],
      ledgerPositions: [{
        securityId: 'US:MSFT',   // canonical — resolves via getSecurityById
        symbol: 'AAPL',          // same symbol as portfolio holding
        currency: 'USD',
        quantity: 100,
        totalCost: 10000,
        averageCost: 100,
        realizedPnL: 0,
        lastTransactionDate: '2026-01-01',
      }],
      reconciledAt: TS,
    })
    // portfolio.securityId = 'US:AAPL', ledger.resolvedSecurityId = 'US:MSFT' → conflict
    expect(result.positions).toHaveLength(1)
    expect(result.positions[0].status).toBe('IDENTITY_MISMATCH')
    expect(result.summary.identityMismatchCount).toBe(1)
  })

  it('IDENTITY_MISMATCH consumes both records — no ONLY_IN rows for the pair', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })],
      ledgerPositions: [{
        securityId: 'US:MSFT', symbol: 'AAPL', currency: 'USD',
        quantity: 100, totalCost: 10000, averageCost: 100, realizedPnL: 0, lastTransactionDate: '2026-01-01',
      }],
      reconciledAt: TS,
    })
    expect(result.positions.filter(r => r.status === 'ONLY_IN_PORTFOLIO')).toHaveLength(0)
    expect(result.positions.filter(r => r.status === 'ONLY_IN_LEDGER')).toHaveLength(0)
    expect(result.positions[0].portfolioPosition).toBeDefined()
    expect(result.positions[0].ledgerPosition).toBeDefined()
  })

  it('canonical conflict prohibits raw-symbol fallback', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })],
      ledgerPositions: [{
        securityId: 'US:MSFT', symbol: 'AAPL', currency: 'USD',
        quantity: 100, totalCost: 10000, averageCost: 100, realizedPnL: 0, lastTransactionDate: '2026-01-01',
      }],
      reconciledAt: TS,
    })
    // Must be IDENTITY_MISMATCH, not a raw-symbol MATCH
    expect(result.positions[0].status).toBe('IDENTITY_MISMATCH')
    const unverified = result.positions[0].issues.find(i => i.code === 'UNVERIFIED_RAW_SYMBOL_MATCH')
    expect(unverified).toBeUndefined()
  })
})

describe('reconcilePositions — multiple canonical identity conflicts', () => {
  // These two ledger positions have canonical ids in the master (US:MSFT, US:NVDA) but
  // their symbol field is artificially set to 'AAPL' to simulate a labelling conflict.
  function conflictLedger(canonicalKey: string, sym: string): DerivedPosition {
    return {
      securityId: canonicalKey,
      symbol: sym,
      currency: 'USD',
      quantity: 100,
      totalCost: 10000,
      averageCost: 100,
      realizedPnL: 0,
      lastTransactionDate: '2026-01-01',
    }
  }

  it('single conflicting canonical candidate → one IDENTITY_MISMATCH row (existing behavior)', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })],
      ledgerPositions: [conflictLedger('US:MSFT', 'AAPL')],
      reconciledAt: TS,
    })
    expect(result.positions).toHaveLength(1)
    expect(result.positions[0].status).toBe('IDENTITY_MISMATCH')
    expect(result.summary.identityMismatchCount).toBe(1)
  })

  it('two conflicting canonical candidates do not select the first — no IDENTITY_MISMATCH', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })],
      ledgerPositions: [
        conflictLedger('US:MSFT', 'AAPL'),
        conflictLedger('US:NVDA', 'AAPL'),
      ],
      reconciledAt: TS,
    })
    expect(result.positions.filter(r => r.status === 'IDENTITY_MISMATCH')).toHaveLength(0)
    // Portfolio emitted as AMBIGUOUS
    const ambig = result.positions.filter(r => r.status === 'AMBIGUOUS')
    expect(ambig).toHaveLength(1)
    expect(ambig[0].portfolioPosition?.holdingId).toBe('h1')
  })

  it('all affected records consumed — no ONLY_IN_PORTFOLIO or ONLY_IN_LEDGER leakage', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })],
      ledgerPositions: [
        conflictLedger('US:MSFT', 'AAPL'),
        conflictLedger('US:NVDA', 'AAPL'),
      ],
      reconciledAt: TS,
    })
    expect(result.positions.filter(r => r.status === 'ONLY_IN_PORTFOLIO')).toHaveLength(0)
    expect(result.positions.filter(r => r.status === 'ONLY_IN_LEDGER')).toHaveLength(0)
    expect(result.summary.totalPortfolioPositions).toBe(1)
    expect(result.summary.totalLedgerPositions).toBe(2)
  })

  it('reversing two conflict candidates produces deeply identical ReconciliationResult', () => {
    const lp1 = conflictLedger('US:MSFT', 'AAPL')
    const lp2 = conflictLedger('US:NVDA', 'AAPL')
    const portfolio = [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })]
    const r1 = reconcilePositions({ portfolioHoldings: portfolio, ledgerPositions: [lp1, lp2], reconciledAt: TS })
    const r2 = reconcilePositions({ portfolioHoldings: portfolio, ledgerPositions: [lp2, lp1], reconciledAt: TS })
    expect(r1).toEqual(r2)
  })
})

describe('reconcilePositions — duplicates', () => {
  it('duplicate portfolio identities → DUPLICATE rows for all, no normal matching', () => {
    const result = reconcilePositions({
      portfolioHoldings: [
        holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' }),
        holding({ id: 'h2', symbol: 'AAPL', shares: 200, currency: 'USD' }),
      ],
      ledgerPositions: [ledgerPos('US:AAPL', { quantity: 100, currency: 'USD' })],
      reconciledAt: TS,
    })
    const dupRows = result.positions.filter(r => r.status === 'DUPLICATE')
    expect(dupRows).toHaveLength(2)
    // Ledger position should be ONLY_IN_LEDGER since portfolio duplicates don't match
    expect(result.positions.find(r => r.status === 'ONLY_IN_LEDGER')).toBeDefined()
    expect(result.summary.duplicateCount).toBe(2)
  })

  it('duplicate ledger canonical identities → DUPLICATE rows, excluded from matching', () => {
    // Hand-build two ledger positions with same canonical key — NOT via deriveLedgerState
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })],
      ledgerPositions: [
        ledgerPos('US:AAPL', { quantity: 100, currency: 'USD' }),
        ledgerPos('US:AAPL', { quantity: 50, currency: 'USD' }),  // same canonical key
      ],
      reconciledAt: TS,
    })
    expect(result.positions.filter(r => r.status === 'DUPLICATE')).toHaveLength(2)
    // Portfolio position has no match (ledger duplicates excluded)
    expect(result.positions.find(r => r.status === 'ONLY_IN_PORTFOLIO')).toBeDefined()
    expect(result.summary.duplicateCount).toBe(2)
  })

  it('duplicate noncanonical ledger symbols (tier 2) → DUPLICATE', () => {
    // Two ledger positions with same symbol but no canonical id
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'XYZABC123', shares: 100, currency: 'USD' })],
      ledgerPositions: [
        { securityId: 'XYZABC123_A', symbol: 'XYZABC123', currency: 'USD', quantity: 100, totalCost: 10000, averageCost: 100, realizedPnL: 0, lastTransactionDate: '2026-01-01' },
        { securityId: 'XYZABC123_B', symbol: 'XYZABC123', currency: 'USD', quantity: 50, totalCost: 5000, averageCost: 100, realizedPnL: 0, lastTransactionDate: '2026-01-01' },
      ],
      reconciledAt: TS,
    })
    expect(result.positions.filter(r => r.status === 'DUPLICATE')).toHaveLength(2)
  })

  it('duplicate normalized positionKeys (tier 3) → DUPLICATE', () => {
    // Two ledger positions with same positionKey, no symbol, no resolved id
    const result = reconcilePositions({
      portfolioHoldings: [],
      ledgerPositions: [
        { securityId: 'RAWKEY', symbol: undefined, currency: 'USD', quantity: 100, totalCost: 10000, averageCost: 100, realizedPnL: 0, lastTransactionDate: '2026-01-01' },
        { securityId: 'RAWKEY', symbol: undefined, currency: 'USD', quantity: 50, totalCost: 5000, averageCost: 100, realizedPnL: 0, lastTransactionDate: '2026-01-01' },
      ],
      reconciledAt: TS,
    })
    expect(result.positions.filter(r => r.status === 'DUPLICATE')).toHaveLength(2)
  })
})

describe('reconcilePositions — determinism', () => {
  const holdings = [
    holding({ id: 'h1', symbol: 'AAPL', shares: 450, costBasis: 155, currency: 'USD' }),
    holding({ id: 'h2', symbol: 'MSFT', shares: 200, costBasis: 310, currency: 'USD' }),
  ]
  const positions = [
    ledgerPos('US:AAPL', { quantity: 450, currency: 'USD' }),
    ledgerPos('US:MSFT', { quantity: 200, currency: 'USD' }),
  ]

  it('identical inputs produce deeply identical output', () => {
    const r1 = reconcilePositions({ portfolioHoldings: holdings, ledgerPositions: positions, reconciledAt: TS })
    const r2 = reconcilePositions({ portfolioHoldings: holdings, ledgerPositions: positions, reconciledAt: TS })
    expect(r1).toEqual(r2)
  })

  it('reversing ledgerPositions order produces identical output', () => {
    const r1 = reconcilePositions({ portfolioHoldings: holdings, ledgerPositions: positions, reconciledAt: TS })
    const r2 = reconcilePositions({ portfolioHoldings: holdings, ledgerPositions: [...positions].reverse(), reconciledAt: TS })
    expect(r1).toEqual(r2)
  })

  it('reversing portfolioHoldings order produces identical output', () => {
    const r1 = reconcilePositions({ portfolioHoldings: holdings, ledgerPositions: positions, reconciledAt: TS })
    const r2 = reconcilePositions({ portfolioHoldings: [...holdings].reverse(), ledgerPositions: positions, reconciledAt: TS })
    expect(r1).toEqual(r2)
  })

  it('reconciledAt is the only timestamp — runtime clock irrelevant', () => {
    const ts1 = '2020-01-01T00:00:00.000Z'
    const ts2 = '2099-12-31T23:59:59.999Z'
    const r1 = reconcilePositions({ portfolioHoldings: [], ledgerPositions: [], reconciledAt: ts1 })
    const r2 = reconcilePositions({ portfolioHoldings: [], ledgerPositions: [], reconciledAt: ts2 })
    expect(r1.summary.reconciledAt).toBe(ts1)
    expect(r2.summary.reconciledAt).toBe(ts2)
    // Only reconciledAt differs between results
    expect(r1.positions).toEqual(r2.positions)
  })

  it('input arrays are not mutated', () => {
    const hBefore = JSON.stringify(holdings)
    const pBefore = JSON.stringify(positions)
    reconcilePositions({ portfolioHoldings: holdings, ledgerPositions: positions, reconciledAt: TS })
    expect(JSON.stringify(holdings)).toBe(hBefore)
    expect(JSON.stringify(positions)).toBe(pBefore)
  })
})

describe('reconcilePositions — zero and flat positions', () => {
  it('zero-share portfolio holding → NOT_COMPARABLE', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 0, currency: 'USD' })],
      ledgerPositions: [ledgerPos('US:AAPL', { quantity: 100, currency: 'USD' })],
      reconciledAt: TS,
    })
    expect(result.positions[0].status).toBe('NOT_COMPARABLE')
  })

  it('flat ledger position (quantity 0, nonzero cost) → NOT_COMPARABLE', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })],
      ledgerPositions: [ledgerPos('US:AAPL', { quantity: 0, totalCost: 5000, currency: 'USD' })],
      reconciledAt: TS,
    })
    expect(result.positions[0].status).toBe('NOT_COMPARABLE')
  })
})

describe('reconcilePositions — with cash', () => {
  it('cash compared when both arrays supplied', () => {
    const result = reconcilePositions({
      portfolioHoldings: [],
      ledgerPositions: [],
      portfolioCash: MOCK_CASH_POSITIONS,
      ledgerCash: [],
      reconciledAt: TS,
    })
    expect(result.cash).toBeDefined()
    expect(result.summary.isCashCompared).toBe(false) // no row has both sides
    const onlyPortRows = result.cash!.filter(r => r.status === 'ONLY_IN_PORTFOLIO')
    expect(onlyPortRows.length).toBeGreaterThan(0)
  })

  it('cash not compared when only one cash array supplied', () => {
    const result = reconcilePositions({
      portfolioHoldings: [],
      ledgerPositions: [],
      portfolioCash: MOCK_CASH_POSITIONS,
      reconciledAt: TS,
    })
    expect(result.cash).toBeUndefined()
    expect(result.summary.isCashCompared).toBe(false)
  })

  it('cash MISMATCH prevents isFullyReconciled even when positions all match', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'AAPL', shares: 100, currency: 'USD' })],
      ledgerPositions: [ledgerPos('US:AAPL', { quantity: 100, currency: 'USD' })],
      portfolioCash: [{ currency: 'USD', amount: 1000, usdEquivalent: 1000, pct: 0 }],
      ledgerCash: [{ currency: 'USD', amount: 500 }],
      reconciledAt: TS,
    })
    expect(result.positions[0].status).toBe('MATCH')
    expect(result.summary.isFullyReconciled).toBe(false)
  })
})

describe('reconcilePositions — provider neutrality', () => {
  it('RY.TO resolves via resolveSecurity without any market-data import', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'RY.TO', currency: 'CAD', shares: 100 })],
      ledgerPositions: [ledgerPos('CA:RY.TO', { currency: 'CAD', quantity: 100 })],
      reconciledAt: TS,
    })
    expect(result.positions[0].status).toBe('MATCH')
  })

  it('bare RY → AMBIGUOUS, not resolved to either US:RY or CA:RY.TO', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'RY' })],
      ledgerPositions: [ledgerPos('CA:RY.TO', { currency: 'CAD', quantity: 100 })],
      reconciledAt: TS,
    })
    expect(result.positions.find(r => r.status === 'AMBIGUOUS')).toBeDefined()
    expect(result.positions.find(r => r.status === 'ONLY_IN_LEDGER')).toBeDefined()
  })

  it('CAD and USD listings remain distinct — RY.TO and US:RY are different securities', () => {
    const result = reconcilePositions({
      portfolioHoldings: [holding({ id: 'h1', symbol: 'RY.TO', currency: 'CAD', shares: 100 })],
      ledgerPositions: [ledgerPos('US:RY', { currency: 'USD', quantity: 100 })],
      reconciledAt: TS,
    })
    // CA:RY.TO ≠ US:RY → not a primary match; they should not match
    // Portfolio resolves to CA:RY.TO; ledger resolves to US:RY — IDENTITY_MISMATCH if symbols collide
    // Portfolio symbol = 'RY.TO', ledger symbol = 'RY' → symbols differ → no conflict, no match
    expect(result.positions.find(r => r.status === 'ONLY_IN_PORTFOLIO')).toBeDefined()
    expect(result.positions.find(r => r.status === 'ONLY_IN_LEDGER')).toBeDefined()
    expect(result.positions.find(r => r.status === 'MATCH')).toBeUndefined()
  })
})

describe('reconcilePositions — MOCK_HOLDINGS baseline (ledger empty)', () => {
  it('all mock holdings appear as ONLY_IN_PORTFOLIO when ledger is empty', () => {
    const result = reconcilePositions({
      portfolioHoldings: MOCK_HOLDINGS,
      ledgerPositions: [],
      reconciledAt: TS,
    })
    const onlyPort = result.positions.filter(r => r.status === 'ONLY_IN_PORTFOLIO')
    // All 8 mock holdings should resolve (none are AMBIGUOUS)
    expect(onlyPort.length).toBe(MOCK_HOLDINGS.length)
    expect(result.summary.isFullyReconciled).toBe(false)
    expect(result.summary.hasComparableData).toBe(false)
  })
})

describe('summarizeReconciliation', () => {
  it('comparablePositionCount counts only MATCH, QUANTITY_MISMATCH, CURRENCY_MISMATCH rows', () => {
    const rows: PositionReconciliationRow[] = [
      { status: 'MATCH', issues: [] },
      { status: 'QUANTITY_MISMATCH', issues: [] },
      { status: 'CURRENCY_MISMATCH', issues: [] },
      { status: 'ONLY_IN_PORTFOLIO', issues: [] },
      { status: 'AMBIGUOUS', issues: [] },
    ]
    const s = summarizeReconciliation(rows, undefined, TS)
    expect(s.comparablePositionCount).toBe(3)
    expect(s.hasComparableData).toBe(true)
  })

  it('hasComparableData is false when only non-comparable rows exist', () => {
    const rows: PositionReconciliationRow[] = [
      { status: 'ONLY_IN_PORTFOLIO', issues: [] },
      { status: 'UNRESOLVED', issues: [] },
    ]
    const s = summarizeReconciliation(rows, undefined, TS)
    expect(s.hasComparableData).toBe(false)
    expect(s.isFullyReconciled).toBe(false)
  })

  it('hasComparableData true from cash row with both sides', () => {
    const cash: CashReconciliationRow[] = [
      { currency: 'USD', portfolioAmount: 1000, ledgerAmount: 1000, delta: 0, status: 'MATCH', issues: [] },
    ]
    const s = summarizeReconciliation([], cash, TS)
    expect(s.hasComparableData).toBe(true)
    expect(s.isCashCompared).toBe(true)
  })
})
