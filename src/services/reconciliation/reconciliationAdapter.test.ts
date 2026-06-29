import { describe, it, expect } from 'vitest'
import { buildReconciliationInput } from './reconciliationAdapter'
import type { Holding, CashPosition } from '@/types/portfolio'
import type { LedgerState, DerivedPosition, CashBalance } from '@/types/ledger'

// ─── Factories ────────────────────────────────────────────────────────────────

function emptyLedgerState(): LedgerState {
  return {
    positions: [],
    cashBalances: [],
    realizedGains: [],
    income: [],
    totalFees: {},
    totalTax: {},
    warnings: [],
  }
}

function holding(symbol: string): Holding {
  return {
    id: `h-${symbol}`,
    symbol,
    name: symbol,
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Technology',
    assetClass: 'EQUITY',
    shares: 100,
    costBasis: 150,
    currentPrice: 160,
    currentValue: 16000,
    unrealizedPnL: 1000,
    unrealizedPnLPct: 6.67,
    dayChange: 0,
    dayChangePct: 0,
    weight: 0.1,
    trustMode: 'TRUSTED',
  }
}

function cash(currency: string, amount: number): CashPosition {
  return { currency, amount, usdEquivalent: amount, pct: 100 }
}

function position(securityId: string, quantity = 100): DerivedPosition {
  return {
    securityId,
    symbol: securityId,
    currency: 'USD',
    quantity,
    totalCost: quantity * 150,
    averageCost: 150,
    realizedPnL: 0,
    lastTransactionDate: '2026-01-01',
  }
}

function cashBalance(currency: string, amount: number): CashBalance {
  return { currency, amount }
}

// ─── Content equality ─────────────────────────────────────────────────────────

describe('buildReconciliationInput — content equality', () => {
  it('portfolioHoldings is deeply equal to input holdings', () => {
    const holdings = [holding('AAPL'), holding('TSLA')]
    const result = buildReconciliationInput(holdings, [], emptyLedgerState(), 'T')
    expect(result.portfolioHoldings).toEqual(holdings)
  })

  it('ledgerPositions is deeply equal to ledgerState.positions', () => {
    const pos = [position('US:AAPL'), position('US:TSLA')]
    const ls = { ...emptyLedgerState(), positions: pos }
    const result = buildReconciliationInput([], [], ls, 'T')
    expect(result.ledgerPositions).toEqual(pos)
  })

  it('portfolioCash is deeply equal to input cashPositions', () => {
    const cashPos = [cash('USD', 1000), cash('CAD', 500)]
    const result = buildReconciliationInput([], cashPos, emptyLedgerState(), 'T')
    expect(result.portfolioCash).toEqual(cashPos)
  })

  it('ledgerCash is deeply equal to ledgerState.cashBalances', () => {
    const balances = [cashBalance('USD', 900), cashBalance('CAD', 450)]
    const ls = { ...emptyLedgerState(), cashBalances: balances }
    const result = buildReconciliationInput([], [], ls, 'T')
    expect(result.ledgerCash).toEqual(balances)
  })

  it('reconciledAt is preserved verbatim', () => {
    const ts = '2026-06-29T11:00:00.000Z'
    const result = buildReconciliationInput([], [], emptyLedgerState(), ts)
    expect(result.reconciledAt).toBe(ts)
  })
})

// ─── Reference independence ───────────────────────────────────────────────────

describe('buildReconciliationInput — different references', () => {
  it('portfolioHoldings is a new array (shallow copy)', () => {
    const holdings = [holding('AAPL')]
    const result = buildReconciliationInput(holdings, [], emptyLedgerState(), 'T')
    expect(result.portfolioHoldings).not.toBe(holdings)
  })

  it('ledgerPositions is a new array (shallow copy)', () => {
    const pos = [position('US:AAPL')]
    const ls = { ...emptyLedgerState(), positions: pos }
    const result = buildReconciliationInput([], [], ls, 'T')
    expect(result.ledgerPositions).not.toBe(pos)
    expect(result.ledgerPositions).not.toBe(ls.positions)
  })

  it('portfolioCash is a new array (shallow copy)', () => {
    const cashPos = [cash('USD', 1000)]
    const result = buildReconciliationInput([], cashPos, emptyLedgerState(), 'T')
    expect(result.portfolioCash).not.toBe(cashPos)
  })

  it('ledgerCash is a new array (shallow copy)', () => {
    const balances = [cashBalance('USD', 900)]
    const ls = { ...emptyLedgerState(), cashBalances: balances }
    const result = buildReconciliationInput([], [], ls, 'T')
    expect(result.ledgerCash).not.toBe(balances)
    expect(result.ledgerCash).not.toBe(ls.cashBalances)
  })
})

// ─── Input mutation ───────────────────────────────────────────────────────────

describe('buildReconciliationInput — no input mutation', () => {
  it('does not mutate source holdings array', () => {
    const holdings = [holding('AAPL')]
    const snapshot = [...holdings]
    buildReconciliationInput(holdings, [], emptyLedgerState(), 'T')
    expect(holdings).toEqual(snapshot)
  })

  it('does not mutate source cashPositions array', () => {
    const cashPos = [cash('USD', 1000)]
    const snapshot = [...cashPos]
    buildReconciliationInput([], cashPos, emptyLedgerState(), 'T')
    expect(cashPos).toEqual(snapshot)
  })

  it('does not mutate ledgerState.positions', () => {
    const pos = [position('US:AAPL')]
    const ls = { ...emptyLedgerState(), positions: pos }
    const snapshot = [...pos]
    buildReconciliationInput([], [], ls, 'T')
    expect(ls.positions).toEqual(snapshot)
  })

  it('does not mutate ledgerState.cashBalances', () => {
    const balances = [cashBalance('USD', 900)]
    const ls = { ...emptyLedgerState(), cashBalances: balances }
    const snapshot = [...balances]
    buildReconciliationInput([], [], ls, 'T')
    expect(ls.cashBalances).toEqual(snapshot)
  })
})

// ─── Empty array inputs ───────────────────────────────────────────────────────

describe('buildReconciliationInput — empty arrays are valid', () => {
  it('produces valid ReconciliationInput when all sources are empty', () => {
    const result = buildReconciliationInput([], [], emptyLedgerState(), 'T')
    expect(result.portfolioHoldings).toEqual([])
    expect(result.ledgerPositions).toEqual([])
    expect(result.portfolioCash).toEqual([])
    expect(result.ledgerCash).toEqual([])
  })

  it('portfolioHoldings is a new empty array even when source is empty', () => {
    const holdings: Holding[] = []
    const result = buildReconciliationInput(holdings, [], emptyLedgerState(), 'T')
    expect(result.portfolioHoldings).not.toBe(holdings)
    expect(result.portfolioHoldings).toEqual([])
  })
})
