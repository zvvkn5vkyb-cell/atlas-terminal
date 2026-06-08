import type { LedgerTransaction } from '@/types/ledger'
import type { CreateAuditEntryParams } from '@/services/audit/auditLog'
import {
  AUDIT_ACTION_TRANSACTION_CREATE,
  AUDIT_ACTION_TRANSACTION_UPDATE,
  AUDIT_ACTION_TRANSACTION_DELETE,
  AUDIT_ACTION_TRANSACTION_IMPORT,
} from './constants'

// ─── Ledger audit helpers (Phase 1) ───────────────────────────────────────────
// Pure helpers that return CreateAuditEntryParams for future audit wiring.
// recordAudit() is NOT called here — wiring deferred to Phase 1-2.

export type LedgerAuditAction =
  | typeof AUDIT_ACTION_TRANSACTION_CREATE
  | typeof AUDIT_ACTION_TRANSACTION_UPDATE
  | typeof AUDIT_ACTION_TRANSACTION_DELETE
  | typeof AUDIT_ACTION_TRANSACTION_IMPORT

// Compact transaction payload for audit before/after — excludes large or
// undefined fields to keep the audit entry small.
function compactTransaction(txn: LedgerTransaction): Record<string, unknown> {
  const out: Record<string, unknown> = {
    transactionId: txn.transactionId,
    type: txn.type,
    tradeDate: txn.tradeDate,
    currency: txn.currency,
    source: txn.source,
  }
  if (txn.securityId !== undefined) out.securityId = txn.securityId
  if (txn.symbol !== undefined) out.symbol = txn.symbol
  if (txn.quantity !== undefined) out.quantity = txn.quantity
  if (txn.price !== undefined) out.price = txn.price
  if (txn.amount !== undefined) out.amount = txn.amount
  if (txn.fees !== undefined) out.fees = txn.fees
  if (txn.tax !== undefined) out.tax = txn.tax
  if (txn.accountId !== undefined) out.accountId = txn.accountId
  return out
}

export function buildTransactionAuditParams(
  action: LedgerAuditAction,
  txn: LedgerTransaction,
  before?: LedgerTransaction,
): CreateAuditEntryParams {
  const auditSource =
    txn.source === 'IMPORT' ? ('IMPORT' as const) :
    txn.source === 'SEED' ? ('SYSTEM' as const) :
    ('UI' as const)

  const params: CreateAuditEntryParams = {
    category: 'TRANSACTION',
    action,
    entityType: 'TRANSACTION',
    entityId: txn.transactionId,
    source: auditSource,
    severity: 'INFO',
    reason: `Transaction ${action.toLowerCase().replace('transaction.', '')}`,
    after: compactTransaction(txn),
  }

  if (before !== undefined) {
    params.before = compactTransaction(before)
  }

  return params
}

// Re-export action constants for convenience.
export {
  AUDIT_ACTION_TRANSACTION_CREATE,
  AUDIT_ACTION_TRANSACTION_UPDATE,
  AUDIT_ACTION_TRANSACTION_DELETE,
  AUDIT_ACTION_TRANSACTION_IMPORT,
}
