import { describe, it, expect, beforeEach } from 'vitest'
import { deriveLedgerState, sortTransactions, valuePositions } from './deriveLedgerState'
import type { LedgerTransaction } from '@/types/ledger'

// ─── Helpers ──────────────────────────────────────────────────────────────────

let seq = 0
function id() { return `t${++seq}` }

function buy(
  securityId: string, date: string, quantity: number, price: number,
  opts: Partial<LedgerTransaction> = {},
): LedgerTransaction {
  return { transactionId: id(), type: 'BUY', tradeDate: date, securityId, symbol: securityId.split(':')[1], quantity, price, currency: opts.currency ?? 'USD', source: 'MANUAL', ...opts }
}

function sell(
  securityId: string, date: string, quantity: number, price: number,
  opts: Partial<LedgerTransaction> = {},
): LedgerTransaction {
  return { transactionId: id(), type: 'SELL', tradeDate: date, securityId, quantity, price, currency: opts.currency ?? 'USD', source: 'MANUAL', ...opts }
}

function cash(type: 'DEPOSIT' | 'WITHDRAWAL', date: string, amount: number, currency = 'USD'): LedgerTransaction {
  return { transactionId: id(), type, tradeDate: date, amount, currency, source: 'MANUAL' }
}

function income(
  type: 'DIVIDEND' | 'DISTRIBUTION' | 'INTEREST',
  date: string, amount: number, currency = 'USD',
  opts: Partial<LedgerTransaction> = {},
): LedgerTransaction {
  return { transactionId: id(), type, tradeDate: date, amount, currency, source: 'MANUAL', ...opts }
}

function positionFor(state: ReturnType<typeof deriveLedgerState>, key: string) {
  return state.positions.find(p => p.securityId === key)
}

function cashFor(state: ReturnType<typeof deriveLedgerState>, currency: string) {
  return state.cashBalances.find(b => b.currency === currency)?.amount ?? 0
}

// Reset seq before each test for determinism
beforeEach(() => { seq = 0 })

// ─── Empty ledger ─────────────────────────────────────────────────────────────

describe('deriveLedgerState — empty input', () => {
  it('returns empty state', () => {
    const s = deriveLedgerState([])
    expect(s.positions).toHaveLength(0)
    expect(s.cashBalances).toHaveLength(0)
    expect(s.realizedGains).toHaveLength(0)
    expect(s.income).toHaveLength(0)
    expect(s.warnings).toHaveLength(0)
  })
})

// ─── Deterministic sorting ────────────────────────────────────────────────────

describe('sortTransactions', () => {
  it('sorts by tradeDate ascending', () => {
    const txns: LedgerTransaction[] = [
      { transactionId: 'b', type: 'BUY', tradeDate: '2026-03-01', currency: 'USD', source: 'MANUAL' },
      { transactionId: 'a', type: 'BUY', tradeDate: '2026-01-01', currency: 'USD', source: 'MANUAL' },
    ]
    const sorted = sortTransactions(txns)
    expect(sorted[0].tradeDate).toBe('2026-01-01')
    expect(sorted[1].tradeDate).toBe('2026-03-01')
  })

  it('sorts by transactionId as tiebreaker when dates are equal', () => {
    const txns: LedgerTransaction[] = [
      { transactionId: 'z', type: 'BUY', tradeDate: '2026-01-01', currency: 'USD', source: 'MANUAL' },
      { transactionId: 'a', type: 'BUY', tradeDate: '2026-01-01', currency: 'USD', source: 'MANUAL' },
    ]
    const sorted = sortTransactions(txns)
    expect(sorted[0].transactionId).toBe('a')
    expect(sorted[1].transactionId).toBe('z')
  })

  it('does not mutate the input array', () => {
    const txns: LedgerTransaction[] = [
      { transactionId: 'b', type: 'BUY', tradeDate: '2026-02-01', currency: 'USD', source: 'MANUAL' },
      { transactionId: 'a', type: 'BUY', tradeDate: '2026-01-01', currency: 'USD', source: 'MANUAL' },
    ]
    const original = txns.map(t => t.transactionId)
    sortTransactions(txns)
    expect(txns.map(t => t.transactionId)).toEqual(original)
  })

  it('identical output regardless of input order (determinism)', () => {
    const txns: LedgerTransaction[] = [
      buy('US:AAPL', '2026-02-01', 50, 155),
      buy('US:AAPL', '2026-01-01', 100, 150),
    ]
    const reversed = [...txns].reverse()
    const a = deriveLedgerState(txns)
    const b = deriveLedgerState(reversed)
    const pos = positionFor(a, 'US:AAPL')!
    const posR = positionFor(b, 'US:AAPL')!
    expect(pos.quantity).toBe(posR.quantity)
    expect(pos.totalCost).toBeCloseTo(posR.totalCost)
    expect(pos.averageCost).toBeCloseTo(posR.averageCost)
  })
})

// ─── BUY ──────────────────────────────────────────────────────────────────────

describe('deriveLedgerState — BUY', () => {
  it('creates a position with correct quantity, totalCost, averageCost', () => {
    const s = deriveLedgerState([buy('US:AAPL', '2026-01-01', 100, 150)])
    const pos = positionFor(s, 'US:AAPL')!
    expect(pos.quantity).toBe(100)
    expect(pos.totalCost).toBe(15000)
    expect(pos.averageCost).toBe(150)
  })

  it('reduces cash by quantity × price', () => {
    const s = deriveLedgerState([buy('US:AAPL', '2026-01-01', 100, 150)])
    expect(cashFor(s, 'USD')).toBe(-15000)
  })

  it('fees are added to totalCost and cash cost', () => {
    const s = deriveLedgerState([buy('US:AAPL', '2026-01-01', 100, 150, { fees: 10 })])
    const pos = positionFor(s, 'US:AAPL')!
    expect(pos.totalCost).toBe(15010)
    expect(cashFor(s, 'USD')).toBe(-15010)
  })
})

// ─── Multiple BUYs — ACB ──────────────────────────────────────────────────────

describe('deriveLedgerState — multiple BUYs (ACB)', () => {
  it('averages cost across two buys at different prices', () => {
    const s = deriveLedgerState([
      buy('US:AAPL', '2026-01-01', 100, 100),   // 100 @ $100 = $10,000
      buy('US:AAPL', '2026-02-01', 100, 200),   // 100 @ $200 = $20,000
    ])
    const pos = positionFor(s, 'US:AAPL')!
    expect(pos.quantity).toBe(200)
    expect(pos.totalCost).toBe(30000)
    expect(pos.averageCost).toBe(150)
  })

  it('three buys maintain running ACB', () => {
    const s = deriveLedgerState([
      buy('US:AAPL', '2026-01-01', 100, 100),  // avg 100
      buy('US:AAPL', '2026-02-01', 100, 120),  // avg 110
      buy('US:AAPL', '2026-03-01', 200, 130),  // avg 117.5
    ])
    const pos = positionFor(s, 'US:AAPL')!
    expect(pos.quantity).toBe(400)
    expect(pos.totalCost).toBe(100*100 + 100*120 + 200*130)  // 10000+12000+26000 = 48000
    expect(pos.averageCost).toBe(48000 / 400)  // 120
  })
})

// ─── SELL — partial ───────────────────────────────────────────────────────────

describe('deriveLedgerState — partial SELL', () => {
  it('reduces quantity and totalCost proportionally', () => {
    const s = deriveLedgerState([
      buy('US:AAPL', '2026-01-01', 100, 100),
      sell('US:AAPL', '2026-02-01', 40, 130),
    ])
    const pos = positionFor(s, 'US:AAPL')!
    expect(pos.quantity).toBe(60)
    expect(pos.totalCost).toBeCloseTo(6000)
  })

  it('records a realized gain entry', () => {
    const s = deriveLedgerState([
      buy('US:AAPL', '2026-01-01', 100, 100),
      sell('US:AAPL', '2026-02-01', 40, 130),
    ])
    expect(s.realizedGains).toHaveLength(1)
    const rg = s.realizedGains[0]
    expect(rg.quantitySold).toBe(40)
    expect(rg.proceeds).toBeCloseTo(40 * 130)
    expect(rg.costRemoved).toBeCloseTo(40 * 100)
    expect(rg.gain).toBeCloseTo((130 - 100) * 40)  // 1200
  })

  it('adds proceeds to cash', () => {
    const s = deriveLedgerState([
      buy('US:AAPL', '2026-01-01', 100, 100),
      sell('US:AAPL', '2026-02-01', 40, 130),
    ])
    // Cash: -10000 (buy) + 40*130 (sell proceeds) = -10000 + 5200 = -4800
    expect(cashFor(s, 'USD')).toBeCloseTo(-4800)
  })

  it('calculates a realized loss correctly', () => {
    const s = deriveLedgerState([
      buy('US:AAPL', '2026-01-01', 100, 100),
      sell('US:AAPL', '2026-02-01', 50, 80),
    ])
    const rg = s.realizedGains[0]
    expect(rg.gain).toBeCloseTo((80 - 100) * 50)   // -1000
  })
})

// ─── SELL — full (flat position) ──────────────────────────────────────────────

describe('deriveLedgerState — full SELL', () => {
  it('results in zero quantity and zero totalCost', () => {
    const s = deriveLedgerState([
      buy('US:AAPL', '2026-01-01', 100, 100),
      sell('US:AAPL', '2026-02-01', 100, 120),
    ])
    const pos = positionFor(s, 'US:AAPL')
    // Closed positions are still emitted because realizedPnL > 0
    if (pos) {
      expect(pos.quantity).toBe(0)
      expect(pos.totalCost).toBeCloseTo(0)
    }
    expect(s.realizedGains[0].gain).toBeCloseTo(2000)
  })
})

// ─── SELL — oversell ──────────────────────────────────────────────────────────

describe('deriveLedgerState — oversell', () => {
  it('clamps sell to held quantity and emits warning', () => {
    const s = deriveLedgerState([
      buy('US:AAPL', '2026-01-01', 50, 100),
      sell('US:AAPL', '2026-02-01', 100, 120),  // oversell
    ])
    expect(s.warnings.some(w => w.code === 'OVERSELL')).toBe(true)
    const rg = s.realizedGains[0]
    expect(rg.quantitySold).toBe(50)  // clamped
  })
})

// ─── SPLIT ────────────────────────────────────────────────────────────────────

describe('deriveLedgerState — SPLIT', () => {
  it('doubles quantity and halves averageCost on 2:1 split', () => {
    const buyTxn = buy('US:AAPL', '2026-01-01', 100, 200)
    const splitTxn: LedgerTransaction = {
      transactionId: id(), type: 'SPLIT', tradeDate: '2026-06-01',
      securityId: 'US:AAPL', symbol: 'AAPL', quantity: 100,
      splitRatio: { numerator: 2, denominator: 1 }, currency: 'USD', source: 'MANUAL',
    }
    const s = deriveLedgerState([buyTxn, splitTxn])
    const pos = positionFor(s, 'US:AAPL')!
    expect(pos.quantity).toBe(200)
    expect(pos.averageCost).toBeCloseTo(100)
    expect(pos.totalCost).toBe(20000)  // unchanged
  })

  it('no cash effect from split', () => {
    const buyTxn = buy('US:AAPL', '2026-01-01', 100, 200)
    const splitTxn: LedgerTransaction = {
      transactionId: id(), type: 'SPLIT', tradeDate: '2026-06-01',
      securityId: 'US:AAPL', symbol: 'AAPL', quantity: 100,
      splitRatio: { numerator: 2, denominator: 1 }, currency: 'USD', source: 'MANUAL',
    }
    const before = cashFor(deriveLedgerState([buyTxn]), 'USD')
    const after = cashFor(deriveLedgerState([buyTxn, splitTxn]), 'USD')
    expect(before).toBeCloseTo(after)
  })
})

// ─── RETURN_OF_CAPITAL ────────────────────────────────────────────────────────

describe('deriveLedgerState — RETURN_OF_CAPITAL below basis', () => {
  it('reduces totalCost and adds cash', () => {
    const s = deriveLedgerState([
      buy('US:XIU.TO', '2026-01-01', 100, 30, { currency: 'CAD', securityId: 'CA:XIU.TO' }),
      { transactionId: id(), type: 'RETURN_OF_CAPITAL', tradeDate: '2026-06-01', securityId: 'CA:XIU.TO', amount: 200, currency: 'CAD', source: 'MANUAL' },
    ])
    const pos = positionFor(s, 'CA:XIU.TO')!
    expect(pos.totalCost).toBeCloseTo(3000 - 200)   // 2800
    expect(cashFor(s, 'CAD')).toBeCloseTo(-3000 + 200)  // -2800
  })

  it('no realized gain when ROC <= totalCost', () => {
    const s = deriveLedgerState([
      buy('CA:XIU.TO', '2026-01-01', 100, 30, { currency: 'CAD', securityId: 'CA:XIU.TO' }),
      { transactionId: id(), type: 'RETURN_OF_CAPITAL', tradeDate: '2026-06-01', securityId: 'CA:XIU.TO', amount: 200, currency: 'CAD', source: 'MANUAL' },
    ])
    expect(s.realizedGains).toHaveLength(0)
  })
})

describe('deriveLedgerState — RETURN_OF_CAPITAL above basis', () => {
  it('floors totalCost at zero and records excess as realized gain', () => {
    const s = deriveLedgerState([
      buy('CA:XIU.TO', '2026-01-01', 100, 5, { currency: 'CAD', securityId: 'CA:XIU.TO' }),  // totalCost = 500
      { transactionId: id(), type: 'RETURN_OF_CAPITAL', tradeDate: '2026-06-01', securityId: 'CA:XIU.TO', amount: 800, currency: 'CAD', source: 'MANUAL' },
    ])
    const pos = positionFor(s, 'CA:XIU.TO')!
    expect(pos.totalCost).toBe(0)
    expect(s.realizedGains).toHaveLength(1)
    expect(s.realizedGains[0].gain).toBeCloseTo(300)  // 800 - 500
  })
})

// ─── DIVIDEND / DISTRIBUTION / INTEREST ──────────────────────────────────────

describe('deriveLedgerState — income types', () => {
  it('DIVIDEND adds to income and cash (net of tax)', () => {
    const s = deriveLedgerState([
      buy('US:AAPL', '2026-01-01', 100, 150),
      income('DIVIDEND', '2026-03-15', 200, 'USD', { securityId: 'US:AAPL', tax: 30 }),
    ])
    expect(s.income).toHaveLength(1)
    expect(s.income[0].gross).toBe(200)
    expect(s.income[0].taxWithheld).toBe(30)
    expect(s.income[0].net).toBe(170)
    // Cash: -15000 (buy) + 170 (dividend net) = -14830
    expect(cashFor(s, 'USD')).toBeCloseTo(-14830)
  })

  it('DIVIDEND does not affect position quantity or totalCost', () => {
    const s = deriveLedgerState([
      buy('US:AAPL', '2026-01-01', 100, 150),
      income('DIVIDEND', '2026-03-15', 200, 'USD', { securityId: 'US:AAPL' }),
    ])
    const pos = positionFor(s, 'US:AAPL')!
    expect(pos.quantity).toBe(100)
    expect(pos.totalCost).toBe(15000)
  })

  it('INTEREST adds to income and cash', () => {
    const s = deriveLedgerState([income('INTEREST', '2026-01-01', 50)])
    expect(s.income[0].type).toBe('INTEREST')
    expect(cashFor(s, 'USD')).toBe(50)
  })

  it('DISTRIBUTION adds to income', () => {
    const s = deriveLedgerState([income('DISTRIBUTION', '2026-01-01', 100)])
    expect(s.income[0].type).toBe('DISTRIBUTION')
  })

  it('tax withheld accumulates in totalTax', () => {
    const s = deriveLedgerState([income('DIVIDEND', '2026-01-01', 100, 'USD', { tax: 15 })])
    expect(s.totalTax['USD']).toBe(15)
  })
})

// ─── FEE / TAX ────────────────────────────────────────────────────────────────

describe('deriveLedgerState — FEE and TAX', () => {
  it('FEE reduces cash and accumulates in totalFees', () => {
    const txn: LedgerTransaction = {
      transactionId: id(), type: 'FEE', tradeDate: '2026-01-01',
      amount: 25, currency: 'USD', source: 'MANUAL',
    }
    const s = deriveLedgerState([txn])
    expect(cashFor(s, 'USD')).toBe(-25)
    expect(s.totalFees['USD']).toBe(25)
  })

  it('TAX reduces cash and accumulates in totalTax', () => {
    const txn: LedgerTransaction = {
      transactionId: id(), type: 'TAX', tradeDate: '2026-01-01',
      amount: 500, currency: 'USD', source: 'MANUAL',
    }
    const s = deriveLedgerState([txn])
    expect(cashFor(s, 'USD')).toBe(-500)
    expect(s.totalTax['USD']).toBe(500)
  })
})

// ─── DEPOSIT / WITHDRAWAL ─────────────────────────────────────────────────────

describe('deriveLedgerState — DEPOSIT and WITHDRAWAL', () => {
  it('DEPOSIT adds to cash', () => {
    const s = deriveLedgerState([cash('DEPOSIT', '2026-01-01', 10000)])
    expect(cashFor(s, 'USD')).toBe(10000)
  })

  it('WITHDRAWAL reduces cash', () => {
    const s = deriveLedgerState([cash('DEPOSIT', '2026-01-01', 10000), cash('WITHDRAWAL', '2026-02-01', 3000)])
    expect(cashFor(s, 'USD')).toBe(7000)
  })
})

// ─── Multi-currency segregation ───────────────────────────────────────────────

describe('deriveLedgerState — multi-currency cash remains segregated', () => {
  it('USD and CAD cash balances are separate', () => {
    const s = deriveLedgerState([
      cash('DEPOSIT', '2026-01-01', 10000, 'USD'),
      cash('DEPOSIT', '2026-01-01', 12000, 'CAD'),
    ])
    expect(cashFor(s, 'USD')).toBe(10000)
    expect(cashFor(s, 'CAD')).toBe(12000)
  })
})

describe('deriveLedgerState — multi-currency positions remain segregated', () => {
  it('USD and CAD positions tracked independently', () => {
    const s = deriveLedgerState([
      buy('US:AAPL', '2026-01-01', 100, 150, { currency: 'USD' }),
      buy('CA:RY.TO', '2026-01-01', 200, 130, { currency: 'CAD', securityId: 'CA:RY.TO' }),
    ])
    const usd = positionFor(s, 'US:AAPL')!
    const cad = positionFor(s, 'CA:RY.TO')!
    expect(usd.currency).toBe('USD')
    expect(cad.currency).toBe('CAD')
    expect(usd.totalCost).toBe(15000)
    expect(cad.totalCost).toBe(26000)
  })
})

// ─── FX_CONVERSION ────────────────────────────────────────────────────────────

describe('deriveLedgerState — FX_CONVERSION', () => {
  it('reduces sell-side currency and adds buy-side currency', () => {
    const sellId = id()
    const buyId = id()
    const s = deriveLedgerState([
      cash('DEPOSIT', '2026-01-01', 10000, 'CAD'),
      // Sell CAD 1000, buy USD 740 (linked pair)
      {
        transactionId: sellId, type: 'FX_CONVERSION', tradeDate: '2026-01-15',
        amount: 1000, currency: 'CAD', linkedTransactionId: buyId, source: 'MANUAL',
      },
      {
        transactionId: buyId, type: 'FX_CONVERSION', tradeDate: '2026-01-15',
        amount: 740, currency: 'USD', linkedTransactionId: sellId, source: 'MANUAL',
      },
    ])
    expect(cashFor(s, 'CAD')).toBeCloseTo(10000 - 1000)   // 9000
    expect(cashFor(s, 'USD')).toBeCloseTo(740)
  })

  it('emits warning when linked transaction is not found', () => {
    const s = deriveLedgerState([
      {
        transactionId: id(), type: 'FX_CONVERSION', tradeDate: '2026-01-01',
        amount: 500, currency: 'CAD', linkedTransactionId: 'missing-id', source: 'MANUAL',
      },
    ])
    expect(s.warnings.some(w => w.code === 'MISSING_LINKED_TXN')).toBe(true)
  })

  it('does not double-process the linked side', () => {
    const sellId = id()
    const buyId = id()
    const s = deriveLedgerState([
      {
        transactionId: sellId, type: 'FX_CONVERSION', tradeDate: '2026-01-01',
        amount: 1000, currency: 'CAD', linkedTransactionId: buyId, source: 'MANUAL',
      },
      {
        transactionId: buyId, type: 'FX_CONVERSION', tradeDate: '2026-01-01',
        amount: 740, currency: 'USD', linkedTransactionId: sellId, source: 'MANUAL',
      },
    ])
    // USD should be exactly +740, not +740−740
    expect(cashFor(s, 'USD')).toBeCloseTo(740)
  })
})

// ─── valuePositions ───────────────────────────────────────────────────────────

describe('valuePositions', () => {
  it('enriches positions where price is supplied', () => {
    const s = deriveLedgerState([buy('US:AAPL', '2026-01-01', 100, 100)])
    const valued = valuePositions(s.positions, { 'US:AAPL': 120 })
    expect(valued).toHaveLength(1)
    expect(valued[0].marketPrice).toBe(120)
    expect(valued[0].marketValue).toBe(12000)
    expect(valued[0].unrealizedPnL).toBeCloseTo(2000)
  })

  it('omits positions where no price is supplied', () => {
    const s = deriveLedgerState([
      buy('US:AAPL', '2026-01-01', 100, 100),
      buy('CA:RY.TO', '2026-01-01', 200, 50, { currency: 'CAD', securityId: 'CA:RY.TO' }),
    ])
    const valued = valuePositions(s.positions, { 'US:AAPL': 120 })
    expect(valued).toHaveLength(1)
    expect(valued[0].securityId).toBe('US:AAPL')
  })

  it('returns empty array when price lookup is empty', () => {
    const s = deriveLedgerState([buy('US:AAPL', '2026-01-01', 100, 100)])
    expect(valuePositions(s.positions, {})).toHaveLength(0)
  })

  it('unrealizedPnLPct is 0 when totalCost is 0', () => {
    const s = deriveLedgerState([buy('US:AAPL', '2026-01-01', 100, 0)])
    const valued = valuePositions(s.positions, { 'US:AAPL': 10 })
    expect(valued[0].unrealizedPnLPct).toBe(0)
  })
})
