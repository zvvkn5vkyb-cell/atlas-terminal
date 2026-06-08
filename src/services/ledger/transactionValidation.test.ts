import { describe, it, expect } from 'vitest'
import { validateTransaction, validateTransactions } from './transactionValidation'
import type { LedgerTransaction } from '@/types/ledger'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBuy(overrides: Partial<LedgerTransaction> = {}): LedgerTransaction {
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

function errors(txn: LedgerTransaction) {
  return validateTransaction(txn).issues.filter(i => i.severity === 'ERROR')
}

function warnings(txn: LedgerTransaction) {
  return validateTransaction(txn).issues.filter(i => i.severity === 'WARNING')
}

function codes(txn: LedgerTransaction) {
  return validateTransaction(txn).issues.map(i => i.code)
}

// ─── Valid transactions ────────────────────────────────────────────────────────

describe('validateTransaction — valid BUY', () => {
  it('returns valid: true with no issues', () => {
    const r = validateTransaction(makeBuy())
    expect(r.valid).toBe(true)
    expect(r.issues).toHaveLength(0)
  })
})

describe('validateTransaction — valid SELL', () => {
  it('is valid with securityId, quantity, price, currency', () => {
    const r = validateTransaction(makeBuy({ type: 'SELL' }))
    expect(r.valid).toBe(true)
  })
})

describe('validateTransaction — valid DEPOSIT', () => {
  it('is valid with amount and currency', () => {
    const r = validateTransaction({
      transactionId: 't1', type: 'DEPOSIT', tradeDate: '2026-01-01',
      amount: 5000, currency: 'USD', source: 'MANUAL',
    })
    expect(r.valid).toBe(true)
  })
})

// ─── Missing required fields ──────────────────────────────────────────────────

describe('validateTransaction — missing transactionId', () => {
  it('returns MISSING_ID error', () => {
    expect(codes(makeBuy({ transactionId: '' }))).toContain('MISSING_ID')
  })
})

describe('validateTransaction — invalid tradeDate', () => {
  it('returns INVALID_DATE error for bad format', () => {
    expect(codes(makeBuy({ tradeDate: '01/15/2026' }))).toContain('INVALID_DATE')
  })
  it('returns INVALID_DATE error for empty string', () => {
    expect(codes(makeBuy({ tradeDate: '' }))).toContain('INVALID_DATE')
  })
})

describe('validateTransaction — missing currency', () => {
  it('returns MISSING_CURRENCY error', () => {
    expect(codes(makeBuy({ currency: '' }))).toContain('MISSING_CURRENCY')
  })
})

// ─── Security-bearing type validation ─────────────────────────────────────────

describe('validateTransaction — BUY/SELL missing security', () => {
  it('returns MISSING_SECURITY when both securityId and symbol are absent', () => {
    const txn = makeBuy({ securityId: undefined, symbol: undefined })
    expect(codes(txn)).toContain('MISSING_SECURITY')
  })

  it('is valid when only symbol is provided (securityId optional)', () => {
    const r = validateTransaction(makeBuy({ securityId: undefined, symbol: 'AAPL' }))
    expect(r.valid).toBe(true)
  })
})

describe('validateTransaction — missing quantity', () => {
  it('returns MISSING_QUANTITY for BUY with no quantity', () => {
    expect(codes(makeBuy({ quantity: undefined }))).toContain('MISSING_QUANTITY')
  })
})

describe('validateTransaction — invalid quantity', () => {
  it('returns INVALID_QUANTITY for quantity <= 0', () => {
    expect(codes(makeBuy({ quantity: 0 }))).toContain('INVALID_QUANTITY')
    expect(codes(makeBuy({ quantity: -5 }))).toContain('INVALID_QUANTITY')
  })
})

describe('validateTransaction — missing price', () => {
  it('returns MISSING_PRICE for BUY with no price', () => {
    expect(codes(makeBuy({ price: undefined }))).toContain('MISSING_PRICE')
  })

  it('returns MISSING_PRICE for SELL with no price', () => {
    expect(codes(makeBuy({ type: 'SELL', price: undefined }))).toContain('MISSING_PRICE')
  })
})

describe('validateTransaction — invalid price', () => {
  it('returns INVALID_PRICE for negative price', () => {
    expect(codes(makeBuy({ price: -1 }))).toContain('INVALID_PRICE')
  })

  it('allows zero price', () => {
    expect(codes(makeBuy({ price: 0 }))).not.toContain('INVALID_PRICE')
  })
})

// ─── Amount-required types ────────────────────────────────────────────────────

describe('validateTransaction — DIVIDEND missing amount', () => {
  it('returns MISSING_AMOUNT', () => {
    const txn: LedgerTransaction = {
      transactionId: 't1', type: 'DIVIDEND', tradeDate: '2026-01-01',
      currency: 'USD', source: 'MANUAL',
    }
    expect(codes(txn)).toContain('MISSING_AMOUNT')
  })
})

describe('validateTransaction — WITHDRAWAL invalid amount', () => {
  it('returns INVALID_AMOUNT for zero', () => {
    const txn: LedgerTransaction = {
      transactionId: 't1', type: 'WITHDRAWAL', tradeDate: '2026-01-01',
      amount: 0, currency: 'USD', source: 'MANUAL',
    }
    expect(codes(txn)).toContain('INVALID_AMOUNT')
  })
})

// ─── SPLIT validation ─────────────────────────────────────────────────────────

describe('validateTransaction — SPLIT', () => {
  it('is valid with correct splitRatio', () => {
    const txn: LedgerTransaction = {
      transactionId: 't1', type: 'SPLIT', tradeDate: '2026-01-01',
      securityId: 'US:AAPL', quantity: 100,
      splitRatio: { numerator: 2, denominator: 1 }, currency: 'USD', source: 'MANUAL',
    }
    expect(validateTransaction(txn).valid).toBe(true)
  })

  it('returns MISSING_SPLIT_RATIO without splitRatio', () => {
    const txn: LedgerTransaction = {
      transactionId: 't1', type: 'SPLIT', tradeDate: '2026-01-01',
      securityId: 'US:AAPL', quantity: 100, currency: 'USD', source: 'MANUAL',
    }
    expect(codes(txn)).toContain('MISSING_SPLIT_RATIO')
  })

  it('returns INVALID_SPLIT_RATIO for zero denominator', () => {
    const txn: LedgerTransaction = {
      transactionId: 't1', type: 'SPLIT', tradeDate: '2026-01-01',
      securityId: 'US:AAPL', quantity: 100,
      splitRatio: { numerator: 2, denominator: 0 }, currency: 'USD', source: 'MANUAL',
    }
    expect(codes(txn)).toContain('INVALID_SPLIT_RATIO')
  })
})

// ─── FX_CONVERSION validation ─────────────────────────────────────────────────

describe('validateTransaction — FX_CONVERSION', () => {
  it('returns MISSING_LINKED_ID without linkedTransactionId', () => {
    const txn: LedgerTransaction = {
      transactionId: 't1', type: 'FX_CONVERSION', tradeDate: '2026-01-01',
      amount: 1000, currency: 'CAD', source: 'MANUAL',
    }
    expect(codes(txn)).toContain('MISSING_LINKED_ID')
  })

  it('is valid with linkedTransactionId and amount', () => {
    const txn: LedgerTransaction = {
      transactionId: 't1', type: 'FX_CONVERSION', tradeDate: '2026-01-01',
      amount: 1000, currency: 'CAD', linkedTransactionId: 't2', source: 'MANUAL',
    }
    expect(validateTransaction(txn).valid).toBe(true)
  })
})

// ─── ADJUSTMENT validation ────────────────────────────────────────────────────

describe('validateTransaction — ADJUSTMENT', () => {
  it('returns MISSING_NOTE without note', () => {
    const txn: LedgerTransaction = {
      transactionId: 't1', type: 'ADJUSTMENT', tradeDate: '2026-01-01',
      currency: 'USD', source: 'MANUAL',
    }
    expect(codes(txn)).toContain('MISSING_NOTE')
  })

  it('is valid with note', () => {
    const txn: LedgerTransaction = {
      transactionId: 't1', type: 'ADJUSTMENT', tradeDate: '2026-01-01',
      currency: 'USD', source: 'MANUAL', note: 'Manual correction',
    }
    expect(validateTransaction(txn).valid).toBe(true)
  })
})

// ─── Non-negative fees/tax ────────────────────────────────────────────────────

describe('validateTransaction — fees/tax sign', () => {
  it('returns INVALID_FEES for negative fees', () => {
    expect(codes(makeBuy({ fees: -5 }))).toContain('INVALID_FEES')
  })

  it('returns INVALID_TAX for negative tax', () => {
    expect(codes(makeBuy({ tax: -1 }))).toContain('INVALID_TAX')
  })

  it('allows zero fees', () => {
    expect(codes(makeBuy({ fees: 0 }))).not.toContain('INVALID_FEES')
  })
})

// ─── TRANSFER_IN security validation ──────────────────────────────────────────

describe('validateTransaction — TRANSFER_IN security', () => {
  it('requires price (cost basis) when quantity is present', () => {
    const txn: LedgerTransaction = {
      transactionId: 't1', type: 'TRANSFER_IN', tradeDate: '2026-01-01',
      securityId: 'US:AAPL', quantity: 50, currency: 'USD', source: 'MANUAL',
    }
    expect(codes(txn)).toContain('MISSING_COST_BASIS')
  })

  it('is valid with quantity, price, and security', () => {
    const txn: LedgerTransaction = {
      transactionId: 't1', type: 'TRANSFER_IN', tradeDate: '2026-01-01',
      securityId: 'US:AAPL', quantity: 50, price: 120, currency: 'USD', source: 'MANUAL',
    }
    expect(validateTransaction(txn).valid).toBe(true)
  })
})

// ─── RETURN_OF_CAPITAL validation ─────────────────────────────────────────────

describe('validateTransaction — RETURN_OF_CAPITAL', () => {
  it('requires securityId or symbol', () => {
    const txn: LedgerTransaction = {
      transactionId: 't1', type: 'RETURN_OF_CAPITAL', tradeDate: '2026-01-01',
      amount: 100, currency: 'USD', source: 'MANUAL',
    }
    expect(codes(txn)).toContain('MISSING_SECURITY')
  })

  it('requires amount', () => {
    const txn: LedgerTransaction = {
      transactionId: 't1', type: 'RETURN_OF_CAPITAL', tradeDate: '2026-01-01',
      securityId: 'US:AAPL', currency: 'USD', source: 'MANUAL',
    }
    expect(codes(txn)).toContain('MISSING_AMOUNT')
  })
})

// ─── validateTransactions (batch) ─────────────────────────────────────────────

describe('validateTransactions', () => {
  it('returns one result per transaction', () => {
    const txns = [makeBuy({ transactionId: 't1' }), makeBuy({ transactionId: 't2' })]
    const results = validateTransactions(txns)
    expect(results).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(validateTransactions([])).toEqual([])
  })

  it('propagates transactionId on each result', () => {
    const results = validateTransactions([makeBuy({ transactionId: 'abc' })])
    expect(results[0].transactionId).toBe('abc')
  })

  it('marks valid transactions as valid and invalid as not', () => {
    void errors // suppress unused lint
    const results = validateTransactions([
      makeBuy({ transactionId: 't-ok' }),
      makeBuy({ transactionId: 't-bad', quantity: -1 }),
    ])
    expect(results[0].valid).toBe(true)
    expect(results[1].valid).toBe(false)
  })
})
