import { describe, it, expect } from 'vitest'
import {
  generateTransactionId,
  applyAddTransaction,
  applyUpdateTransaction,
  applyDeleteTransaction,
  applyClearTransactions,
} from './ledgerActions'
import { deriveLedgerState } from '@/services/ledger/deriveLedgerState'
import type { LedgerTransaction } from '@/types/ledger'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buy(overrides: Partial<LedgerTransaction> = {}): LedgerTransaction {
  return {
    transactionId: 'txn-1',
    type: 'BUY',
    tradeDate: '2026-01-15',
    securityId: 'US:AAPL',
    symbol: 'AAPL',
    quantity: 100,
    price: 150,
    currency: 'USD',
    source: 'MANUAL',
    ...overrides,
  }
}

function deposit(overrides: Partial<LedgerTransaction> = {}): LedgerTransaction {
  return {
    transactionId: 'txn-2',
    type: 'DEPOSIT',
    tradeDate: '2026-01-10',
    amount: 10000,
    currency: 'USD',
    source: 'MANUAL',
    ...overrides,
  }
}

// ─── generateTransactionId ─────────────────────────────────────────────────────

describe('generateTransactionId', () => {
  it('produces txn-prefixed ids', () => {
    expect(generateTransactionId()).toMatch(/^txn-/)
  })

  it('produces unique ids across calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateTransactionId()))
    expect(ids.size).toBe(50)
  })
})

// ─── applyAddTransaction ─────────────────────────────────────────────────────────

describe('applyAddTransaction', () => {
  it('accepts a valid transaction', () => {
    const outcome = applyAddTransaction([], buy())
    expect(outcome.result.success).toBe(true)
    expect(outcome.result.transactionId).toBe('txn-1')
    expect(outcome.result.errorCode).toBeUndefined()
    expect(outcome.transactions).toHaveLength(1)
    expect(outcome.added?.transactionId).toBe('txn-1')
  })

  it('rejects a duplicate transactionId without modifying the array', () => {
    const existing = [buy()]
    const outcome = applyAddTransaction(existing, buy({ transactionId: 'txn-1', tradeDate: '2026-02-01' }))
    expect(outcome.result.success).toBe(false)
    expect(outcome.result.errorCode).toBe('DUPLICATE_ID')
    expect(outcome.transactions).toBe(existing)
  })

  it('rejects a transaction with validation errors without modifying the array', () => {
    const existing: LedgerTransaction[] = []
    // BUY with no quantity/price/securityId — multiple ERROR-level issues.
    const invalid = buy({ securityId: undefined, symbol: undefined, quantity: undefined, price: undefined })
    const outcome = applyAddTransaction(existing, invalid)
    expect(outcome.result.success).toBe(false)
    expect(outcome.result.errorCode).toBe('VALIDATION_ERROR')
    expect(outcome.result.issues.length).toBeGreaterThan(0)
    expect(outcome.result.issues.every(i => i.severity === 'ERROR')).toBe(true)
    expect(outcome.transactions).toBe(existing)
  })

  it('accepts a transaction whose validation issues contain no blocking errors', () => {
    // A clean DEPOSIT validates with zero issues — confirms the pass-through
    // `issues` field on a successful mutation never blocks acceptance.
    const outcome = applyAddTransaction([], deposit())
    expect(outcome.result.success).toBe(true)
    expect(outcome.result.issues).toEqual([])
  })
})

// ─── applyUpdateTransaction ───────────────────────────────────────────────────

describe('applyUpdateTransaction', () => {
  it('applies a valid update and returns the before snapshot', () => {
    const existing = [buy()]
    const outcome = applyUpdateTransaction(existing, 'txn-1', { price: 175 })
    expect(outcome.result.success).toBe(true)
    expect(outcome.before?.price).toBe(150)
    expect(outcome.after?.price).toBe(175)
    expect(outcome.transactions[0].price).toBe(175)
    // Original array left untouched.
    expect(existing[0].price).toBe(150)
  })

  it('rejects update for an unknown transactionId', () => {
    const existing = [buy()]
    const outcome = applyUpdateTransaction(existing, 'txn-missing', { price: 175 })
    expect(outcome.result.success).toBe(false)
    expect(outcome.result.errorCode).toBe('NOT_FOUND')
    expect(outcome.transactions).toBe(existing)
  })

  it('rejects an update that produces an invalid merged transaction', () => {
    const existing = [buy()]
    const outcome = applyUpdateTransaction(existing, 'txn-1', { quantity: -5 })
    expect(outcome.result.success).toBe(false)
    expect(outcome.result.errorCode).toBe('VALIDATION_ERROR')
    expect(outcome.transactions).toBe(existing)
    expect(existing[0].quantity).toBe(100)
  })

  it('ignores an attempt to change transactionId via updates', () => {
    const existing = [buy()]
    const outcome = applyUpdateTransaction(existing, 'txn-1', { transactionId: 'txn-hijacked', price: 160 } as Partial<LedgerTransaction>)
    expect(outcome.result.success).toBe(true)
    expect(outcome.after?.transactionId).toBe('txn-1')
    expect(outcome.transactions[0].transactionId).toBe('txn-1')
  })
})

// ─── applyDeleteTransaction ───────────────────────────────────────────────────

describe('applyDeleteTransaction', () => {
  it('deletes an existing transaction and returns the before snapshot', () => {
    const existing = [buy(), deposit()]
    const outcome = applyDeleteTransaction(existing, 'txn-1')
    expect(outcome.result.success).toBe(true)
    expect(outcome.before?.transactionId).toBe('txn-1')
    expect(outcome.transactions).toHaveLength(1)
    expect(outcome.transactions[0].transactionId).toBe('txn-2')
    // Original array left untouched.
    expect(existing).toHaveLength(2)
  })

  it('rejects delete for an unknown transactionId', () => {
    const existing = [buy()]
    const outcome = applyDeleteTransaction(existing, 'txn-missing')
    expect(outcome.result.success).toBe(false)
    expect(outcome.result.errorCode).toBe('NOT_FOUND')
    expect(outcome.transactions).toBe(existing)
  })
})

// ─── applyClearTransactions ───────────────────────────────────────────────────

describe('applyClearTransactions', () => {
  it('is a no-op on an empty ledger', () => {
    const existing: LedgerTransaction[] = []
    const outcome = applyClearTransactions(existing)
    expect(outcome.clearedCount).toBe(0)
    expect(outcome.result.success).toBe(true)
    expect(outcome.transactions).toBe(existing)
  })

  it('clears a non-empty ledger and reports the cleared count', () => {
    const existing = [buy(), deposit()]
    const outcome = applyClearTransactions(existing)
    expect(outcome.clearedCount).toBe(2)
    expect(outcome.result.success).toBe(true)
    expect(outcome.transactions).toEqual([])
    // Original array left untouched.
    expect(existing).toHaveLength(2)
  })
})

// ─── End-to-end derivation ────────────────────────────────────────────────────

describe('mutation chain feeding deriveLedgerState', () => {
  it('derives a correct LedgerState from multiple valid transactions', () => {
    let transactions: LedgerTransaction[] = []

    transactions = applyAddTransaction(transactions, deposit({ transactionId: 'txn-1', amount: 50000 })).transactions
    transactions = applyAddTransaction(transactions, buy({ transactionId: 'txn-2', tradeDate: '2026-01-15', quantity: 100, price: 150 })).transactions
    transactions = applyAddTransaction(transactions, buy({ transactionId: 'txn-3', tradeDate: '2026-02-01', quantity: 50, price: 160, fees: 5 })).transactions

    const state = deriveLedgerState(transactions)

    const position = state.positions.find(p => p.securityId === 'US:AAPL')
    expect(position?.quantity).toBe(150)
    expect(position?.totalCost).toBeCloseTo(100 * 150 + (50 * 160 + 5))

    const usdCash = state.cashBalances.find(b => b.currency === 'USD')?.amount ?? 0
    expect(usdCash).toBeCloseTo(50000 - 100 * 150 - (50 * 160 + 5))

    expect(state.warnings).toHaveLength(0)
  })
})
