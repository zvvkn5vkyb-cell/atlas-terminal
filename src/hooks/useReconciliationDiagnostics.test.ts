// Tests for the pure runReconciliation export — no jsdom, no store access.
// useReconciliationDiagnostics (the React hook) is not tested here; its store
// reading and state management are covered by integration/component tests.

import { describe, it, expect } from 'vitest'
import { runReconciliation } from './useReconciliationDiagnostics'
import { EMPTY_LEDGER_STATE } from '@/services/ledger/constants'
import type { Holding, CashPosition } from '@/types/portfolio'
import type { LedgerState, DerivedPosition, CashBalance, LedgerTransaction } from '@/types/ledger'

// ─── Factories ────────────────────────────────────────────────────────────────

function holding(symbol: string, shares = 100): Holding {
  return {
    id: `h-${symbol}`,
    symbol,
    name: symbol,
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Technology',
    assetClass: 'EQUITY',
    shares,
    costBasis: 150,
    currentPrice: 160,
    currentValue: shares * 160,
    unrealizedPnL: shares * 10,
    unrealizedPnLPct: 6.67,
    dayChange: 0,
    dayChangePct: 0,
    weight: 0.1,
    trustMode: 'TRUSTED',
  }
}

function cashPos(currency: string, amount: number): CashPosition {
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

function buyTxn(id: string): LedgerTransaction {
  return {
    transactionId: id,
    type: 'BUY',
    tradeDate: '2026-01-01',
    securityId: 'RAWSYM',
    symbol: 'RAWSYM',
    quantity: 100,
    price: 150,
    currency: 'USD',
    source: 'MANUAL',
  }
}

function ledgerWith(
  positions: DerivedPosition[] = [],
  cashBalances: CashBalance[] = [],
): LedgerState {
  return { ...EMPTY_LEDGER_STATE, positions, cashBalances }
}

// ─── Snapshot shape ───────────────────────────────────────────────────────────

describe('runReconciliation — snapshot shape', () => {
  it('returns exactly { ledgerWasEmpty, result } — no runAt', () => {
    const snap = runReconciliation([], [], EMPTY_LEDGER_STATE, [], 'T')
    expect(Object.keys(snap).sort()).toEqual(['ledgerWasEmpty', 'result'])
  })

  it('result.summary.reconciledAt carries the run timestamp', () => {
    const ts = '2026-06-29T12:00:00.000Z'
    const { result } = runReconciliation([], [], EMPTY_LEDGER_STATE, [], ts)
    expect(result.summary.reconciledAt).toBe(ts)
  })

  it('no separate runAt value is needed — timestamp is in result.summary.reconciledAt', () => {
    const ts = '2026-01-15T08:00:00.000Z'
    const snap = runReconciliation([], [], EMPTY_LEDGER_STATE, [], ts)
    expect(Object.prototype.hasOwnProperty.call(snap, 'runAt')).toBe(false)
    expect(snap.result.summary.reconciledAt).toBe(ts)
  })
})

// ─── ledgerWasEmpty ───────────────────────────────────────────────────────────
// Definition: transactions.length === 0 (no raw transactions ever entered).
// A liquidated ledger has positions.length=0 but transactions.length>0 — NOT empty.

describe('runReconciliation — ledgerWasEmpty', () => {
  it('empty ledger (no transactions) → ledgerWasEmpty=true', () => {
    const { ledgerWasEmpty } = runReconciliation([], [], EMPTY_LEDGER_STATE, [], 'T')
    expect(ledgerWasEmpty).toBe(true)
  })

  it('ledger with one transaction → ledgerWasEmpty=false', () => {
    const { ledgerWasEmpty } = runReconciliation([], [], EMPTY_LEDGER_STATE, [buyTxn('t1')], 'T')
    expect(ledgerWasEmpty).toBe(false)
  })

  it('ledger with transactions but no open positions (liquidated) → ledgerWasEmpty=false', () => {
    const ls = ledgerWith([], [])
    const { ledgerWasEmpty } = runReconciliation([], [], ls, [buyTxn('t1'), buyTxn('t2')], 'T')
    expect(ledgerWasEmpty).toBe(false)
  })

  it('ledger with positions but no transactions (edge case) → ledgerWasEmpty=true', () => {
    // ledgerWasEmpty is driven by transactions.length only — documented behaviour
    const ls = ledgerWith([position('RAWSYM')])
    const { ledgerWasEmpty } = runReconciliation([], [], ls, [], 'T')
    expect(ledgerWasEmpty).toBe(true)
  })
})

// ─── Populated matching ledger ────────────────────────────────────────────────

describe('runReconciliation — populated matching ledger', () => {
  it('matching symbol and quantity produces at least one MATCH row', () => {
    const ls = ledgerWith([position('RAWSYM', 100)])
    const { result } = runReconciliation(
      [holding('RAWSYM', 100)],
      [],
      ls,
      [buyTxn('t1')],
      '2026-06-29T12:00:00.000Z',
    )
    expect(result.positions.find(r => r.status === 'MATCH')).toBeDefined()
  })

  it('no holdings and no ledger positions → no position rows', () => {
    const { result } = runReconciliation([], [], EMPTY_LEDGER_STATE, [buyTxn('t1')], 'T')
    expect(result.positions).toHaveLength(0)
  })
})

// ─── Quantity mismatch ────────────────────────────────────────────────────────

describe('runReconciliation — quantity mismatch', () => {
  it('portfolio qty 100, ledger qty 200 → QUANTITY_MISMATCH row', () => {
    const ls = ledgerWith([position('RAWSYM', 200)])
    const { result } = runReconciliation([holding('RAWSYM', 100)], [], ls, [buyTxn('t1')], 'T')
    expect(result.positions.find(r => r.matchKey === 'RAWSYM')?.status).toBe('QUANTITY_MISMATCH')
  })

  it('quantity mismatch row has non-zero quantityDelta', () => {
    const ls = ledgerWith([position('RAWSYM', 200)])
    const { result } = runReconciliation([holding('RAWSYM', 100)], [], ls, [buyTxn('t1')], 'T')
    const row = result.positions.find(r => r.matchKey === 'RAWSYM')
    expect(Math.abs(row!.quantityDelta!)).toBeGreaterThan(0)
  })
})

// ─── Warning-bearing MATCH ────────────────────────────────────────────────────

describe('runReconciliation — warning-bearing MATCH result', () => {
  it('RAWSYM unknown to security master → MATCH with UNVERIFIED_RAW_SYMBOL_MATCH warning', () => {
    const ls = ledgerWith([position('RAWSYM', 100)])
    const { result } = runReconciliation([holding('RAWSYM', 100)], [], ls, [buyTxn('t1')], 'T')
    const row = result.positions.find(r => r.matchKey === 'RAWSYM')
    expect(row?.status).toBe('MATCH')
    expect(row?.issues.some(i => i.code === 'UNVERIFIED_RAW_SYMBOL_MATCH')).toBe(true)
    expect(row?.issues.some(i => i.severity === 'WARNING')).toBe(true)
  })
})

// ─── reconciledAt propagation ─────────────────────────────────────────────────

describe('runReconciliation — reconciledAt propagation', () => {
  it('caller-supplied reconciledAt is preserved verbatim in result.summary', () => {
    const ts = '2026-06-15T10:00:00.000Z'
    const { result } = runReconciliation([], [], EMPTY_LEDGER_STATE, [], ts)
    expect(result.summary.reconciledAt).toBe(ts)
  })

  it('different reconciledAt values produce different summary.reconciledAt', () => {
    const ts1 = '2026-01-01T00:00:00.000Z'
    const ts2 = '2026-06-01T00:00:00.000Z'
    expect(runReconciliation([], [], EMPTY_LEDGER_STATE, [], ts1).result.summary.reconciledAt).toBe(ts1)
    expect(runReconciliation([], [], EMPTY_LEDGER_STATE, [], ts2).result.summary.reconciledAt).toBe(ts2)
  })
})

// ─── No source mutation ───────────────────────────────────────────────────────

describe('runReconciliation — no source mutation', () => {
  it('does not mutate source holdings array', () => {
    const holdings = [holding('RAWSYM')]
    const before = JSON.stringify(holdings)
    runReconciliation(holdings, [], ledgerWith([position('RAWSYM')]), [buyTxn('t1')], 'T')
    expect(JSON.stringify(holdings)).toBe(before)
  })

  it('does not mutate source cashPositions array', () => {
    const cash = [cashPos('USD', 1000)]
    const before = JSON.stringify(cash)
    runReconciliation([], cash, EMPTY_LEDGER_STATE, [], 'T')
    expect(JSON.stringify(cash)).toBe(before)
  })

  it('does not mutate ledgerState.positions', () => {
    const ls = ledgerWith([position('RAWSYM')])
    const before = JSON.stringify(ls.positions)
    runReconciliation([holding('RAWSYM')], [], ls, [buyTxn('t1')], 'T')
    expect(JSON.stringify(ls.positions)).toBe(before)
  })

  it('does not mutate ledgerState.cashBalances', () => {
    const ls = ledgerWith([], [cashBalance('USD', 900)])
    const before = JSON.stringify(ls.cashBalances)
    runReconciliation([], [cashPos('USD', 1000)], ls, [], 'T')
    expect(JSON.stringify(ls.cashBalances)).toBe(before)
  })
})

// ─── Determinism ──────────────────────────────────────────────────────────────

describe('runReconciliation — determinism', () => {
  it('repeated identical inputs produce identical results', () => {
    const holdings = [holding('RAWSYM', 100)]
    const ls = ledgerWith([position('RAWSYM', 100)])
    const txns = [buyTxn('t1')]
    const ts = '2026-06-29T12:00:00.000Z'

    const r1 = runReconciliation(holdings, [], ls, txns, ts)
    const r2 = runReconciliation(holdings, [], ls, txns, ts)

    expect(r1.ledgerWasEmpty).toBe(r2.ledgerWasEmpty)
    expect(r1.result.positions.length).toBe(r2.result.positions.length)
    expect(r1.result.positions[0]?.status).toBe(r2.result.positions[0]?.status)
    expect(r1.result.summary.matchCount).toBe(r2.result.summary.matchCount)
  })

  it('empty inputs repeated produce consistent results', () => {
    const r1 = runReconciliation([], [], EMPTY_LEDGER_STATE, [], 'T')
    const r2 = runReconciliation([], [], EMPTY_LEDGER_STATE, [], 'T')
    expect(r1.result.positions).toHaveLength(0)
    expect(r2.result.positions).toHaveLength(0)
    expect(r1.ledgerWasEmpty).toBe(r2.ledgerWasEmpty)
  })
})

// ─── No store writes or persistence ──────────────────────────────────────────

describe('runReconciliation — no store writes or persistence', () => {
  it('returns a plain object — pure function, no store side effects', () => {
    const { result, ledgerWasEmpty } = runReconciliation([], [], EMPTY_LEDGER_STATE, [], 'T')
    expect(typeof result).toBe('object')
    expect(typeof ledgerWasEmpty).toBe('boolean')
    // Pure functions return new objects each call
    const second = runReconciliation([], [], EMPTY_LEDGER_STATE, [], 'T')
    expect(result).not.toBe(second.result)
  })
})
