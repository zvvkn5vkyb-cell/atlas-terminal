import type { LedgerTransaction, LedgerMutationResult } from '@/types/ledger'
import { validateTransaction } from '@/services/ledger/transactionValidation'

// ─── Ledger store mutation primitives (Phase 1-2) ─────────────────────────────
// Pure, store-agnostic helpers. Each `apply*` function takes the current
// transactions array and returns the next array plus a structured
// LedgerMutationResult. Rejected mutations return the input array unchanged.

// ─── ID generation ─────────────────────────────────────────────────────────────

export function generateTransactionId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof (crypto as { randomUUID?: unknown }).randomUUID === 'function'
  ) {
    return `txn-${(crypto as { randomUUID: () => string }).randomUUID()}`
  }
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `txn-${ts}-${rand}`
}

// ─── Add ──────────────────────────────────────────────────────────────────────

export interface ApplyAddOutcome {
  transactions: LedgerTransaction[]
  result: LedgerMutationResult
  added?: LedgerTransaction
}

export function applyAddTransaction(
  transactions: LedgerTransaction[],
  txn: LedgerTransaction,
): ApplyAddOutcome {
  if (transactions.some(t => t.transactionId === txn.transactionId)) {
    return {
      transactions,
      result: {
        success: false,
        transactionId: txn.transactionId,
        issues: [],
        errorCode: 'DUPLICATE_ID',
      },
    }
  }

  const validation = validateTransaction(txn)
  if (!validation.valid) {
    return {
      transactions,
      result: {
        success: false,
        transactionId: txn.transactionId,
        issues: validation.issues,
        errorCode: 'VALIDATION_ERROR',
      },
    }
  }

  return {
    transactions: [...transactions, txn],
    result: { success: true, transactionId: txn.transactionId, issues: validation.issues },
    added: txn,
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export interface ApplyUpdateOutcome {
  transactions: LedgerTransaction[]
  result: LedgerMutationResult
  before?: LedgerTransaction
  after?: LedgerTransaction
}

export function applyUpdateTransaction(
  transactions: LedgerTransaction[],
  transactionId: string,
  updates: Partial<LedgerTransaction>,
): ApplyUpdateOutcome {
  const index = transactions.findIndex(t => t.transactionId === transactionId)
  if (index === -1) {
    return {
      transactions,
      result: { success: false, transactionId, issues: [], errorCode: 'NOT_FOUND' },
    }
  }

  const before = transactions[index]
  // transactionId is immutable — any transactionId in `updates` is ignored.
  const merged: LedgerTransaction = { ...before, ...updates, transactionId: before.transactionId }

  const validation = validateTransaction(merged)
  if (!validation.valid) {
    return {
      transactions,
      result: {
        success: false,
        transactionId,
        issues: validation.issues,
        errorCode: 'VALIDATION_ERROR',
      },
    }
  }

  const next = [...transactions]
  next[index] = merged
  return {
    transactions: next,
    result: { success: true, transactionId, issues: validation.issues },
    before,
    after: merged,
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export interface ApplyDeleteOutcome {
  transactions: LedgerTransaction[]
  result: LedgerMutationResult
  before?: LedgerTransaction
}

export function applyDeleteTransaction(
  transactions: LedgerTransaction[],
  transactionId: string,
): ApplyDeleteOutcome {
  const index = transactions.findIndex(t => t.transactionId === transactionId)
  if (index === -1) {
    return {
      transactions,
      result: { success: false, transactionId, issues: [], errorCode: 'NOT_FOUND' },
    }
  }

  const before = transactions[index]
  return {
    transactions: transactions.filter(t => t.transactionId !== transactionId),
    result: { success: true, transactionId, issues: [] },
    before,
  }
}

// ─── Clear ────────────────────────────────────────────────────────────────────

export interface ApplyClearOutcome {
  transactions: LedgerTransaction[]
  result: LedgerMutationResult
  clearedCount: number
}

// Clearing an already-empty ledger is a no-op, not a mutation: `clearedCount`
// is 0 and the input array is returned unchanged so the caller can skip the
// state write and audit entry entirely.
export function applyClearTransactions(transactions: LedgerTransaction[]): ApplyClearOutcome {
  const clearedCount = transactions.length
  if (clearedCount === 0) {
    return { transactions, result: { success: true, issues: [] }, clearedCount: 0 }
  }

  return { transactions: [], result: { success: true, issues: [] }, clearedCount }
}
