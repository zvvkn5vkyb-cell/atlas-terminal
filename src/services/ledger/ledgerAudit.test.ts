import { describe, it, expect } from 'vitest'
import { buildTransactionAuditParams } from './ledgerAudit'
import {
  AUDIT_ACTION_TRANSACTION_CREATE,
  AUDIT_ACTION_TRANSACTION_UPDATE,
  AUDIT_ACTION_TRANSACTION_DELETE,
} from './constants'
import type { LedgerTransaction } from '@/types/ledger'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTxn(overrides: Partial<LedgerTransaction> = {}): LedgerTransaction {
  return {
    transactionId: 'txn-audit-1',
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

// ─── CREATE ───────────────────────────────────────────────────────────────────

describe('buildTransactionAuditParams — CREATE', () => {
  it('returns correct category and action', () => {
    const p = buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_CREATE, makeTxn())
    expect(p.category).toBe('TRANSACTION')
    expect(p.action).toBe('TRANSACTION.CREATE')
  })

  it('uses TRANSACTION as entityType', () => {
    expect(buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_CREATE, makeTxn()).entityType).toBe('TRANSACTION')
  })

  it('uses transactionId as entityId', () => {
    expect(buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_CREATE, makeTxn()).entityId).toBe('txn-audit-1')
  })

  it('severity is INFO', () => {
    expect(buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_CREATE, makeTxn()).severity).toBe('INFO')
  })

  it('source is UI for MANUAL transaction', () => {
    expect(buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_CREATE, makeTxn({ source: 'MANUAL' })).source).toBe('UI')
  })

  it('source is IMPORT for IMPORT transaction', () => {
    expect(buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_CREATE, makeTxn({ source: 'IMPORT' })).source).toBe('IMPORT')
  })

  it('source is SYSTEM for SEED transaction', () => {
    expect(buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_CREATE, makeTxn({ source: 'SEED' })).source).toBe('SYSTEM')
  })

  it('after contains compact transaction snapshot', () => {
    const p = buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_CREATE, makeTxn())
    const after = p.after as Record<string, unknown>
    expect(after.transactionId).toBe('txn-audit-1')
    expect(after.type).toBe('BUY')
    expect(after.tradeDate).toBe('2026-01-15')
    expect(after.currency).toBe('USD')
  })

  it('after includes quantity, price, securityId when present', () => {
    const p = buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_CREATE, makeTxn())
    const after = p.after as Record<string, unknown>
    expect(after.securityId).toBe('US:AAPL')
    expect(after.quantity).toBe(100)
    expect(after.price).toBe(150)
  })

  it('before is undefined for CREATE', () => {
    expect(buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_CREATE, makeTxn()).before).toBeUndefined()
  })

  it('does not throw', () => {
    expect(() => buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_CREATE, makeTxn())).not.toThrow()
  })
})

// ─── UPDATE ───────────────────────────────────────────────────────────────────

describe('buildTransactionAuditParams — UPDATE with before', () => {
  it('action is TRANSACTION.UPDATE', () => {
    const p = buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_UPDATE, makeTxn(), makeTxn({ price: 140 }))
    expect(p.action).toBe('TRANSACTION.UPDATE')
  })

  it('before contains the previous transaction snapshot', () => {
    const p = buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_UPDATE, makeTxn(), makeTxn({ price: 140 }))
    const before = p.before as Record<string, unknown>
    expect(before.price).toBe(140)
  })

  it('after contains the updated transaction snapshot', () => {
    const p = buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_UPDATE, makeTxn({ price: 150 }), makeTxn({ price: 140 }))
    const after = p.after as Record<string, unknown>
    expect(after.price).toBe(150)
  })
})

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('buildTransactionAuditParams — DELETE', () => {
  it('action is TRANSACTION.DELETE', () => {
    const p = buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_DELETE, makeTxn())
    expect(p.action).toBe('TRANSACTION.DELETE')
  })
})

// ─── Compact payload ──────────────────────────────────────────────────────────

describe('buildTransactionAuditParams — compact payload', () => {
  it('after omits undefined optional fields (fees, tax, note)', () => {
    const txn = makeTxn()
    const p = buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_CREATE, txn)
    const after = p.after as Record<string, unknown>
    expect('fees' in after).toBe(false)
    expect('tax' in after).toBe(false)
    expect('note' in after).toBe(false)
  })

  it('after includes fees when present', () => {
    const p = buildTransactionAuditParams(AUDIT_ACTION_TRANSACTION_CREATE, makeTxn({ fees: 9.99 }))
    expect((p.after as Record<string, unknown>).fees).toBe(9.99)
  })
})
